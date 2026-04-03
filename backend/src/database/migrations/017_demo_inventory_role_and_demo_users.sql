-- ============================================================
-- Migration 017 — Inventory role + demo users (Admin, Inventory, HR)
--
-- Adds the Inventory system role (inventory + purchase permissions)
-- if missing, and seeds demo logins for company admin, stock ops, and HR.
--
-- Password for all rows below:  Demo@123
-- (bcrypt $2b$10, same verified hash as migrations 012 / 013)
--
-- Full demo account list (012 + 017 + 018):
--   demo.super@example.com            — Super Admin
--   demo.admin@example.com            — Admin
--   demo.manager@example.com          — Manager
--   demo.sales.manager@example.com    — Sales Manager (showcase name)
--   demo.agent@example.com            — Agent
--   demo.sales.executive@example.com  — Sales Executive (showcase name)
--   demo.accountant@example.com       — Accountant
--   demo.inventory@example.com        — Inventory
--   demo.hr@example.com               — HR
-- ============================================================

-- ── Role: Inventory (matches schema.sql seed) ───────────────
INSERT INTO roles (name, description, is_system) VALUES
  ('Inventory', 'Stock, warehouse & purchase ops', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p
    ON p.module IN ('inventory','purchase')
   AND p.action IN ('view','view_all','create','create_all','edit','edit_all','delete')
  WHERE r.name = 'Inventory'
ON CONFLICT DO NOTHING;

-- ── Demo users (bcrypt = Demo@123) ──────────────────────────
INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo Admin', 'demo.admin@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'Admin'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo Inventory', 'demo.inventory@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'Inventory'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo HR', 'demo.hr@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'HR'
ON CONFLICT (email) DO NOTHING;
