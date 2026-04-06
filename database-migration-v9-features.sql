-- RS CONSULTING CRM v9 — MIGRATION: Zone climatique, PAC commission, new fields
-- Execute on Supabase SQL Editor

-- Zone climatique (H1/H2/H3) auto-detected from postal code
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS zone_climatique TEXT;

-- PAC commission auto-calculated
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS commission_pac NUMERIC;

-- Type de ballon (electrique / thermodynamique)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ballon_type TEXT;

-- Type de chauffage existant
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS type_chauffage TEXT;

-- Date d'audit (avant chaque chantier)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS date_audit TIMESTAMPTZ;

-- Numéro fiscal
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS numero_fiscal TEXT;

-- Type de logement (maison / appartement)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS type_logement TEXT;

-- Type de projet (particulier / professionnel)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS type_projet TEXT;

-- Surface bâtiment (ITI)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS surface_batiment NUMERIC;

-- Surface mur intérieur à isoler (ITI)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS surface_mur_interieur NUMERIC;

-- Surface mur extérieur à isoler (ITI)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS surface_mur_exterieur NUMERIC;

-- Surface fenêtre à isoler (ITI)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS surface_fenetre NUMERIC;

-- PAC/Split checkbox (ITI — alternative à VMC)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS has_pac_split BOOLEAN DEFAULT false;
