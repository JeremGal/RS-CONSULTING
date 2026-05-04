-- Migration V13 : Ajout du champ type_site_activite
-- Ce champ stocke le type de site / activité du prospect (ex: usine, commerce, agriculteur...)
-- Il est utilisé pour recommander automatiquement le bon produit

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS type_site_activite TEXT;

-- Vérification
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'prospects' AND column_name = 'type_site_activite';
