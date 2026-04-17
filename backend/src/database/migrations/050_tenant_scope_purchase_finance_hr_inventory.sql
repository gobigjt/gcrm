-- Migration 050 — Tenant scope for purchase, finance, hr, inventory

ALTER TABLE brands ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE stock ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE grn ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE grn_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

UPDATE stock s
SET tenant_id = (SELECT p.tenant_id FROM products p WHERE p.id = s.product_id)
WHERE s.tenant_id IS NULL;

UPDATE stock_movements sm
SET tenant_id = COALESCE(
  (SELECT p.tenant_id FROM products p WHERE p.id = sm.product_id),
  (SELECT u.tenant_id FROM users u WHERE u.id = sm.created_by)
)
WHERE sm.tenant_id IS NULL;

UPDATE purchase_orders po
SET tenant_id = COALESCE(
  (SELECT v.tenant_id FROM vendors v WHERE v.id = po.vendor_id),
  (SELECT u.tenant_id FROM users u WHERE u.id = po.created_by)
)
WHERE po.tenant_id IS NULL;

UPDATE purchase_order_items poi
SET tenant_id = (SELECT po.tenant_id FROM purchase_orders po WHERE po.id = poi.po_id)
WHERE poi.tenant_id IS NULL;

UPDATE grn g
SET tenant_id = COALESCE(
  (SELECT po.tenant_id FROM purchase_orders po WHERE po.id = g.po_id),
  (SELECT u.tenant_id FROM users u WHERE u.id = g.created_by)
)
WHERE g.tenant_id IS NULL;

UPDATE grn_items gi
SET tenant_id = (SELECT g.tenant_id FROM grn g WHERE g.id = gi.grn_id)
WHERE gi.tenant_id IS NULL;

UPDATE purchase_invoices pi
SET tenant_id = (SELECT v.tenant_id FROM vendors v WHERE v.id = pi.vendor_id)
WHERE pi.tenant_id IS NULL;

UPDATE journal_entries je
SET tenant_id = (SELECT u.tenant_id FROM users u WHERE u.id = je.created_by)
WHERE je.tenant_id IS NULL;

UPDATE journal_lines jl
SET tenant_id = (SELECT je.tenant_id FROM journal_entries je WHERE je.id = jl.entry_id)
WHERE jl.tenant_id IS NULL;

UPDATE expenses e
SET tenant_id = (SELECT u.tenant_id FROM users u WHERE u.id = e.created_by)
WHERE e.tenant_id IS NULL;

UPDATE employees e
SET tenant_id = (SELECT u.tenant_id FROM users u WHERE u.id = e.user_id)
WHERE e.tenant_id IS NULL;

UPDATE attendance a
SET tenant_id = (SELECT u.tenant_id FROM users u WHERE u.id = a.user_id)
WHERE a.tenant_id IS NULL;

UPDATE payroll p
SET tenant_id = (SELECT e.tenant_id FROM employees e WHERE e.id = p.employee_id)
WHERE p.tenant_id IS NULL;

DO $$
DECLARE
  v_default_tenant INTEGER;
BEGIN
  SELECT id INTO v_default_tenant FROM tenants WHERE slug='igloo-tiles' LIMIT 1;
  IF v_default_tenant IS NOT NULL THEN
    UPDATE brands SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE categories SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE products SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE warehouses SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE stock SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE stock_movements SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;

    UPDATE vendors SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE purchase_orders SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE purchase_order_items SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE grn SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE grn_items SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE purchase_invoices SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;

    UPDATE accounts SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE journal_entries SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE journal_lines SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE expenses SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;

    UPDATE employees SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE attendance SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    UPDATE payroll SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendors_tenant_id ON vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_id ON journal_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_id ON attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_tenant_id ON payroll(tenant_id);
