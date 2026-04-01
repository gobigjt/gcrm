-- ============================================================
-- Migration 003 — Seed RBAC Data
-- Inserts: roles, permissions (8 actions × 10 modules), role_permissions
-- Actions: view | view_all | create | create_all | edit | edit_all | delete | delete_all
-- ============================================================

-- ── Roles ────────────────────────────────────────────────────
INSERT INTO roles (name, description, is_system) VALUES
  ('Admin',      'Full system access',           TRUE),
  ('Manager',    'Manage teams and operations',  TRUE),
  ('Agent',      'Sales and CRM access',         TRUE),
  ('Accountant', 'Finance and billing access',   TRUE),
  ('HR',         'Human resources access',       TRUE)
ON CONFLICT (name) DO NOTHING;

-- ── Permissions ──────────────────────────────────────────────
INSERT INTO permissions (module, action, label) VALUES
  -- CRM
  ('crm','view',        'CRM — View own leads'),
  ('crm','view_all',    'CRM — View all leads'),
  ('crm','create',      'CRM — Create leads'),
  ('crm','create_all',  'CRM — Create leads for others'),
  ('crm','edit',        'CRM — Edit own leads'),
  ('crm','edit_all',    'CRM — Edit all leads'),
  ('crm','delete',      'CRM — Delete own leads'),
  ('crm','delete_all',  'CRM — Delete any lead'),
  -- Sales
  ('sales','view',        'Sales — View own records'),
  ('sales','view_all',    'Sales — View all records'),
  ('sales','create',      'Sales — Create records'),
  ('sales','create_all',  'Sales — Create on behalf of others'),
  ('sales','edit',        'Sales — Edit own records'),
  ('sales','edit_all',    'Sales — Edit all records'),
  ('sales','delete',      'Sales — Delete own records'),
  ('sales','delete_all',  'Sales — Delete any record'),
  -- Purchase
  ('purchase','view',        'Purchase — View own records'),
  ('purchase','view_all',    'Purchase — View all records'),
  ('purchase','create',      'Purchase — Create records'),
  ('purchase','create_all',  'Purchase — Create on behalf of others'),
  ('purchase','edit',        'Purchase — Edit own records'),
  ('purchase','edit_all',    'Purchase — Edit all records'),
  ('purchase','delete',      'Purchase — Delete own records'),
  ('purchase','delete_all',  'Purchase — Delete any record'),
  -- Inventory
  ('inventory','view',        'Inventory — View own records'),
  ('inventory','view_all',    'Inventory — View all records'),
  ('inventory','create',      'Inventory — Create records'),
  ('inventory','create_all',  'Inventory — Create on behalf of others'),
  ('inventory','edit',        'Inventory — Edit own records'),
  ('inventory','edit_all',    'Inventory — Edit all records'),
  ('inventory','delete',      'Inventory — Delete own records'),
  ('inventory','delete_all',  'Inventory — Delete any record'),
  -- Production
  ('production','view',        'Production — View own records'),
  ('production','view_all',    'Production — View all records'),
  ('production','create',      'Production — Create records'),
  ('production','create_all',  'Production — Create on behalf of others'),
  ('production','edit',        'Production — Edit own records'),
  ('production','edit_all',    'Production — Edit all records'),
  ('production','delete',      'Production — Delete own records'),
  ('production','delete_all',  'Production — Delete any record'),
  -- Finance
  ('finance','view',        'Finance — View own records'),
  ('finance','view_all',    'Finance — View all records'),
  ('finance','create',      'Finance — Create records'),
  ('finance','create_all',  'Finance — Create on behalf of others'),
  ('finance','edit',        'Finance — Edit own records'),
  ('finance','edit_all',    'Finance — Edit all records'),
  ('finance','delete',      'Finance — Delete own records'),
  ('finance','delete_all',  'Finance — Delete any record'),
  -- HR
  ('hr','view',        'HR — View own records'),
  ('hr','view_all',    'HR — View all records'),
  ('hr','create',      'HR — Create records'),
  ('hr','create_all',  'HR — Create on behalf of others'),
  ('hr','edit',        'HR — Edit own records'),
  ('hr','edit_all',    'HR — Edit all records'),
  ('hr','delete',      'HR — Delete own records'),
  ('hr','delete_all',  'HR — Delete any record'),
  -- Communication
  ('communication','view',        'Communication — View own records'),
  ('communication','view_all',    'Communication — View all records'),
  ('communication','create',      'Communication — Create records'),
  ('communication','create_all',  'Communication — Create on behalf of others'),
  ('communication','edit',        'Communication — Edit own records'),
  ('communication','edit_all',    'Communication — Edit all records'),
  ('communication','delete',      'Communication — Delete own records'),
  ('communication','delete_all',  'Communication — Delete any record'),
  -- Settings
  ('settings','view',        'Settings — View settings'),
  ('settings','view_all',    'Settings — View all settings & audit logs'),
  ('settings','create',      'Settings — Create entries'),
  ('settings','create_all',  'Settings — Create system-wide entries'),
  ('settings','edit',        'Settings — Edit own settings'),
  ('settings','edit_all',    'Settings — Edit all settings'),
  ('settings','delete',      'Settings — Delete own entries'),
  ('settings','delete_all',  'Settings — Delete any entry'),
  -- Users
  ('users','view',        'Users — View own profile'),
  ('users','view_all',    'Users — View all users'),
  ('users','create',      'Users — Create users'),
  ('users','create_all',  'Users — Create users with any role'),
  ('users','edit',        'Users — Edit own profile'),
  ('users','edit_all',    'Users — Edit any user'),
  ('users','delete',      'Users — Deactivate own account'),
  ('users','delete_all',  'Users — Delete any user')
ON CONFLICT (module, action) DO NOTHING;

-- ── Role Permissions ─────────────────────────────────────────

-- Admin → all permissions
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

-- Manager → all operational modules, all actions except delete_all
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p
    ON p.module IN ('crm','sales','purchase','inventory','production','hr','communication')
   AND p.action IN ('view','view_all','create','create_all','edit','edit_all','delete')
  WHERE r.name = 'Manager'
ON CONFLICT DO NOTHING;

-- Agent → crm + sales: view, create, edit own only
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p
    ON p.module IN ('crm','sales')
   AND p.action IN ('view','view_all','create','edit')
  WHERE r.name = 'Agent'
ON CONFLICT DO NOTHING;

-- Accountant → finance + sales + purchase: view, create, edit own
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p
    ON p.module IN ('finance','sales','purchase')
   AND p.action IN ('view','view_all','create','edit')
  WHERE r.name = 'Accountant'
ON CONFLICT DO NOTHING;

-- HR → hr + communication: view, create, edit own/all
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p
    ON p.module IN ('hr','communication')
   AND p.action IN ('view','view_all','create','edit','edit_all')
  WHERE r.name = 'HR'
ON CONFLICT DO NOTHING;
