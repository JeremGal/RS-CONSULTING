-- =============================================
-- Migration: Chat Channels + DM system
-- Run this in Supabase SQL Editor
-- =============================================

-- 1) Table des salons (publics + DMs)
CREATE TABLE IF NOT EXISTS chat_channels (
  id text PRIMARY KEY,                        -- ex: 'general', 'iti', 'dm_uuid1_uuid2'
  name text NOT NULL,                         -- Nom affiché
  type text NOT NULL DEFAULT 'public'         -- 'public' ou 'dm'
    CHECK (type IN ('public', 'dm')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 2) Membres des conversations DM
CREATE TABLE IF NOT EXISTS chat_dm_members (
  channel_id text REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);

-- 3) Seed: insérer les salons existants
INSERT INTO chat_channels (id, name, type) VALUES
  ('general', 'Général', 'public'),
  ('iti', 'ITI', 'public'),
  ('pac', 'PAC', 'public')
ON CONFLICT (id) DO NOTHING;

-- 4) RLS sur chat_channels
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;

-- SELECT: public channels visibles par tous,
-- DM visibles par les membres OU par l'admin
CREATE POLICY chat_channels_select ON chat_channels FOR SELECT USING (
  type = 'public'
  OR EXISTS (SELECT 1 FROM chat_dm_members WHERE channel_id = id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- INSERT: admin peut créer des salons publics, tout le monde peut créer des DMs
CREATE POLICY chat_channels_insert ON chat_channels FOR INSERT WITH CHECK (
  (type = 'dm')
  OR (type = 'public' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
);

-- DELETE: seul l'admin peut supprimer un salon public
CREATE POLICY chat_channels_delete ON chat_channels FOR DELETE USING (
  type = 'public' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5) RLS sur chat_dm_members
ALTER TABLE chat_dm_members ENABLE ROW LEVEL SECURITY;

-- SELECT: voir ses propres DMs OU admin voit tout
CREATE POLICY dm_members_select ON chat_dm_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- INSERT: tout le monde peut ajouter des membres (à la création d'un DM)
CREATE POLICY dm_members_insert ON chat_dm_members FOR INSERT WITH CHECK (true);

-- 6) Mettre à jour la politique SELECT sur chat_messages pour que:
--    - Messages de salons publics: visibles par tous (déjà ok avec la policy existante using=true)
--    - Messages DM: visibles par les membres du DM OU admin
-- NOTE: La politique actuelle est "using=true" (tout le monde voit tout).
-- On la remplace pour filtrer les DMs.
DROP POLICY IF EXISTS chat_select ON chat_messages;
CREATE POLICY chat_select ON chat_messages FOR SELECT USING (
  -- Public channel messages: visible to all authenticated users
  NOT starts_with(channel, 'dm_')
  -- DM messages: visible to participants or admin
  OR EXISTS (SELECT 1 FROM chat_dm_members WHERE channel_id = channel AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 7) Activer realtime pour les nouvelles tables
ALTER PUBLICATION supabase_realtime ADD TABLE chat_channels;
