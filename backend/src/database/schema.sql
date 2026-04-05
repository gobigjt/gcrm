-- ============================================================
-- EzCRM Platform — PostgreSQL Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- AUTH / USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  role       VARCHAR(50) NOT NULL DEFAULT 'Sales Executive',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RBAC: roles / permissions / role_permissions / user_permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id     SERIAL PRIMARY KEY,
  module VARCHAR(100) NOT NULL,
  action VARCHAR(50)  NOT NULL,   -- read | write | delete
  label  VARCHAR(200),
  UNIQUE(module, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(user_id, permission_id)
);

-- ── Re-seed: clear existing permission data so seed is idempotent ──
DELETE FROM role_permissions;
DELETE FROM user_permissions;
DELETE FROM permissions;

-- ── Seed: roles ─────────────────────────────────────────────
INSERT INTO roles (name, description, is_system) VALUES
  ('Super Admin',     'Platform operator (multi-tenant SaaS)', TRUE),
  ('Admin',           'Company admin (CRM, HR, users, settings)', TRUE),
  ('Sales Executive', 'Field sales & CRM', TRUE),
  ('HR',              'Human resources access', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ── Seed: permissions ───────────────────────────────────────
-- Actions: view | view_all | create | create_all | edit | edit_all | delete | delete_all
--   view        = see own / assigned records
--   view_all    = see all records in the module
--   create      = create new records
--   create_all  = create on behalf of others / bulk operations
--   edit        = edit own records
--   edit_all    = edit any record in the module
--   delete      = delete own records
--   delete_all  = delete any record in the module

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

-- ── Seed: role_permissions ──────────────────────────────────

-- Super Admin → all permissions
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'Super Admin'
ON CONFLICT DO NOTHING;

-- Admin → CRM, sales, inventory, HR, settings, users
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p ON p.module IN ('crm','sales','inventory','hr','settings','users')
  WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

-- Sales Executive → CRM + sales + inventory (read-only)
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p
    ON p.module = 'crm'
   AND p.action IN ('view','view_all','create','edit','delete')
  WHERE r.name = 'Sales Executive'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p
    ON p.module = 'sales'
   AND p.action IN ('view','view_all','create','edit','delete')
  WHERE r.name = 'Sales Executive'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p
    ON p.module = 'inventory'
   AND p.action IN ('view','view_all')
  WHERE r.name = 'Sales Executive'
ON CONFLICT DO NOTHING;

-- HR → HR only
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r
  JOIN permissions p
    ON p.module = 'hr'
   AND p.action IN ('view','view_all','create','edit','edit_all')
  WHERE r.name = 'HR'
ON CONFLICT DO NOTHING;

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS company_settings (
  id                SERIAL PRIMARY KEY,
  company_name      VARCHAR(200) NOT NULL,
  gstin             VARCHAR(15),
  address           TEXT,
  phone             VARCHAR(20),
  email             VARCHAR(255),
  logo_url          TEXT,
  currency          VARCHAR(10) NOT NULL DEFAULT 'INR',
  fiscal_year_start DATE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CRM MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_sources (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS lead_stages (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(100) NOT NULL UNIQUE,
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leads (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(20),
  company         VARCHAR(200),
  source_id       INTEGER REFERENCES lead_sources(id) ON DELETE SET NULL,
  stage_id        INTEGER REFERENCES lead_stages(id) ON DELETE SET NULL,
  assigned_to     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  custom_fields   JSONB,
  notes           TEXT,
  priority        VARCHAR(10) NOT NULL DEFAULT 'warm'
                    CHECK (priority IN ('hot','warm','cold')),
  lead_score      NUMERIC(6,2) NOT NULL DEFAULT 0,
  lead_segment    VARCHAR(10),
  job_title       VARCHAR(150),
  deal_size       NUMERIC(15,2),
  website         VARCHAR(500),
  address         TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  is_converted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_activities (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type        VARCHAR(50) NOT NULL, -- call, email, meeting, note
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_followups (
  id            SERIAL PRIMARY KEY,
  lead_id       INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date      TIMESTAMPTZ NOT NULL,
  description   TEXT,
  is_done       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COMMUNICATION MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS comm_templates (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  channel     VARCHAR(30) NOT NULL CHECK (channel IN ('whatsapp','email','sms')),
  subject     VARCHAR(255),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_logs (
  id            SERIAL PRIMARY KEY,
  lead_id       INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  channel       VARCHAR(30) NOT NULL,
  recipient     VARCHAR(255) NOT NULL,
  subject       VARCHAR(255),
  body          TEXT,
  status        VARCHAR(30) NOT NULL DEFAULT 'sent',
  sent_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVENTORY MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(200) NOT NULL,
  location  TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS products (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  sku             VARCHAR(100) UNIQUE,
  hsn_code        VARCHAR(20),
  description     TEXT,
  unit            VARCHAR(30) NOT NULL DEFAULT 'pcs',
  purchase_price  NUMERIC(15,2) NOT NULL DEFAULT 0,
  sale_price      NUMERIC(15,2) NOT NULL DEFAULT 0,
  gst_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
  low_stock_alert INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id  INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity      NUMERIC(15,3) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id  INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('in','out','transfer','adjustment')),
  quantity      NUMERIC(15,3) NOT NULL,
  reference     VARCHAR(200),
  note          TEXT,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PURCHASE MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(20),
  gstin       VARCHAR(15),
  address     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            SERIAL PRIMARY KEY,
  po_number     VARCHAR(50) UNIQUE NOT NULL,
  vendor_id     INTEGER NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  status        VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial','received','cancelled')),
  order_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  notes         TEXT,
  total_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id          SERIAL PRIMARY KEY,
  po_id       INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    NUMERIC(15,3) NOT NULL,
  unit_price  NUMERIC(15,2) NOT NULL,
  gst_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  total       NUMERIC(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS grn (
  id          SERIAL PRIMARY KEY,
  grn_number  VARCHAR(50) UNIQUE NOT NULL,
  po_id       INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes       TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS grn_items (
  id          SERIAL PRIMARY KEY,
  grn_id      INTEGER NOT NULL REFERENCES grn(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    NUMERIC(15,3) NOT NULL,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id              SERIAL PRIMARY KEY,
  invoice_number  VARCHAR(50) NOT NULL,
  vendor_id       INTEGER NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  po_id           INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  invoice_date    DATE NOT NULL,
  due_date        DATE,
  amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  gst_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SALES MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(20),
  gstin       VARCHAR(15),
  address     TEXT,
  lead_id     INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposals (
  id              SERIAL PRIMARY KEY,
  proposal_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  lead_id         INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected')),
  valid_until     DATE,
  notes           TEXT,
  total_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposal_items (
  id           SERIAL PRIMARY KEY,
  proposal_id  INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  description  TEXT NOT NULL,
  quantity     NUMERIC(15,3) NOT NULL,
  unit_price   NUMERIC(15,2) NOT NULL,
  gst_rate     NUMERIC(5,2) NOT NULL DEFAULT 0,
  total        NUMERIC(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS quotations (
  id                SERIAL PRIMARY KEY,
  quotation_number  VARCHAR(50) UNIQUE NOT NULL,
  customer_id       INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  proposal_id       INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected')),
  valid_until       DATE,
  notes             TEXT,
  total_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id            SERIAL PRIMARY KEY,
  quotation_id  INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  description   TEXT NOT NULL,
  quantity      NUMERIC(15,3) NOT NULL,
  unit_price    NUMERIC(15,2) NOT NULL,
  gst_rate      NUMERIC(5,2) NOT NULL DEFAULT 0,
  total         NUMERIC(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id            SERIAL PRIMARY KEY,
  order_number  VARCHAR(50) UNIQUE NOT NULL,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  quotation_id  INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
  status        VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
  order_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  total_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity    NUMERIC(15,3) NOT NULL,
  unit_price  NUMERIC(15,2) NOT NULL,
  gst_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  total       NUMERIC(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id              SERIAL PRIMARY KEY,
  invoice_number  VARCHAR(50) UNIQUE NOT NULL,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  order_id        INTEGER REFERENCES sales_orders(id) ON DELETE SET NULL,
  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst            NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst            NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst            NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid')),
  notes           TEXT,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          SERIAL PRIMARY KEY,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity    NUMERIC(15,3) NOT NULL,
  unit_price  NUMERIC(15,2) NOT NULL,
  gst_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  cgst        NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst        NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst        NUMERIC(15,2) NOT NULL DEFAULT 0,
  total       NUMERIC(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id              SERIAL PRIMARY KEY,
  invoice_id      INTEGER NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount          NUMERIC(15,2) NOT NULL,
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  method          VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
  reference       VARCHAR(200),
  notes           TEXT,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTION MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS bom (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  version     VARCHAR(20) NOT NULL DEFAULT '1.0',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bom_items (
  id              SERIAL PRIMARY KEY,
  bom_id          INTEGER NOT NULL REFERENCES bom(id) ON DELETE CASCADE,
  component_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity        NUMERIC(15,3) NOT NULL,
  unit            VARCHAR(30) NOT NULL DEFAULT 'pcs'
);

CREATE TABLE IF NOT EXISTS work_orders (
  id            SERIAL PRIMARY KEY,
  wo_number     VARCHAR(50) UNIQUE NOT NULL,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  bom_id        INTEGER REFERENCES bom(id) ON DELETE SET NULL,
  quantity      NUMERIC(15,3) NOT NULL,
  status        VARCHAR(30) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')),
  planned_start DATE,
  planned_end   DATE,
  actual_start  DATE,
  actual_end    DATE,
  notes         TEXT,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FINANCE MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) UNIQUE NOT NULL,
  name        VARCHAR(200) NOT NULL,
  type        VARCHAR(30) NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  parent_id   INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id          SERIAL PRIMARY KEY,
  entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  reference   VARCHAR(200),
  description TEXT NOT NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id          SERIAL PRIMARY KEY,
  entry_id    INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  debit       NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit      NUMERIC(15,2) NOT NULL DEFAULT 0,
  description TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id            SERIAL PRIMARY KEY,
  account_id    INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  amount        NUMERIC(15,2) NOT NULL,
  expense_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  category      VARCHAR(100),
  description   TEXT,
  receipt_url   TEXT,
  approved_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HR & PAYROLL MODULE
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  employee_code   VARCHAR(30) UNIQUE NOT NULL,
  department      VARCHAR(100),
  designation     VARCHAR(100),
  date_of_joining DATE,
  date_of_birth   DATE,
  phone           VARCHAR(20),
  address         TEXT,
  bank_account    VARCHAR(50),
  ifsc_code       VARCHAR(20),
  pan_number      VARCHAR(10),
  basic_salary    NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  check_in      TIME,
  check_out     TIME,
  status        VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','half_day','leave','holiday')),
  notes         TEXT,
  UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS payroll (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            INTEGER NOT NULL,
  basic           NUMERIC(15,2) NOT NULL DEFAULT 0,
  hra             NUMERIC(15,2) NOT NULL DEFAULT 0,
  allowances      NUMERIC(15,2) NOT NULL DEFAULT 0,
  deductions      NUMERIC(15,2) NOT NULL DEFAULT 0,
  pf              NUMERIC(15,2) NOT NULL DEFAULT 0,
  gross           NUMERIC(15,2) NOT NULL DEFAULT 0,
  net             NUMERIC(15,2) NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','processed','paid')),
  paid_on         DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, month, year)
);

-- ============================================================
-- ADMIN / AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  module      VARCHAR(100),
  record_id   INTEGER,
  details     JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LEAD CAPTURE
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_forms (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  fields      JSONB NOT NULL DEFAULT '[]',
  source      VARCHAR(100),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_form_submissions (
  id          SERIAL PRIMARY KEY,
  form_id     INTEGER NOT NULL REFERENCES lead_forms(id) ON DELETE CASCADE,
  data        JSONB NOT NULL,
  lead_id     INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO lead_sources (name) VALUES
  ('Website'),('Facebook Ads'),('Google Ads'),('Referral'),('Cold Call'),('LinkedIn'),('Walk-in')
ON CONFLICT DO NOTHING;

INSERT INTO lead_stages (name, position) VALUES
  ('New',0),('Contacted',1),('Qualified',2),('Proposal Sent',3),('Negotiation',4),('Won',5),('Lost',6)
ON CONFLICT DO NOTHING;

INSERT INTO warehouses (name, location) VALUES
  ('Main Warehouse','Head Office')
ON CONFLICT DO NOTHING;
