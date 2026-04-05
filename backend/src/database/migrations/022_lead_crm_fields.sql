-- ============================================================
-- Migration 022 — CRM lead fields (segment, job title, deal,
-- contact extras, tags) + numeric lead score for UI parity.
-- ============================================================

BEGIN;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_segment VARCHAR(10);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS job_title VARCHAR(150);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_size NUMERIC(15,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website VARCHAR(500);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE leads ALTER COLUMN lead_score DROP DEFAULT;
ALTER TABLE leads ALTER COLUMN lead_score TYPE NUMERIC(6,2)
  USING (LEAST(999.99::numeric, GREATEST(0::numeric, COALESCE(lead_score, 0)::numeric)));
ALTER TABLE leads ALTER COLUMN lead_score SET DEFAULT 0;

COMMIT;
