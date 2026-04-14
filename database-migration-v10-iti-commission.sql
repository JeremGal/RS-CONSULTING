-- ============================================
--  RS CONSULTING CRM — v10 ITI Commission Fields
-- ============================================
--  Ajoute les colonnes pour les commissions ITI (BAR-TH-174)
--  et l'option A/B pour certaines catégories Jaune
-- ============================================

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS commission_admin NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS commission_telepro NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS commission_fournisseur NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS iti_option TEXT CHECK (iti_option IN ('A','B') OR iti_option IS NULL);

COMMENT ON COLUMN prospects.commission_admin IS 'Commission Admin ITI (€)';
COMMENT ON COLUMN prospects.commission_telepro IS 'Commission Télépro ITI (€)';
COMMENT ON COLUMN prospects.commission_fournisseur IS 'Commission Fournisseur ITI (€)';
COMMENT ON COLUMN prospects.iti_option IS 'Option ITI A ou B (uniquement pour Jaune 90-110/-160 et Jaune 110-130/+160)';
