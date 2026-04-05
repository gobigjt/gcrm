-- ============================================================
-- Migration 021 — Product modules: CRM, Sales (orders/invoices),
-- Inventory, Users/Roles, HR, Settings only.
--
-- Disables: purchase, production, finance, communication.
-- Enables: crm, sales, inventory, hr, settings, users.
-- Rebuilds role_permissions for Admin, Sales Executive, HR.
-- ============================================================

BEGIN;

UPDATE module_settings SET
  is_enabled = FALSE,
  updated_at = NOW()
WHERE module IN ('purchase', 'production', 'finance', 'communication');

UPDATE module_settings SET
  is_enabled = TRUE,
  updated_at = NOW()
WHERE module IN ('crm', 'sales', 'inventory', 'hr', 'settings', 'users');

-- Admin → CRM, sales, inventory, HR, settings, users (no communication / removed modules)
DELETE FROM role_permissions WHERE role_id IN (
  SELECT id FROM roles WHERE name = 'Admin'
);
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.module IN ('crm', 'sales', 'inventory', 'hr', 'settings', 'users')
WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

-- Sales Executive → CRM + sales (field) + inventory read (products for quotes/orders)
DELETE FROM role_permissions WHERE role_id IN (
  SELECT id FROM roles WHERE name = 'Sales Executive'
);
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.module = 'crm'
 AND p.action IN ('view', 'view_all', 'create', 'edit', 'delete')
WHERE r.name = 'Sales Executive'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.module = 'sales'
 AND p.action IN ('view', 'view_all', 'create', 'edit', 'delete')
WHERE r.name = 'Sales Executive'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.module = 'inventory'
 AND p.action IN ('view', 'view_all')
WHERE r.name = 'Sales Executive'
ON CONFLICT DO NOTHING;

-- HR → HR only (communication module disabled)
DELETE FROM role_permissions WHERE role_id IN (
  SELECT id FROM roles WHERE name = 'HR'
);
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON p.module = 'hr'
 AND p.action IN ('view', 'view_all', 'create', 'edit', 'edit_all')
WHERE r.name = 'HR'
ON CONFLICT DO NOTHING;

COMMIT;
