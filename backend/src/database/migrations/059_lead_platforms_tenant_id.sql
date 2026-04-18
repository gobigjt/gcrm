-- Migration 059 — Tenant scope for lead capture platform tables (Facebook + Google Sheets)
-- Backfills existing rows to tenant_id = 1 when that tenant exists.

ALTER TABLE lead_platform_facebook_pages ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE lead_platform_facebook_leads ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE lead_platform_google_sheets ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tenants WHERE id = 1) THEN
    UPDATE lead_platform_facebook_pages SET tenant_id = 1 WHERE tenant_id IS DISTINCT FROM 1 OR tenant_id IS NULL;
    UPDATE lead_platform_facebook_leads SET tenant_id = 1 WHERE tenant_id IS DISTINCT FROM 1 OR tenant_id IS NULL;
    UPDATE lead_platform_google_sheets SET tenant_id = 1 WHERE tenant_id IS DISTINCT FROM 1 OR tenant_id IS NULL;
  ELSE
    RAISE NOTICE '059_lead_platforms_tenant_id: tenants.id = 1 not found; skipped backfill (set tenant_id manually)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_platform_facebook_pages_tenant_id_fkey') THEN
    ALTER TABLE lead_platform_facebook_pages
      ADD CONSTRAINT lead_platform_facebook_pages_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_platform_facebook_leads_tenant_id_fkey') THEN
    ALTER TABLE lead_platform_facebook_leads
      ADD CONSTRAINT lead_platform_facebook_leads_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_platform_google_sheets_tenant_id_fkey') THEN
    ALTER TABLE lead_platform_google_sheets
      ADD CONSTRAINT lead_platform_google_sheets_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lead_platform_facebook_pages_tenant_id ON lead_platform_facebook_pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_platform_facebook_leads_tenant_id ON lead_platform_facebook_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_platform_google_sheets_tenant_id ON lead_platform_google_sheets(tenant_id);

-- New rows omitting tenant_id default to tenant 1 when that tenant exists (matches legacy single-tenant installs).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tenants WHERE id = 1) THEN
    ALTER TABLE lead_platform_facebook_pages ALTER COLUMN tenant_id SET DEFAULT 1;
    ALTER TABLE lead_platform_facebook_leads ALTER COLUMN tenant_id SET DEFAULT 1;
    ALTER TABLE lead_platform_google_sheets ALTER COLUMN tenant_id SET DEFAULT 1;
  END IF;
END $$;
