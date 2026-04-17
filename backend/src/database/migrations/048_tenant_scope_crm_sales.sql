-- Migration 048 — Tenant scope for CRM and Sales data
-- Adds tenant_id to core CRM/Sales tables and backfills from existing relations.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE lead_followups ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE sale_return_payments ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

UPDATE leads l
SET tenant_id = COALESCE(
  (SELECT u.tenant_id FROM users u WHERE u.id = l.created_by),
  (SELECT u.tenant_id FROM users u WHERE u.id = l.assigned_to),
  (SELECT u.tenant_id FROM users u WHERE u.id = l.assigned_manager_id)
)
WHERE l.tenant_id IS NULL;

UPDATE leads l
SET tenant_id = u.tenant_id
FROM users u
WHERE l.tenant_id IS NULL
  AND u.id = l.assigned_to;

UPDATE leads l
SET tenant_id = u.tenant_id
FROM users u
WHERE l.tenant_id IS NULL
  AND u.id = l.assigned_manager_id;

UPDATE customers c
SET tenant_id = COALESCE(
  (SELECT u.tenant_id FROM users u WHERE u.id = c.created_by),
  (SELECT l.tenant_id FROM leads l WHERE l.id = c.lead_id)
)
WHERE c.tenant_id IS NULL;

UPDATE customers c
SET tenant_id = l.tenant_id
FROM leads l
WHERE c.tenant_id IS NULL
  AND l.id = c.lead_id;

UPDATE quotations q
SET tenant_id = COALESCE(
  (SELECT c.tenant_id FROM customers c WHERE c.id = q.customer_id),
  (SELECT u.tenant_id FROM users u WHERE u.id = q.created_by)
)
WHERE q.tenant_id IS NULL;

UPDATE sales_orders o
SET tenant_id = COALESCE(
  (SELECT c.tenant_id FROM customers c WHERE c.id = o.customer_id),
  (SELECT u.tenant_id FROM users u WHERE u.id = o.created_by)
)
WHERE o.tenant_id IS NULL;

UPDATE invoices i
SET tenant_id = COALESCE(
  (SELECT c.tenant_id FROM customers c WHERE c.id = i.customer_id),
  (SELECT u.tenant_id FROM users u WHERE u.id = i.created_by)
)
WHERE i.tenant_id IS NULL;

UPDATE payments p
SET tenant_id = i.tenant_id
FROM invoices i
WHERE p.tenant_id IS NULL
  AND i.id = p.invoice_id;

UPDATE sale_returns r
SET tenant_id = COALESCE(
  (SELECT c.tenant_id FROM customers c WHERE c.id = r.customer_id),
  (SELECT u.tenant_id FROM users u WHERE u.id = r.created_by)
)
WHERE r.tenant_id IS NULL;

UPDATE sale_return_payments rp
SET tenant_id = r.tenant_id
FROM sale_returns r
WHERE rp.tenant_id IS NULL
  AND r.id = rp.return_id;

UPDATE lead_activities a
SET tenant_id = l.tenant_id
FROM leads l
WHERE a.tenant_id IS NULL
  AND l.id = a.lead_id;

UPDATE lead_followups f
SET tenant_id = l.tenant_id
FROM leads l
WHERE f.tenant_id IS NULL
  AND l.id = f.lead_id;

DO $$
DECLARE
  v_default_tenant INTEGER;
BEGIN
  SELECT id INTO v_default_tenant FROM tenants WHERE slug = 'igloo-tiles' LIMIT 1;
  IF v_default_tenant IS NOT NULL THEN
    UPDATE leads SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE lead_activities SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE lead_followups SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE customers SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE quotations SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE sales_orders SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE invoices SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE payments SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE sale_returns SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE sale_return_payments SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_tenant_id_fkey') THEN
    ALTER TABLE leads ADD CONSTRAINT leads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_activities_tenant_id_fkey') THEN
    ALTER TABLE lead_activities ADD CONSTRAINT lead_activities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_followups_tenant_id_fkey') THEN
    ALTER TABLE lead_followups ADD CONSTRAINT lead_followups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_tenant_id_fkey') THEN
    ALTER TABLE customers ADD CONSTRAINT customers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotations_tenant_id_fkey') THEN
    ALTER TABLE quotations ADD CONSTRAINT quotations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_orders_tenant_id_fkey') THEN
    ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_tenant_id_fkey') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_tenant_id_fkey') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_returns_tenant_id_fkey') THEN
    ALTER TABLE sale_returns ADD CONSTRAINT sale_returns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_return_payments_tenant_id_fkey') THEN
    ALTER TABLE sale_return_payments ADD CONSTRAINT sale_return_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_tenant_id ON lead_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_followups_tenant_id ON lead_followups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant_id ON quotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_tenant_id ON sales_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_tenant_id ON sale_returns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_payments_tenant_id ON sale_return_payments(tenant_id);
