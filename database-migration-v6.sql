-- ============================================================
-- GALLUBIX CRM v6 — MIGRATION
-- Ajouter: is_client, transmis_installateur, date_pose
-- ============================================================

-- 1. Nouveaux champs sur la table prospects
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS is_client BOOLEAN DEFAULT false;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS transmis_installateur BOOLEAN DEFAULT false;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS date_pose TIMESTAMPTZ;

-- 2. Index pour les nouveaux champs
CREATE INDEX IF NOT EXISTS idx_prospects_is_client ON prospects(is_client);
CREATE INDEX IF NOT EXISTS idx_prospects_transmis ON prospects(transmis_installateur);
CREATE INDEX IF NOT EXISTS idx_prospects_date_pose ON prospects(date_pose);

-- 2b. S'assurer que is_final existe sur la table statuses (nécessaire pour le trigger)
ALTER TABLE statuses ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT false;

-- 3. Mettre à jour is_client pour les prospects déjà en statut final
UPDATE prospects p
SET is_client = true
FROM statuses s
WHERE p.status_id = s.id AND s.is_final = true AND p.is_client = false;

-- 4. Trigger: auto-set is_client quand le statut passe en final
CREATE OR REPLACE FUNCTION auto_set_client_on_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_id IS NOT NULL THEN
    SELECT is_final INTO NEW.is_client
    FROM statuses WHERE id = NEW.status_id;
    IF NEW.is_client IS NULL THEN
      NEW.is_client := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_client ON prospects;
CREATE TRIGGER trg_auto_client
  BEFORE INSERT OR UPDATE OF status_id ON prospects
  FOR EACH ROW EXECUTE FUNCTION auto_set_client_on_status();

-- 5. Mettre à jour la RPC search_prospects pour supporter is_client et transmis_installateur
-- Drop l'ancienne version (15 params) pour éviter l'overload PostgreSQL
DROP FUNCTION IF EXISTS search_prospects(TEXT, UUID[], UUID[], UUID[], UUID[], UUID[], BOOLEAN, BOOLEAN, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, INT, INT);
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
    -- Both specific products AND "no product" selected → OR logic
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
  -- New v6 filters
  IF p_is_client IS NOT NULL THEN
    where_clauses := array_append(where_clauses, format('p.is_client = %L', p_is_client));
  END IF;
  IF p_transmis IS NOT NULL THEN
    where_clauses := array_append(where_clauses, format('p.transmis_installateur = %L', p_transmis));
  END IF;

  -- Build query
  query_text := 'SELECT p.*, 
    CASE WHEN cat.id IS NOT NULL THEN row_to_json(cat.*) ELSE NULL END as category, 
    CASE WHEN st.id IS NOT NULL THEN row_to_json(st.*) ELSE NULL END as status, 
    CASE WHEN pr.id IS NOT NULL THEN row_to_json(pr.*) ELSE NULL END as product, 
    CASE WHEN ins.id IS NOT NULL THEN row_to_json(ins.*) ELSE NULL END as installer,
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
    LEFT JOIN installers ins ON ins.id = p.installer_id';

  IF array_length(where_clauses, 1) > 0 THEN
    query_text := query_text || ' WHERE ' || array_to_string(where_clauses, ' AND ');
  END IF;

  -- Count
  count_text := 'SELECT COUNT(*) FROM prospects p';
  IF array_length(where_clauses, 1) > 0 THEN
    count_text := count_text || ' WHERE ' || array_to_string(where_clauses, ' AND ');
  END IF;
  EXECUTE count_text INTO total_count;

  -- Sort and paginate
  query_text := query_text || format(' ORDER BY p.%I %s NULLS LAST LIMIT %s OFFSET %s',
    p_sort_col, CASE WHEN p_sort_dir = 'asc' THEN 'ASC' ELSE 'DESC' END, p_per_page, offset_val);

  -- Execute and return
  EXECUTE format('SELECT jsonb_build_object(''data'', COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb), ''total'', %s) FROM (%s) t', total_count, query_text)
  INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. Mettre à jour la RPC get_prospect_counts pour inclure clients + transmis
CREATE OR REPLACE FUNCTION get_prospect_counts()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  by_status JSONB := '{}';
  by_product JSONB := '{}';
  by_category JSONB := '{}';
  by_installer JSONB := '{}';
  by_user JSONB := '{}';
  total_count INT;
  unassigned_count INT;
  client_count INT;
  prospect_count INT;
  transmis_count INT;
  none_product_count INT;
  r RECORD;
BEGIN
  SELECT COUNT(*) INTO total_count FROM prospects;
  SELECT COUNT(*) INTO client_count FROM prospects WHERE is_client = true;
  prospect_count := total_count - client_count;
  SELECT COUNT(*) INTO transmis_count FROM prospects WHERE transmis_installateur = true;
  SELECT COUNT(*) INTO unassigned_count FROM prospects WHERE NOT EXISTS (
    SELECT 1 FROM prospect_assignments WHERE prospect_assignments.prospect_id = prospects.id
  );

  FOR r IN SELECT status_id, COUNT(*) as cnt FROM prospects WHERE status_id IS NOT NULL GROUP BY status_id LOOP
    by_status := by_status || jsonb_build_object(r.status_id::TEXT, r.cnt);
  END LOOP;
  FOR r IN SELECT product_id, COUNT(*) as cnt FROM prospects WHERE product_id IS NOT NULL GROUP BY product_id LOOP
    by_product := by_product || jsonb_build_object(r.product_id::TEXT, r.cnt);
  END LOOP;
  SELECT COUNT(*) INTO none_product_count FROM prospects WHERE product_id IS NULL;
  by_product := by_product || jsonb_build_object('none', none_product_count);
  FOR r IN SELECT category_id, COUNT(*) as cnt FROM prospects WHERE category_id IS NOT NULL GROUP BY category_id LOOP
    by_category := by_category || jsonb_build_object(r.category_id::TEXT, r.cnt);
  END LOOP;
  FOR r IN SELECT installer_id, COUNT(*) as cnt FROM prospects WHERE installer_id IS NOT NULL GROUP BY installer_id LOOP
    by_installer := by_installer || jsonb_build_object(r.installer_id::TEXT, r.cnt);
  END LOOP;
  FOR r IN SELECT pa.user_id, COUNT(DISTINCT pa.prospect_id) as cnt FROM prospect_assignments pa GROUP BY pa.user_id LOOP
    by_user := by_user || jsonb_build_object(r.user_id::TEXT, r.cnt);
  END LOOP;

  result := jsonb_build_object(
    'total', total_count,
    'clients', client_count,
    'prospects', prospect_count,
    'transmis', transmis_count,
    'unassigned', unassigned_count,
    'by_status', by_status,
    'by_product', by_product,
    'by_category', by_category,
    'by_installer', by_installer,
    'by_user', by_user
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
