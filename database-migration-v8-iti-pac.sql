-- ============================================================
-- GALLUBIX CRM v8 — MIGRATION ITI + PAC
-- Ajouter les champs pour les produits ITI et PAC
-- + Calcul automatique catégorie aide (bleu/jaune/violet/rose)
-- ⚠️ AUCUNE DONNÉE EXISTANTE N'EST MODIFIÉE OU SUPPRIMÉE
-- ============================================================

-- 1. Nouveaux champs communs ITI & PAC
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS nb_personnes_foyer INT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS revenu_fiscal_ref NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS is_ile_de_france BOOLEAN DEFAULT false;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS categorie_aide TEXT CHECK (categorie_aide IN ('bleu', 'jaune', 'violet', 'rose'));

-- 2. Champs spécifiques ITI
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS reste_a_charge NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS surface_sous_sol NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS surface_comble NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS surface_isoler_total NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS has_vmc BOOLEAN DEFAULT false;

-- 3. Champs spécifiques PAC
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS surface_habitable NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS surface_chauffer NUMERIC;

-- 4. Index pour les nouveaux champs
CREATE INDEX IF NOT EXISTS idx_prospects_categorie_aide ON prospects(categorie_aide);
CREATE INDEX IF NOT EXISTS idx_prospects_nb_personnes ON prospects(nb_personnes_foyer);

-- ============================================================
-- FIN MIGRATION v8
-- ============================================================
