-- ============================================================
-- Migration 009 — Lead forms enhancements
-- Adds form_key, title, and routing columns so the public
-- capture controller can look up forms and auto-assign leads.
-- ============================================================

ALTER TABLE lead_forms ADD COLUMN IF NOT EXISTS title             VARCHAR(255);
ALTER TABLE lead_forms ADD COLUMN IF NOT EXISTS form_key          VARCHAR(100) UNIQUE;
ALTER TABLE lead_forms ADD COLUMN IF NOT EXISTS default_source_id INTEGER REFERENCES lead_sources(id) ON DELETE SET NULL;
ALTER TABLE lead_forms ADD COLUMN IF NOT EXISTS default_stage_id  INTEGER REFERENCES lead_stages(id)  ON DELETE SET NULL;
ALTER TABLE lead_forms ADD COLUMN IF NOT EXISTS assigned_to       INTEGER REFERENCES users(id)         ON DELETE SET NULL;

-- Back-fill form_key from name for existing rows
UPDATE lead_forms SET form_key = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
 WHERE form_key IS NULL;
