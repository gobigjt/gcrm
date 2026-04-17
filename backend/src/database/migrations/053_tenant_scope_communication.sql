-- Migration 053 — Tenant scope for communication templates/logs

ALTER TABLE comm_templates ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- Backfill comm_logs from lead/user relationships when possible.
UPDATE comm_logs cl
SET tenant_id = COALESCE(
  (SELECT l.tenant_id FROM leads l WHERE l.id = cl.lead_id),
  (SELECT u.tenant_id FROM users u WHERE u.id = cl.sent_by)
)
WHERE cl.tenant_id IS NULL;

-- Backfill remaining NULLs to default tenant (single-tenant legacy safety).
DO $$
DECLARE
  v_default_tenant INTEGER;
BEGIN
  SELECT id INTO v_default_tenant FROM tenants WHERE slug='igloo-tiles' LIMIT 1;
  IF v_default_tenant IS NOT NULL THEN
    UPDATE comm_logs SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE comm_templates SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comm_templates_tenant_id_fkey'
  ) THEN
    ALTER TABLE comm_templates
      ADD CONSTRAINT comm_templates_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comm_logs_tenant_id_fkey'
  ) THEN
    ALTER TABLE comm_logs
      ADD CONSTRAINT comm_logs_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_comm_templates_tenant_id ON comm_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_tenant_id ON comm_logs(tenant_id);
