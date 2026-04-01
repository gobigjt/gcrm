-- ============================================================
-- Migration 005 — Super Admin Role
-- Creates a Super Admin role with all permissions
-- ============================================================

INSERT INTO roles (name, description, is_system) VALUES
  ('Super Admin', 'Unrestricted access to all modules and system settings', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Grant every existing permission to Super Admin
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
    FROM roles r, permissions p
   WHERE r.name = 'Super Admin'
ON CONFLICT DO NOTHING;
