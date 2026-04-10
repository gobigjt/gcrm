CREATE TABLE IF NOT EXISTS lead_platform_google_sheets (
  id             SERIAL PRIMARY KEY,
  sheet_url      TEXT NOT NULL,
  sheet_gid      VARCHAR(50),
  lead_source_id INTEGER REFERENCES lead_sources(id) ON DELETE SET NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_platform_google_sheets_source
  ON lead_platform_google_sheets(lead_source_id);

