-- ============================================================
-- Migration 020 — Keep only Super Admin, Admin, Sales Executive, HR
--
-- Removes other system roles, reassigns affected users to Sales Executive,
-- rebuilds role_permissions, tightens module_settings, and reseeds demo users.
-- ============================================================

BEGIN;

-- Ensure the four roles exist (idempotent)
INSERT INTO roles (name, description, is_system) VALUES
  ('Super Admin',     'Platform operator (multi-tenant SaaS)', TRUE),
  ('Admin',           'Full company access (CRM, HR, users, settings)', TRUE),
  ('Sales Executive', 'Field sales & CRM', TRUE),
  ('HR',              'Human resources access', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Demo / legacy users on removed roles → remove (fresh demo set below)
DELETE FROM users WHERE email IN (
  'demo.manager@example.com',
  'demo.agent@example.com',
  'demo.accountant@example.com',
  'demo.inventory@example.com',
  'demo.sales.manager@example.com'
);

-- Any remaining users still pointing at roles we drop → Sales Executive
UPDATE users u
SET role_id = (SELECT id FROM roles WHERE name = 'Sales Executive' LIMIT 1)
WHERE role_id IN (
  SELECT id FROM roles WHERE name IN (
    'Manager', 'Sales Manager', 'Agent', 'Accountant', 'Inventory'
  )
);

-- Drop permissions rows for removed roles
DELETE FROM role_permissions WHERE role_id IN (
  SELECT id FROM roles WHERE name IN (
    'Manager', 'Sales Manager', 'Agent', 'Accountant', 'Inventory'
  )
);

DELETE FROM roles WHERE name IN (
  'Manager', 'Sales Manager', 'Agent', 'Accountant', 'Inventory'
);

-- Rebuild permissions for the four kept roles
DELETE FROM role_permissions WHERE role_id IN (
  SELECT id FROM roles WHERE name IN ('Super Admin', 'Admin', 'Sales Executive', 'HR')
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Super Admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.module IN ('crm', 'communication', 'hr', 'settings', 'users')
WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

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
  ON p.module IN ('hr', 'communication')
 AND p.action IN ('view', 'view_all', 'create', 'edit', 'edit_all')
WHERE r.name = 'HR'
ON CONFLICT DO NOTHING;

-- Module access: only these four roles; turn off removed product areas
UPDATE module_settings SET
  allowed_roles = ARRAY['Super Admin', 'Admin', 'Sales Executive', 'HR']::text[],
  updated_at = NOW();

UPDATE module_settings SET
  is_enabled = FALSE,
  updated_at = NOW()
WHERE module IN ('sales', 'purchase', 'inventory', 'production', 'finance');

UPDATE module_settings SET
  is_enabled = TRUE,
  updated_at = NOW()
WHERE module IN ('crm', 'communication', 'hr', 'settings', 'users');

-- Demo logins (password Demo@123 — same bcrypt as 012 / 013)
INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo Super Admin', 'demo.super@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'Super Admin'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo Admin', 'demo.admin@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'Admin'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo Sales Executive', 'demo.sales.executive@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'Sales Executive'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo HR', 'demo.hr@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'HR'
ON CONFLICT (email) DO NOTHING;

COMMIT;
