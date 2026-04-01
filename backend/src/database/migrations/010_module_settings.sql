-- ============================================================
-- Migration 010 — Module settings
-- Controls per-module enable/disable and role-based access.
-- ============================================================

CREATE TABLE IF NOT EXISTS module_settings (
  id            SERIAL PRIMARY KEY,
  module        VARCHAR(50)  NOT NULL UNIQUE,
  label         VARCHAR(100) NOT NULL,
  is_enabled    BOOLEAN      NOT NULL DEFAULT TRUE,
  allowed_roles TEXT[]       NOT NULL DEFAULT ARRAY['Super Admin','Admin','Manager','Agent','Accountant','HR'],
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed all modules with defaults (all enabled, all roles allowed)
INSERT INTO module_settings (module, label) VALUES
  ('crm',           'CRM'),
  ('sales',         'Sales'),
  ('purchase',      'Purchase'),
  ('inventory',     'Inventory'),
  ('production',    'Production'),
  ('finance',       'Finance'),
  ('hr',            'HR & Payroll'),
  ('communication', 'Communication'),
  ('settings',      'Settings'),
  ('users',         'Users')
ON CONFLICT (module) DO NOTHING;
