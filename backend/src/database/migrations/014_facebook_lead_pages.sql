-- ============================================================
-- Lead Generation Platforms (Facebook Pages)
-- ============================================================
-- Stores connected Facebook Pages for lead ads / lead forms
-- integration. Each page can be mapped to a `lead_sources` row
-- (defaults to 'Facebook Ads' when not provided).

CREATE TABLE IF NOT EXISTS lead_platform_facebook_pages (
  id                    SERIAL PRIMARY KEY,
  page_id               VARCHAR(50) NOT NULL UNIQUE,
  page_name             VARCHAR(200),
  page_access_token    TEXT,
  lead_source_id        INTEGER REFERENCES lead_sources(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_platform_facebook_pages_source
  ON lead_platform_facebook_pages(lead_source_id);

