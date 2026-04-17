-- Migration 051 — Tenant hardening constraints and scoped uniqueness

DO $$
DECLARE
  v_default_tenant INTEGER;
BEGIN
  SELECT id INTO v_default_tenant FROM tenants WHERE slug='igloo-tiles' LIMIT 1;
  IF v_default_tenant IS NOT NULL THEN
    UPDATE users SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
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

ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE brands ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE products ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE warehouses ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE stock ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE stock_movements ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE vendors ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE purchase_order_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE grn ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE grn_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE purchase_invoices ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE journal_entries ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE journal_lines ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employees ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE attendance ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payroll ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'brands_tenant_id_fkey') THEN
    ALTER TABLE brands ADD CONSTRAINT brands_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_tenant_id_fkey') THEN
    ALTER TABLE categories ADD CONSTRAINT categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_tenant_id_fkey') THEN
    ALTER TABLE products ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouses_tenant_id_fkey') THEN
    ALTER TABLE warehouses ADD CONSTRAINT warehouses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_tenant_id_fkey') THEN
    ALTER TABLE stock ADD CONSTRAINT stock_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_tenant_id_fkey') THEN
    ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_tenant_id_fkey') THEN
    ALTER TABLE vendors ADD CONSTRAINT vendors_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_tenant_id_fkey') THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_tenant_id_fkey') THEN
    ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grn_tenant_id_fkey') THEN
    ALTER TABLE grn ADD CONSTRAINT grn_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grn_items_tenant_id_fkey') THEN
    ALTER TABLE grn_items ADD CONSTRAINT grn_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_invoices_tenant_id_fkey') THEN
    ALTER TABLE purchase_invoices ADD CONSTRAINT purchase_invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_tenant_id_fkey') THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_tenant_id_fkey') THEN
    ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_lines_tenant_id_fkey') THEN
    ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_tenant_id_fkey') THEN
    ALTER TABLE expenses ADD CONSTRAINT expenses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_tenant_id_fkey') THEN
    ALTER TABLE employees ADD CONSTRAINT employees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_tenant_id_fkey') THEN
    ALTER TABLE attendance ADD CONSTRAINT attendance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_tenant_id_fkey') THEN
    ALTER TABLE payroll ADD CONSTRAINT payroll_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_email ON users(tenant_id, email);

ALTER TABLE brands DROP CONSTRAINT IF EXISTS brands_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_tenant_name ON brands(tenant_id, name);

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_tenant_name ON categories(tenant_id, name);

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
DROP INDEX IF EXISTS products_code_uq;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_tenant_sku ON products(tenant_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_tenant_code ON products(tenant_id, code) WHERE code IS NOT NULL;
