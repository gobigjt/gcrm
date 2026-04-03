-- ============================================================
-- Lead Generation Platforms — Facebook Lead Imports
-- ============================================================
-- Tracks fetched Facebook Lead IDs so we don't import duplicates
-- and so we can map an imported Facebook lead to a CRM lead.

CREATE TABLE IF NOT EXISTS lead_platform_facebook_leads (
  id                 SERIAL PRIMARY KEY,
  page_id            VARCHAR(50) NOT NULL,
  form_id            VARCHAR(50) NOT NULL,
  facebook_lead_id  VARCHAR(50) NOT NULL UNIQUE,
  created_time      TIMESTAMPTZ,
  field_data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_data           JSONB NOT NULL DEFAULT '{}'::jsonb,
  crm_lead_id        INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_platform_facebook_leads_page
  ON lead_platform_facebook_leads(page_id);

CREATE INDEX IF NOT EXISTS idx_lead_platform_facebook_leads_form
  ON lead_platform_facebook_leads(form_id);

