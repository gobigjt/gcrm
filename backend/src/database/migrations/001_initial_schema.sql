-- ============================================================
-- Migration 001 — Initial Schema
-- Tables: users, company_settings, and all module tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Auth ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  role       VARCHAR(50) NOT NULL DEFAULT 'Agent',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── System Settings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
  id                SERIAL PRIMARY KEY,
  company_name      VARCHAR(200) NOT NULL,
  gstin             VARCHAR(15),
  address           TEXT,
  phone             VARCHAR(20),
  email             VARCHAR(255),
  logo_url          TEXT,
  favicon_url       TEXT,
  currency          VARCHAR(10) NOT NULL DEFAULT 'INR',
  fiscal_year_start DATE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CRM ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_sources (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS lead_stages (
  id       SERIAL PRIMARY KEY,
  name     VARCHAR(100) NOT NULL UNIQUE,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leads (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(255),
  phone         VARCHAR(20),
  company       VARCHAR(200),
  source_id     INTEGER REFERENCES lead_sources(id) ON DELETE SET NULL,
  stage_id      INTEGER REFERENCES lead_stages(id) ON DELETE SET NULL,
  assigned_to   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  custom_fields JSONB,
  product_category VARCHAR(150),
  notes         TEXT,
  is_converted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_activities (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type        VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_followups (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date    TIMESTAMPTZ NOT NULL,
  description TEXT,
  is_done     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_forms (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  fields     JSONB NOT NULL DEFAULT '[]',
  source     VARCHAR(100),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_form_submissions (
  id           SERIAL PRIMARY KEY,
  form_id      INTEGER NOT NULL REFERENCES lead_forms(id) ON DELETE CASCADE,
  data         JSONB NOT NULL,
  lead_id      INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_platform_google_sheets (
  id             SERIAL PRIMARY KEY,
  sheet_url      TEXT NOT NULL,
  sheet_gid      VARCHAR(50),
  lead_source_id INTEGER REFERENCES lead_sources(id) ON DELETE SET NULL,
  data_start_row INTEGER,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_platform_google_sheets_source
  ON lead_platform_google_sheets(lead_source_id);

-- ── Communication ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comm_templates (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  channel    VARCHAR(30) NOT NULL CHECK (channel IN ('whatsapp','email','sms')),
  subject    VARCHAR(255),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_logs (
  id        SERIAL PRIMARY KEY,
  lead_id   INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  channel   VARCHAR(30) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject   VARCHAR(255),
  body      TEXT,
  status    VARCHAR(30) NOT NULL DEFAULT 'sent',
  sent_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Inventory ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(200) NOT NULL,
  location  TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS brands (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(120) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(120) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  code            VARCHAR(100),
  sku             VARCHAR(100) UNIQUE,
  hsn_code        VARCHAR(20),
  category        VARCHAR(120),
  brand_id        INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  description     TEXT,
  unit            VARCHAR(30) NOT NULL DEFAULT 'pcs',
  purchase_price  NUMERIC(15,2) NOT NULL DEFAULT 0,
  sale_price      NUMERIC(15,2) NOT NULL DEFAULT 0,
  image_url       TEXT,
  gst_rate        NUMERIC(5,2) NOT NULL DEFAULT 0,
  low_stock_alert INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow multiple NULLs; enforce uniqueness for non-null codes
CREATE UNIQUE INDEX IF NOT EXISTS products_code_uq ON products(code) WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS stock (
  id           SERIAL PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity     NUMERIC(15,3) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id           SERIAL PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL CHECK (type IN ('in','out','transfer','adjustment')),
  quantity     NUMERIC(15,3) NOT NULL,
  reference    VARCHAR(200),
  note         TEXT,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Purchase ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  email      VARCHAR(255),
  phone      VARCHAR(20),
  gstin      VARCHAR(15),
  address    TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            SERIAL PRIMARY KEY,
  po_number     VARCHAR(50) UNIQUE NOT NULL,
  vendor_id     INTEGER NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  status        VARCHAR(30) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','partial','received','cancelled')),
  order_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  notes         TEXT,
  total_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id         SERIAL PRIMARY KEY,
  po_id      INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity   NUMERIC(15,3) NOT NULL,
  unit_price NUMERIC(15,2) NOT NULL,
  gst_rate   NUMERIC(5,2) NOT NULL DEFAULT 0,
  total      NUMERIC(15,2) NOT NULL
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
  id           SERIAL PRIMARY KEY,
  grn_id       INTEGER NOT NULL REFERENCES grn(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity     NUMERIC(15,3) NOT NULL,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id             SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL,
  vendor_id      INTEGER NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  po_id          INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  invoice_date   DATE NOT NULL,
  due_date       DATE,
  amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  gst_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  status         VARCHAR(20) NOT NULL DEFAULT 'unpaid'
                   CHECK (status IN ('unpaid','partial','paid')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Sales ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(200) NOT NULL,
  email            VARCHAR(255),
  phone            VARCHAR(20),
  gstin            VARCHAR(15),
  address          TEXT,
  billing_address  TEXT,
  shipping_address TEXT,
  lead_id          INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposals (
  id              SERIAL PRIMARY KEY,
  proposal_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  lead_id         INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','accepted','rejected')),
  valid_until     DATE,
  notes           TEXT,
  total_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposal_items (
  id          SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity    NUMERIC(15,3) NOT NULL,
  unit_price  NUMERIC(15,2) NOT NULL,
  gst_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  total       NUMERIC(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS quotations (
  id               SERIAL PRIMARY KEY,
  quotation_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id      INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  proposal_id      INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','accepted','rejected')),
  valid_until      DATE,
  notes            TEXT,
  total_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id           SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  description  TEXT NOT NULL,
  quantity     NUMERIC(15,3) NOT NULL,
  unit_price   NUMERIC(15,2) NOT NULL,
  gst_rate     NUMERIC(5,2) NOT NULL DEFAULT 0,
  total        NUMERIC(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id           SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
  status       VARCHAR(30) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
  order_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  id             SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  order_id       INTEGER REFERENCES sales_orders(id) ON DELETE SET NULL,
  invoice_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date       DATE,
  subtotal       NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst           NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst           NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst           NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  status         VARCHAR(20) NOT NULL DEFAULT 'unpaid'
                   CHECK (status IN ('unpaid','partial','paid')),
  notes          TEXT,
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  id           SERIAL PRIMARY KEY,
  invoice_id   INTEGER NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount       NUMERIC(15,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method       VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
  reference    VARCHAR(200),
  notes        TEXT,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Production ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bom (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       VARCHAR(200) NOT NULL,
  version    VARCHAR(20) NOT NULL DEFAULT '1.0',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bom_items (
  id           SERIAL PRIMARY KEY,
  bom_id       INTEGER NOT NULL REFERENCES bom(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity     NUMERIC(15,3) NOT NULL,
  unit         VARCHAR(30) NOT NULL DEFAULT 'pcs'
);

CREATE TABLE IF NOT EXISTS work_orders (
  id            SERIAL PRIMARY KEY,
  wo_number     VARCHAR(50) UNIQUE NOT NULL,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  bom_id        INTEGER REFERENCES bom(id) ON DELETE SET NULL,
  quantity      NUMERIC(15,3) NOT NULL,
  status        VARCHAR(30) NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned','in_progress','completed','cancelled')),
  planned_start DATE,
  planned_end   DATE,
  actual_start  DATE,
  actual_end    DATE,
  notes         TEXT,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Finance ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  name      VARCHAR(200) NOT NULL,
  type      VARCHAR(30) NOT NULL
              CHECK (type IN ('asset','liability','equity','income','expense')),
  parent_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
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
  id           SERIAL PRIMARY KEY,
  account_id   INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  amount       NUMERIC(15,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category     VARCHAR(100),
  description  TEXT,
  receipt_url  TEXT,
  approved_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── HR & Payroll ─────────────────────────────────────────────
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
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  check_in    TIME,
  check_out   TIME,
  status      VARCHAR(20) NOT NULL DEFAULT 'present'
                CHECK (status IN ('present','absent','half_day','leave','holiday')),
  notes       TEXT,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS payroll (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        INTEGER NOT NULL,
  basic       NUMERIC(15,2) NOT NULL DEFAULT 0,
  hra         NUMERIC(15,2) NOT NULL DEFAULT 0,
  allowances  NUMERIC(15,2) NOT NULL DEFAULT 0,
  deductions  NUMERIC(15,2) NOT NULL DEFAULT 0,
  pf          NUMERIC(15,2) NOT NULL DEFAULT 0,
  gross       NUMERIC(15,2) NOT NULL DEFAULT 0,
  net         NUMERIC(15,2) NOT NULL DEFAULT 0,
  status      VARCHAR(20) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','processed','paid')),
  paid_on     DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, month, year)
);

-- ── Audit ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(100) NOT NULL,
  module     VARCHAR(100),
  record_id  INTEGER,
  details    JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
