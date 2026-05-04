-- =====================================================
-- Migration V11: New products + eligibility fields
-- Products: Destratificateur tertiaire/industriel, Déshumidificateur serre, VMC serre, Haute pression flottante
-- =====================================================

-- 1. New columns on prospects table
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS type_projet TEXT; -- 'pro' or 'particulier'
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS type_cible TEXT; -- target type dropdown
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS hauteur_sous_plafond NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS puissance_chauffage NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS groupe_froid_existant BOOLEAN DEFAULT false;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS surface_groupe_froid NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS puissance_electrique NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS surface_serre NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS serre_electrifiee BOOLEAN DEFAULT false;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS type_serre TEXT; -- 'maraichere' or 'horticole'
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS statut_occupation TEXT; -- 'proprietaire' or 'locataire'
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS deja_prime_cee_deshumidificateur BOOLEAN DEFAULT false;

-- 2. Insert new products (skip if they already exist by name)
INSERT INTO products (name, code, color, position)
SELECT 'Destratificateur tertiaire', 'destrat_tertiaire_' || to_char(now(), 'YYMMDD'), '#8B5CF6', COALESCE((SELECT MAX(position) FROM products), 0) + 1
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name ILIKE '%destrat%tertiaire%');

INSERT INTO products (name, code, color, position)
SELECT 'Destratificateur industriel', 'destrat_industriel_' || to_char(now(), 'YYMMDD'), '#6366F1', COALESCE((SELECT MAX(position) FROM products), 0) + 2
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name ILIKE '%destrat%industriel%');

INSERT INTO products (name, code, color, position)
SELECT 'Déshumidificateur serre agricole', 'deshumidificateur_' || to_char(now(), 'YYMMDD'), '#14B8A6', COALESCE((SELECT MAX(position) FROM products), 0) + 3
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name ILIKE '%deshumidificateur%');

INSERT INTO products (name, code, color, position)
SELECT 'VMC serre agricole', 'vmc_serre_' || to_char(now(), 'YYMMDD'), '#F97316', COALESCE((SELECT MAX(position) FROM products), 0) + 4
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name ILIKE '%vmc%serre%');

INSERT INTO products (name, code, color, position)
SELECT 'Haute pression flottante', 'haute_pression_' || to_char(now(), 'YYMMDD'), '#EC4899', COALESCE((SELECT MAX(position) FROM products), 0) + 5
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name ILIKE '%haute%pression%');
