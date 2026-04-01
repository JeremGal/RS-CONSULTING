-- ============================================================
-- GALLUBIX CRM v7 — MIGRATION
-- Ajouter: closer_id, type_led, nb_led_reel, mode_pose, secteur
-- ⚠️ AUCUNE DONNÉE EXISTANTE N'EST MODIFIÉE OU SUPPRIMÉE
-- ============================================================

-- 1. Nouveaux champs sur la table prospects
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS closer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS type_led TEXT CHECK (type_led IN ('led_cloche', 'led_reglette'));
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS nb_led_reel INT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS mode_pose TEXT CHECK (mode_pose IN ('installation', 'livraison'));
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS secteur TEXT CHECK (secteur IN ('commerce', 'agriculture', 'animaux'));

-- 2. Index pour les nouveaux champs
CREATE INDEX IF NOT EXISTS idx_prospects_closer ON prospects(closer_id);
CREATE INDEX IF NOT EXISTS idx_prospects_type_led ON prospects(type_led);
CREATE INDEX IF NOT EXISTS idx_prospects_mode_pose ON prospects(mode_pose);
CREATE INDEX IF NOT EXISTS idx_prospects_secteur ON prospects(secteur);

-- 3. Mettre à jour la RPC search_prospects pour inclure les nouveaux champs + prochain rappel
DROP FUNCTION IF EXISTS search_prospects(TEXT, UUID[], UUID[], UUID[], UUID[], UUID[], BOOLEAN, BOOLEAN, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, INT, INT, BOOLEAN, BOOLEAN);
CREATE OR REPLACE FUNCTION search_prospects(
  p_search TEXT DEFAULT '',
  p_product_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_status_ids UUID[] DEFAULT NULL,
  p_installer_ids UUID[] DEFAULT NULL,
  p_user_ids UUID[] DEFAULT NULL,
  p_unassigned BOOLEAN DEFAULT false,
  p_no_product BOOLEAN DEFAULT false,
  p_no_installer BOOLEAN DEFAULT false,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_sort_col TEXT DEFAULT 'updated_at',
  p_sort_dir TEXT DEFAULT 'desc',
  p_page INT DEFAULT 1,
  p_per_page INT DEFAULT 50,
  p_is_client BOOLEAN DEFAULT NULL,
  p_transmis BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  total_count INT;
  offset_val INT;
  query_text TEXT;
  count_text TEXT;
  where_clauses TEXT[] := ARRAY[]::TEXT[];
  search_term TEXT;
BEGIN
  offset_val := (p_page - 1) * p_per_page;

  -- Build WHERE clauses
  IF p_search IS NOT NULL AND p_search != '' THEN
    search_term := '%' || p_search || '%';
    where_clauses := array_append(where_clauses,
      format('(p.company_name ILIKE %L OR p.last_name ILIKE %L OR p.first_name ILIKE %L OR p.phone ILIKE %L OR p.city ILIKE %L OR p.email ILIKE %L)',
        search_term, search_term, search_term, search_term, search_term, search_term));
  END IF;
  IF p_product_ids IS NOT NULL AND array_length(p_product_ids, 1) > 0 AND p_no_product THEN
    where_clauses := array_append(where_clauses, format('(p.product_id = ANY(%L::UUID[]) OR p.product_id IS NULL)', p_product_ids));
  ELSIF p_product_ids IS NOT NULL AND array_length(p_product_ids, 1) > 0 THEN
    where_clauses := array_append(where_clauses, format('p.product_id = ANY(%L::UUID[])', p_product_ids));
  ELSIF p_no_product THEN
    where_clauses := array_append(where_clauses, 'p.product_id IS NULL');
  END IF;
  IF p_category_ids IS NOT NULL AND array_length(p_category_ids, 1) > 0 THEN
    where_clauses := array_append(where_clauses, format('p.category_id = ANY(%L::UUID[])', p_category_ids));
  END IF;
  IF p_status_ids IS NOT NULL AND array_length(p_status_ids, 1) > 0 THEN
    where_clauses := array_append(where_clauses, format('p.status_id = ANY(%L::UUID[])', p_status_ids));
  END IF;
  IF p_installer_ids IS NOT NULL AND array_length(p_installer_ids, 1) > 0 AND p_no_installer THEN
    where_clauses := array_append(where_clauses, format('(p.installer_id = ANY(%L::UUID[]) OR p.installer_id IS NULL)', p_installer_ids));
  ELSIF p_installer_ids IS NOT NULL AND array_length(p_installer_ids, 1) > 0 THEN
    where_clauses := array_append(where_clauses, format('p.installer_id = ANY(%L::UUID[])', p_installer_ids));
  ELSIF p_no_installer THEN
    where_clauses := array_append(where_clauses, 'p.installer_id IS NULL');
  END IF;
  IF p_user_ids IS NOT NULL AND array_length(p_user_ids, 1) > 0 AND p_unassigned THEN
    where_clauses := array_append(where_clauses, format('(EXISTS (SELECT 1 FROM prospect_assignments pa WHERE pa.prospect_id = p.id AND pa.user_id = ANY(%L::UUID[])) OR NOT EXISTS (SELECT 1 FROM prospect_assignments pa2 WHERE pa2.prospect_id = p.id))', p_user_ids));
  ELSIF p_user_ids IS NOT NULL AND array_length(p_user_ids, 1) > 0 THEN
    where_clauses := array_append(where_clauses, format('EXISTS (SELECT 1 FROM prospect_assignments pa WHERE pa.prospect_id = p.id AND pa.user_id = ANY(%L::UUID[]))', p_user_ids));
  ELSIF p_unassigned THEN
    where_clauses := array_append(where_clauses, 'NOT EXISTS (SELECT 1 FROM prospect_assignments pa WHERE pa.prospect_id = p.id)');
  END IF;
  IF p_date_from IS NOT NULL THEN
    where_clauses := array_append(where_clauses, format('p.created_at >= %L', p_date_from));
  END IF;
  IF p_date_to IS NOT NULL THEN
    where_clauses := array_append(where_clauses, format('p.created_at <= %L', p_date_to));
  END IF;
  IF p_is_client IS NOT NULL THEN
    where_clauses := array_append(where_clauses, format('p.is_client = %L', p_is_client));
  END IF;
  IF p_transmis IS NOT NULL THEN
    where_clauses := array_append(where_clauses, format('p.transmis_installateur = %L', p_transmis));
  END IF;

  -- Build query — now includes closer profile + next reminder
  query_text := 'SELECT p.*, 
    CASE WHEN cat.id IS NOT NULL THEN row_to_json(cat.*) ELSE NULL END as category, 
    CASE WHEN st.id IS NOT NULL THEN row_to_json(st.*) ELSE NULL END as status, 
    CASE WHEN pr.id IS NOT NULL THEN row_to_json(pr.*) ELSE NULL END as product, 
    CASE WHEN ins.id IS NOT NULL THEN row_to_json(ins.*) ELSE NULL END as installer,
    CASE WHEN cl.id IS NOT NULL THEN json_build_object(''id'', cl.id, ''first_name'', cl.first_name, ''last_name'', cl.last_name) ELSE NULL END as closer,
    (SELECT row_to_json(nr) FROM (
      SELECT r.id, r.due_date, r.message FROM reminders r 
      WHERE r.prospect_id = p.id AND r.completed = false 
      ORDER BY r.due_date ASC LIMIT 1
    ) nr) as next_reminder,
    COALESCE(
      (SELECT json_agg(json_build_object(
        ''user_id'', pa.user_id,
        ''profile'', json_build_object(''id'', prof.id, ''first_name'', prof.first_name, ''last_name'', prof.last_name, ''email'', prof.email, ''role'', prof.role)
      ))
      FROM prospect_assignments pa
      JOIN profiles prof ON prof.id = pa.user_id
      WHERE pa.prospect_id = p.id), ''[]''::json
    ) as assignments
    FROM prospects p
    LEFT JOIN categories cat ON cat.id = p.category_id
    LEFT JOIN statuses st ON st.id = p.status_id
    LEFT JOIN products pr ON pr.id = p.product_id
    LEFT JOIN installers ins ON ins.id = p.installer_id
    LEFT JOIN profiles cl ON cl.id = p.closer_id';

  IF array_length(where_clauses, 1) > 0 THEN
    query_text := query_text || ' WHERE ' || array_to_string(where_clauses, ' AND ');
  END IF;

  count_text := 'SELECT COUNT(*) FROM prospects p';
  IF array_length(where_clauses, 1) > 0 THEN
    count_text := count_text || ' WHERE ' || array_to_string(where_clauses, ' AND ');
  END IF;
  EXECUTE count_text INTO total_count;

  query_text := query_text || format(' ORDER BY p.%I %s NULLS LAST LIMIT %s OFFSET %s',
    p_sort_col, CASE WHEN p_sort_dir = 'asc' THEN 'ASC' ELSE 'DESC' END, p_per_page, offset_val);

  EXECUTE format('SELECT jsonb_build_object(''data'', COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb), ''total'', %s) FROM (%s) t', total_count, query_text)
  INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. Vérification
DO $$ BEGIN
  RAISE NOTICE '✅ Migration v7 OK — closer_id, type_led, nb_led_reel, mode_pose, secteur ajoutés';
END $$;
