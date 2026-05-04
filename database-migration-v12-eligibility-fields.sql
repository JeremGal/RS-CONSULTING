-- =====================================================
-- Migration V12: Additional eligibility fields from Fiche PRO
-- =====================================================

-- Destratificateur fields
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS batiment_chauffe TEXT; -- 'oui_totalite', 'oui_partiellement', 'non'
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS chaudiere_remplacee_2017 BOOLEAN DEFAULT false;

-- HP Flottante fields
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS gtb_gtc_installe BOOLEAN DEFAULT false;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS groupe_ancien_neuf TEXT; -- 'ancien' or 'neuf'
