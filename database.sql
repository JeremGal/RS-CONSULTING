-- ============================================================
-- GALLUBIX CRM v4 — SETUP COMPLET DE LA BASE DE DONNÉES
-- ============================================================
-- Exécuter ce fichier dans Supabase SQL Editor AVANT de déployer
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280',
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  color TEXT DEFAULT '#6B7280',
  is_final BOOLEAN DEFAULT false,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  color TEXT DEFAULT '#6B7280',
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS installers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  zone TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  company_name TEXT,
  siret TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  surface INT,
  nb_led INT,
  puissance_pac NUMERIC,
  nb_panneaux INT,
  montant_devis NUMERIC,
  source TEXT,
  notes_admin TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  status_id UUID REFERENCES statuses(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  installer_id UUID REFERENCES installers(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prospect_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(prospect_id, user_id)
);

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  file_size INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  due_date TIMESTAMPTZ NOT NULL,
  message TEXT DEFAULT '',
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status_id);
CREATE INDEX IF NOT EXISTS idx_prospects_product ON prospects(product_id);
CREATE INDEX IF NOT EXISTS idx_prospects_category ON prospects(category_id);
CREATE INDEX IF NOT EXISTS idx_prospects_installer ON prospects(installer_id);
CREATE INDEX IF NOT EXISTS idx_prospects_created_by ON prospects(created_by);
CREATE INDEX IF NOT EXISTS idx_prospects_updated ON prospects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_city ON prospects(city);
CREATE INDEX IF NOT EXISTS idx_assignments_prospect ON prospect_assignments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON prospect_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_prospect ON notes(prospect_id);
CREATE INDEX IF NOT EXISTS idx_activity_prospect ON activity_logs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date);

-- ============================================================
-- 4. HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_prospect_access(p_prospect_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  IF is_admin() THEN RETURN true; END IF;
  RETURN EXISTS (SELECT 1 FROM prospect_assignments WHERE prospect_id = p_prospect_id AND user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE installers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to avoid conflicts
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR is_admin());

-- Reference tables: tout le monde lit, admin seul écrit
CREATE POLICY "cat_select" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_insert" ON categories FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "cat_update" ON categories FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "cat_delete" ON categories FOR DELETE TO authenticated USING (is_admin());

CREATE POLICY "stat_select" ON statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "stat_insert" ON statuses FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "stat_update" ON statuses FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "stat_delete" ON statuses FOR DELETE TO authenticated USING (is_admin());

CREATE POLICY "prod_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_insert" ON products FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "prod_update" ON products FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "prod_delete" ON products FOR DELETE TO authenticated USING (is_admin());

CREATE POLICY "inst_select" ON installers FOR SELECT TO authenticated USING (true);
CREATE POLICY "inst_insert" ON installers FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "inst_update" ON installers FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "inst_delete" ON installers FOR DELETE TO authenticated USING (is_admin());

-- Prospects
CREATE POLICY "prosp_select" ON prospects FOR SELECT TO authenticated USING (is_admin() OR has_prospect_access(id));
CREATE POLICY "prosp_insert" ON prospects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prosp_update" ON prospects FOR UPDATE TO authenticated USING (is_admin() OR has_prospect_access(id));
CREATE POLICY "prosp_delete" ON prospects FOR DELETE TO authenticated USING (is_admin());

-- Assignments
CREATE POLICY "assign_select" ON prospect_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "assign_insert" ON prospect_assignments FOR INSERT TO authenticated WITH CHECK (is_admin() OR user_id = auth.uid());
CREATE POLICY "assign_delete" ON prospect_assignments FOR DELETE TO authenticated USING (is_admin() OR user_id = auth.uid());

-- Notes
CREATE POLICY "notes_select" ON notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "notes_insert" ON notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notes_delete" ON notes FOR DELETE TO authenticated USING (user_id = auth.uid() OR is_admin());

-- Documents
CREATE POLICY "docs_select" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "docs_insert" ON documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "docs_delete" ON documents FOR DELETE TO authenticated USING (user_id = auth.uid() OR is_admin());

-- Reminders
CREATE POLICY "rem_select" ON reminders FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "rem_insert" ON reminders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rem_update" ON reminders FOR UPDATE TO authenticated USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "rem_delete" ON reminders FOR DELETE TO authenticated USING (user_id = auth.uid() OR is_admin());

-- Activity Logs
CREATE POLICY "logs_select" ON activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "logs_insert" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 6. STORAGE BUCKET (documents)
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT DO NOTHING;

DO $$ BEGIN
  DROP POLICY IF EXISTS "doc_storage_select" ON storage.objects;
  DROP POLICY IF EXISTS "doc_storage_insert" ON storage.objects;
  DROP POLICY IF EXISTS "doc_storage_delete" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "doc_storage_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "doc_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "doc_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');

-- ============================================================
-- 7. RPC FUNCTIONS
-- ============================================================

-- Search prospects with full filtering + pagination
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
  p_per_page INT DEFAULT 50
) RETURNS JSONB AS $$
DECLARE
  v_offset INT := (p_page - 1) * p_per_page;
  v_is_admin BOOLEAN;
  v_uid UUID := auth.uid();
  v_total INT;
  v_data JSONB;
BEGIN
  v_is_admin := EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND role = 'admin' AND active = true);

  WITH filtered AS (
    SELECT p.*
    FROM prospects p
    LEFT JOIN prospect_assignments pa ON pa.prospect_id = p.id
    WHERE
      (p_search = '' OR
        p.company_name ILIKE '%' || p_search || '%' OR
        p.last_name ILIKE '%' || p_search || '%' OR
        p.first_name ILIKE '%' || p_search || '%' OR
        p.phone ILIKE '%' || p_search || '%' OR
        p.city ILIKE '%' || p_search || '%' OR
        p.email ILIKE '%' || p_search || '%' OR
        p.siret ILIKE '%' || p_search || '%')
      AND (p_product_ids IS NULL OR p.product_id = ANY(p_product_ids))
      AND (p_category_ids IS NULL OR p.category_id = ANY(p_category_ids))
      AND (p_status_ids IS NULL OR p.status_id = ANY(p_status_ids))
      AND (p_installer_ids IS NULL OR p.installer_id = ANY(p_installer_ids))
      AND (NOT p_no_product OR p.product_id IS NULL)
      AND (NOT p_no_installer OR p.installer_id IS NULL)
      AND (p_date_from IS NULL OR p.created_at >= p_date_from)
      AND (p_date_to IS NULL OR p.created_at <= p_date_to)
      AND (p_user_ids IS NULL OR pa.user_id = ANY(p_user_ids))
      AND (NOT p_unassigned OR NOT EXISTS (SELECT 1 FROM prospect_assignments pa2 WHERE pa2.prospect_id = p.id))
      AND (v_is_admin OR EXISTS (SELECT 1 FROM prospect_assignments pa3 WHERE pa3.prospect_id = p.id AND pa3.user_id = v_uid))
    GROUP BY p.id
  ),
  counted AS (SELECT count(*) AS total FROM filtered),
  sorted AS (
    SELECT f.*
    FROM filtered f
    ORDER BY
      CASE WHEN p_sort_dir = 'asc' THEN
        CASE p_sort_col
          WHEN 'company_name' THEN f.company_name
          WHEN 'city' THEN f.city
          WHEN 'updated_at' THEN f.updated_at::TEXT
          WHEN 'created_at' THEN f.created_at::TEXT
          ELSE f.updated_at::TEXT
        END
      END ASC NULLS LAST,
      CASE WHEN p_sort_dir = 'desc' THEN
        CASE p_sort_col
          WHEN 'company_name' THEN f.company_name
          WHEN 'city' THEN f.city
          WHEN 'updated_at' THEN f.updated_at::TEXT
          WHEN 'created_at' THEN f.created_at::TEXT
          ELSE f.updated_at::TEXT
        END
      END DESC NULLS LAST
    LIMIT p_per_page OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    jsonb_agg(
      to_jsonb(s) ||
      jsonb_build_object(
        'category', (SELECT to_jsonb(c) FROM categories c WHERE c.id = s.category_id),
        'status', (SELECT to_jsonb(st) FROM statuses st WHERE st.id = s.status_id),
        'product', (SELECT to_jsonb(pr) FROM products pr WHERE pr.id = s.product_id),
        'installer', (SELECT to_jsonb(i) FROM installers i WHERE i.id = s.installer_id),
        'assignments', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('user_id', pa.user_id, 'profile', to_jsonb(prof)))
          FROM prospect_assignments pa
          JOIN profiles prof ON prof.id = pa.user_id
          WHERE pa.prospect_id = s.id
        ), '[]'::jsonb)
      )
    )
  INTO v_total, v_data
  FROM sorted s;

  RETURN jsonb_build_object('data', COALESCE(v_data, '[]'::jsonb), 'total', COALESCE(v_total, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Counts for sidebar
CREATE OR REPLACE FUNCTION get_prospect_counts() RETURNS JSONB AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  v_is_admin := EXISTS (SELECT 1 FROM profiles WHERE id = v_uid AND role = 'admin' AND active = true);

  WITH accessible AS (
    SELECT DISTINCT p.id, p.status_id, p.product_id, p.category_id, p.installer_id
    FROM prospects p
    LEFT JOIN prospect_assignments pa ON pa.prospect_id = p.id
    WHERE v_is_admin OR pa.user_id = v_uid
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM accessible),
    'by_status', COALESCE((SELECT jsonb_object_agg(status_id, cnt) FROM (SELECT status_id, count(*) AS cnt FROM accessible WHERE status_id IS NOT NULL GROUP BY status_id) x), '{}'::jsonb),
    'by_product', COALESCE((SELECT jsonb_object_agg(product_id, cnt) FROM (SELECT product_id, count(*) AS cnt FROM accessible WHERE product_id IS NOT NULL GROUP BY product_id) x), '{}'::jsonb),
    'by_category', COALESCE((SELECT jsonb_object_agg(category_id, cnt) FROM (SELECT category_id, count(*) AS cnt FROM accessible WHERE category_id IS NOT NULL GROUP BY category_id) x), '{}'::jsonb),
    'by_installer', COALESCE((SELECT jsonb_object_agg(installer_id, cnt) FROM (SELECT installer_id, count(*) AS cnt FROM accessible WHERE installer_id IS NOT NULL GROUP BY installer_id) x), '{}'::jsonb),
    'by_user', COALESCE((SELECT jsonb_object_agg(user_id, cnt) FROM (SELECT pa.user_id, count(DISTINCT pa.prospect_id) AS cnt FROM prospect_assignments pa JOIN accessible a ON a.id = pa.prospect_id GROUP BY pa.user_id) x), '{}'::jsonb),
    'unassigned', (SELECT count(*) FROM accessible a WHERE NOT EXISTS (SELECT 1 FROM prospect_assignments pa WHERE pa.prospect_id = a.id))
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Export CSV
CREATE OR REPLACE FUNCTION export_prospects(
  p_search TEXT DEFAULT '',
  p_product_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_status_ids UUID[] DEFAULT NULL,
  p_installer_ids UUID[] DEFAULT NULL,
  p_user_ids UUID[] DEFAULT NULL
) RETURNS SETOF JSONB AS $$
BEGIN
  RETURN QUERY
  SELECT to_jsonb(row) FROM (
    SELECT p.first_name, p.last_name, p.company_name, p.siret, p.phone, p.email,
           p.address, p.postal_code, p.city, p.surface, p.nb_led,
           COALESCE(s.name,'') AS statut, COALESCE(pr.name,'') AS produit,
           COALESCE(c.name,'') AS categorie, COALESCE(i.name,'') AS installateur,
           p.created_at, p.updated_at
    FROM prospects p
    LEFT JOIN statuses s ON s.id = p.status_id
    LEFT JOIN products pr ON pr.id = p.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN installers i ON i.id = p.installer_id
    LEFT JOIN prospect_assignments pa ON pa.prospect_id = p.id
    WHERE
      (p_search = '' OR p.company_name ILIKE '%'||p_search||'%' OR p.last_name ILIKE '%'||p_search||'%' OR p.phone ILIKE '%'||p_search||'%')
      AND (p_product_ids IS NULL OR p.product_id = ANY(p_product_ids))
      AND (p_category_ids IS NULL OR p.category_id = ANY(p_category_ids))
      AND (p_status_ids IS NULL OR p.status_id = ANY(p_status_ids))
      AND (p_installer_ids IS NULL OR p.installer_id = ANY(p_installer_ids))
      AND (p_user_ids IS NULL OR pa.user_id = ANY(p_user_ids))
    GROUP BY p.id, s.name, pr.name, c.name, i.name
    ORDER BY p.updated_at DESC
    LIMIT 10000
  ) row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Map data
CREATE OR REPLACE FUNCTION get_map_data(
  p_search TEXT DEFAULT '',
  p_product_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_status_ids UUID[] DEFAULT NULL,
  p_installer_ids UUID[] DEFAULT NULL,
  p_user_ids UUID[] DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF JSONB AS $$
BEGIN
  RETURN QUERY
  SELECT to_jsonb(row) FROM (
    SELECT p.id, p.company_name, p.first_name, p.last_name, p.city, p.latitude, p.longitude, p.status_id
    FROM prospects p
    LEFT JOIN prospect_assignments pa ON pa.prospect_id = p.id
    WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      AND (p_search = '' OR p.company_name ILIKE '%'||p_search||'%' OR p.city ILIKE '%'||p_search||'%')
      AND (p_product_ids IS NULL OR p.product_id = ANY(p_product_ids))
      AND (p_category_ids IS NULL OR p.category_id = ANY(p_category_ids))
      AND (p_status_ids IS NULL OR p.status_id = ANY(p_status_ids))
      AND (p_installer_ids IS NULL OR p.installer_id = ANY(p_installer_ids))
      AND (p_user_ids IS NULL OR pa.user_id = ANY(p_user_ids))
      AND (p_date_from IS NULL OR p.created_at >= p_date_from)
      AND (p_date_to IS NULL OR p.created_at <= p_date_to)
    GROUP BY p.id
    LIMIT 5000
  ) row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- User performance stats
CREATE OR REPLACE FUNCTION get_user_performance(p_period TEXT DEFAULT 'month') RETURNS JSONB AS $$
DECLARE
  v_from TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  v_from := CASE p_period
    WHEN 'today' THEN date_trunc('day', now())
    WHEN 'week' THEN date_trunc('week', now())
    WHEN 'month' THEN date_trunc('month', now())
    WHEN 'quarter' THEN date_trunc('quarter', now())
    WHEN 'year' THEN date_trunc('year', now())
    ELSE date_trunc('month', now())
  END;

  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'created_period', (SELECT count(*) FROM prospects WHERE created_at >= v_from),
      'total_notes_period', (SELECT count(*) FROM notes WHERE created_at >= v_from)
    ),
    'users', COALESCE((
      SELECT jsonb_agg(to_jsonb(u))
      FROM (
        SELECT
          p.id, p.first_name, p.last_name, p.email, p.role,
          (SELECT count(*) FROM prospects WHERE created_by = p.id AND created_at >= v_from) AS created_count,
          (SELECT count(*) FROM prospects WHERE created_by = p.id) AS created_total,
          (SELECT count(*) FROM activity_logs WHERE user_id = p.id AND action = 'update' AND created_at >= v_from) AS updates_count,
          (SELECT count(*) FROM notes WHERE user_id = p.id AND created_at >= v_from) AS notes_count,
          (SELECT count(*) FROM notes WHERE user_id = p.id) AS notes_total,
          (SELECT count(*) FROM activity_logs WHERE user_id = p.id AND action = 'status_change' AND created_at >= v_from) AS status_changes,
          (SELECT count(DISTINCT prospect_id) FROM prospect_assignments WHERE user_id = p.id) AS assigned_count,
          (SELECT count(*) FROM activity_logs WHERE user_id = p.id AND created_at >= v_from) AS total_actions,
          (SELECT max(created_at) FROM activity_logs WHERE user_id = p.id) AS last_activity,
          COALESCE((
            SELECT jsonb_object_agg(s.id::text, cnt)
            FROM (
              SELECT pr.status_id AS id, count(*) AS cnt
              FROM prospect_assignments pa
              JOIN prospects pr ON pr.id = pa.prospect_id
              WHERE pa.user_id = p.id AND pr.status_id IS NOT NULL
              GROUP BY pr.status_id
            ) s
          ), '{}'::jsonb) AS by_status,
          COALESCE((
            SELECT jsonb_agg(to_jsonb(n))
            FROM (
              SELECT n.content, n.created_at, pr.company_name, pr.first_name AS p_first_name, pr.last_name AS p_last_name
              FROM notes n LEFT JOIN prospects pr ON pr.id = n.prospect_id
              WHERE n.user_id = p.id ORDER BY n.created_at DESC LIMIT 5
            ) n
          ), '[]'::jsonb) AS recent_notes,
          COALESCE((
            SELECT jsonb_agg(to_jsonb(a))
            FROM (
              SELECT action, created_at FROM activity_logs WHERE user_id = p.id ORDER BY created_at DESC LIMIT 10
            ) a
          ), '[]'::jsonb) AS recent_actions
        FROM profiles p
        WHERE p.active = true
        ORDER BY (SELECT count(*) FROM activity_logs WHERE user_id = p.id AND created_at >= v_from) DESC
      ) u
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7b. FOREIGN KEYS → profiles (required for PostgREST joins)
-- ============================================================
-- Without these, select('*, profile:profiles(...)') fails silently

DO $$ BEGIN
  ALTER TABLE notes ADD CONSTRAINT notes_user_profile_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE documents ADD CONSTRAINT documents_user_profile_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE reminders ADD CONSTRAINT reminders_user_profile_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_profile_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE prospect_assignments ADD CONSTRAINT assignments_user_profile_fk FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 8. REALTIME
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE prospects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE prospect_assignments;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notes;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE documents;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE reminders;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- 9. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(SPLIT_PART(NEW.email, '@', 1), ''), '', 'user')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 10. PROMOTE EXISTING USERS + CREATE MISSING PROFILES
-- ============================================================

-- Create profiles for any auth users that don't have one
INSERT INTO profiles (id, email, first_name, last_name, role, active)
SELECT id, email, SPLIT_PART(email, '@', 1), '', 'admin', true
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT DO NOTHING;

-- Make the first user admin
UPDATE profiles SET role = 'admin', active = true
WHERE id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);

-- ============================================================
-- 11. SEED DATA
-- ============================================================

-- Clean up any duplicate categories from previous runs
DELETE FROM categories WHERE id NOT IN (
  SELECT DISTINCT ON (name) id FROM categories ORDER BY name, created_at ASC
);

-- Add unique constraint if missing (safe for re-runs)
DO $$ BEGIN
  ALTER TABLE categories ADD CONSTRAINT categories_name_key UNIQUE (name);
EXCEPTION WHEN duplicate_table THEN NULL;
WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO statuses (name, code, color, position, is_final) VALUES
  ('Nouveau', 'nouveau', '#3B82F6', 1, false),
  ('À rappeler', 'a_rappeler', '#F59E0B', 2, false),
  ('En cours', 'en_cours', '#8B5CF6', 3, false),
  ('Devis envoyé', 'devis_envoye', '#06B6D4', 4, false),
  ('Signé', 'signe', '#10B981', 5, true),
  ('Refusé', 'refuse', '#EF4444', 6, true),
  ('Hors cible', 'hors_cible', '#6B7280', 7, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO products (name, code, color, position) VALUES
  ('LED', 'led', '#10B981', 1),
  ('PAC', 'pac', '#3B82F6', 2),
  ('Panneaux Solaires', 'panneaux', '#F59E0B', 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO categories (name, color, position) VALUES
  ('Prospect', '#6B7280', 1),
  ('Client', '#10B981', 2),
  ('Partenaire', '#8B5CF6', 3)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 12. VERIFICATION
-- ============================================================

DO $$ DECLARE
  v_admin INT;
  v_tables INT;
BEGIN
  SELECT count(*) INTO v_admin FROM profiles WHERE role = 'admin' AND active = true;
  SELECT count(*) INTO v_tables FROM information_schema.tables WHERE table_schema = 'public';
  RAISE NOTICE '✅ GALLUBIX CRM Setup OK — % admins, % tables', v_admin, v_tables;
END $$;

SELECT role, active, email FROM profiles ORDER BY created_at LIMIT 5;
