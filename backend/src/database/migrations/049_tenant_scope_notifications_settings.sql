-- Migration 049 — Tenant scope for notifications and settings

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE notification_push_tokens ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE module_settings ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

UPDATE notifications n
SET tenant_id = u.tenant_id
FROM users u
WHERE n.tenant_id IS NULL
  AND u.id = n.user_id;

UPDATE notification_push_tokens t
SET tenant_id = u.tenant_id
FROM users u
WHERE t.tenant_id IS NULL
  AND u.id = t.user_id;

DO $$
DECLARE
  v_default_tenant INTEGER;
BEGIN
  SELECT id INTO v_default_tenant FROM tenants WHERE slug = 'igloo-tiles' LIMIT 1;
  IF v_default_tenant IS NOT NULL THEN
    UPDATE notifications SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE notification_push_tokens SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE company_settings SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE module_settings SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_tenant_id_fkey') THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_push_tokens_tenant_id_fkey') THEN
    ALTER TABLE notification_push_tokens ADD CONSTRAINT notification_push_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_settings_tenant_id_fkey') THEN
    ALTER TABLE company_settings ADD CONSTRAINT company_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'module_settings_tenant_id_fkey') THEN
    ALTER TABLE module_settings ADD CONSTRAINT module_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_push_tokens_tenant_id ON notification_push_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_tenant_id ON company_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_module_settings_tenant_id ON module_settings(tenant_id);
