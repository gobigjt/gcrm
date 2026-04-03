-- ============================================================
-- Migration 018 — Sales Executive & Sales Manager roles (showcase names)
--
-- Same permissions as Agent and Manager respectively; mobile app maps
-- these strings to the sales executive / sales manager personas.
--
-- Password Demo@123 (same bcrypt as 012 / 013):
--   demo.sales.executive@example.com — Sales Executive
--   demo.sales.manager@example.com   — Sales Manager
--
-- Legacy roles Agent / Manager remain; demo.agent@ and demo.manager@ unchanged.
-- ============================================================

INSERT INTO roles (name, description, is_system) VALUES
  ('Sales Executive', 'Field sales & CRM (same access as Agent)', TRUE),
  ('Sales Manager',   'Team pipeline & ops (same access as Manager)', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Sales Executive ← copy Agent permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r_new.id, rp.permission_id
FROM roles r_old
JOIN role_permissions rp ON rp.role_id = r_old.id
JOIN roles r_new ON r_new.name = 'Sales Executive'
WHERE r_old.name = 'Agent'
ON CONFLICT DO NOTHING;

-- Sales Manager ← copy Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r_new.id, rp.permission_id
FROM roles r_old
JOIN role_permissions rp ON rp.role_id = r_old.id
JOIN roles r_new ON r_new.name = 'Sales Manager'
WHERE r_old.name = 'Manager'
ON CONFLICT DO NOTHING;

INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo Sales Executive', 'demo.sales.executive@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'Sales Executive'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo Sales Manager', 'demo.sales.manager@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'Sales Manager'
ON CONFLICT (email) DO NOTHING;

-- Mobile / settings: include new role names in module access (deduped)
UPDATE module_settings ms
SET allowed_roles = (
  SELECT coalesce(
    array(SELECT DISTINCT u FROM unnest(
      ms.allowed_roles || ARRAY['Sales Executive','Sales Manager','Inventory']::text[]
    ) AS t(u)),
    ARRAY[]::text[]
  )
);
