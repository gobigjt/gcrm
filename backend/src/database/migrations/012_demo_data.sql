-- ============================================================
-- Migration 012 — Demo / sample data (development & demos)
--
-- Login (all accounts):  password  Demo@123
--   demo.super@example.com      — Super Admin
--   demo.manager@example.com    — Manager
--   demo.agent@example.com      — Agent
--   demo.accountant@example.com — Accountant
--
-- Safe to apply on top of existing seeds (003–011). Uses
-- ON CONFLICT / WHERE NOT EXISTS so re-running this file
-- alone may duplicate some rows; the migration runner applies
-- it once per database.
-- ============================================================

-- ── Demo users (bcrypt hash = Demo@123, cost 10) ─────────────
INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo Super Admin', 'demo.super@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'Super Admin'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo Manager', 'demo.manager@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'Manager'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo Agent', 'demo.agent@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'Agent'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password, role, role_id)
SELECT 'Demo Accountant', 'demo.accountant@example.com',
  '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG',
  r.name, r.id
FROM roles r WHERE r.name = 'Accountant'
ON CONFLICT (email) DO NOTHING;

-- ── Company profile (only if none exists) ───────────────────
INSERT INTO company_settings (company_name, gstin, address, phone, email, currency, fiscal_year_start)
SELECT
  'Demo BuildConstruct Pvt Ltd',
  '29ABCDE1234F1Z5',
  '42 Electronics Park, Bengaluru 560001, India',
  '+91-80-5555-0100',
  'contact@demo-build.example',
  'INR',
  DATE '2025-04-01'
WHERE NOT EXISTS (SELECT 1 FROM company_settings);

-- ── Extra warehouse ─────────────────────────────────────────
INSERT INTO warehouses (name, location)
SELECT 'South Hub', 'Chennai — secondary DC'
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE name = 'South Hub');

-- ── Products (SKU unique) ───────────────────────────────────
INSERT INTO products (name, sku, hsn_code, unit, purchase_price, sale_price, gst_rate, low_stock_alert)
SELECT v.name, v.sku, v.hsn, v.unit, v.pp, v.sp, v.gst, v.low
FROM (VALUES
  ('Aluminum Window Frame 6ft', 'DEMO-AWF-600', '7610', 'pcs', 4200::numeric, 6200::numeric, 18::numeric, 8),
  ('Tempered Glass 5mm (sqm)', 'DEMO-GLP-5MM', '7005', 'sqm', 800::numeric, 1299::numeric, 18::numeric, 20),
  ('CSK Screw M8 (box 100)', 'DEMO-CSK-M8', '7318', 'box', 180::numeric, 299::numeric, 18::numeric, 15),
  ('Window assembly kit', 'DEMO-KIT-WINDOW', '7610', 'kit', 11000::numeric, 16800::numeric, 18::numeric, 3)
) AS v(name, sku, hsn, unit, pp, sp, gst, low)
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = v.sku);

-- ── Stock (Main Warehouse) ──────────────────────────────────
INSERT INTO stock (product_id, warehouse_id, quantity)
SELECT p.id, w.id, q.qty
FROM (VALUES
  ('DEMO-AWF-600', 140::numeric),
  ('DEMO-GLP-5MM', 85::numeric),
  ('DEMO-CSK-M8', 200::numeric),
  ('DEMO-KIT-WINDOW', 22::numeric)
) AS q(sku, qty)
JOIN products p ON p.sku = q.sku
JOIN warehouses w ON w.name = 'Main Warehouse'
ON CONFLICT (product_id, warehouse_id) DO NOTHING;

-- ── Vendors ─────────────────────────────────────────────────
INSERT INTO vendors (name, email, phone, gstin, address)
SELECT 'ACME Supplies Co.', 'procurement@acme-vendor.demo', '9876500300', '29BBBBB2222B1Z2', 'Mumbai MH'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE email = 'procurement@acme-vendor.demo');

INSERT INTO vendors (name, email, phone, gstin, address)
SELECT 'GlassWorks India', 'sales@glassworks.demo', '9876500400', '27CCCCC3333C1Z3', 'Hyderabad TG'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE email = 'sales@glassworks.demo');

-- ── Customers ────────────────────────────────────────────────
INSERT INTO customers (name, email, phone, gstin, address)
SELECT 'Precision Metals India', 'accounts@precision-metals.demo', '9876500200', '27AAAAA1111A1Z1', 'Pune Industrial Area'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'accounts@precision-metals.demo');

INSERT INTO customers (name, email, phone, gstin, address)
SELECT 'GreenHomes Developers', 'purchase@greenhomes.demo', '9876500500', '29DDDDD4444D1Z4', 'Bengaluru KA'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE email = 'purchase@greenhomes.demo');

-- ── CRM leads ───────────────────────────────────────────────
INSERT INTO leads (name, email, phone, company, source_id, stage_id, assigned_to, priority, lead_score, notes)
SELECT 'Ravi Kumar', 'ravi.k@democlient.example', '9876500101', 'South India Traders',
  (SELECT id FROM lead_sources WHERE name = 'Website' LIMIT 1),
  (SELECT id FROM lead_stages WHERE name = 'Qualified' LIMIT 1),
  (SELECT id FROM users WHERE email = 'demo.agent@example.com' LIMIT 1),
  'hot', 78, 'Bulk order discussion for Q2; prefers email.'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE email = 'ravi.k@democlient.example');

INSERT INTO leads (name, email, phone, company, source_id, stage_id, assigned_to, priority, lead_score, notes)
SELECT 'Anita Desai', 'anita.d@urbanspaces.demo', '9876500102', 'Urban Spaces LLP',
  (SELECT id FROM lead_sources WHERE name = 'Referral' LIMIT 1),
  (SELECT id FROM lead_stages WHERE name = 'Proposal Sent' LIMIT 1),
  (SELECT id FROM users WHERE email = 'demo.agent@example.com' LIMIT 1),
  'warm', 55, 'Waiting on budget approval from CFO.'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE email = 'anita.d@urbanspaces.demo');

INSERT INTO leads (name, email, phone, company, source_id, stage_id, assigned_to, priority, lead_score, notes)
SELECT 'Mohammed Ali', 'm.ali@coastalinfra.demo', '9876500103', 'Coastal Infra Projects',
  (SELECT id FROM lead_sources WHERE name = 'LinkedIn' LIMIT 1),
  (SELECT id FROM lead_stages WHERE name = 'New' LIMIT 1),
  (SELECT id FROM users WHERE email = 'demo.agent@example.com' LIMIT 1),
  'cold', 32, 'Initial inquiry — follow up next week.'
WHERE NOT EXISTS (SELECT 1 FROM leads WHERE email = 'm.ali@coastalinfra.demo');

-- ── Lead activities & follow-ups (first lead) ────────────────
INSERT INTO lead_activities (lead_id, user_id, type, description)
SELECT l.id, u.id, 'note', 'Demo: logged discovery call — interested in fire-rated variants.'
FROM leads l, users u
WHERE l.email = 'ravi.k@democlient.example' AND u.email = 'demo.agent@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM lead_activities a WHERE a.lead_id = l.id AND a.description LIKE 'Demo: logged discovery%'
  );

INSERT INTO lead_followups (lead_id, assigned_to, due_date, description, is_done)
SELECT l.id, u.id, NOW() + INTERVAL '3 days', 'Send revised quotation with installation timeline', FALSE
FROM leads l, users u
WHERE l.email = 'ravi.k@democlient.example' AND u.email = 'demo.agent@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM lead_followups f WHERE f.lead_id = l.id AND f.description LIKE 'Send revised quotation%'
  );

-- ── Sales: quotation + order ─────────────────────────────────
INSERT INTO quotations (quotation_number, customer_id, status, valid_until, notes, total_amount, created_by)
SELECT 'DEMO-QT-1001', c.id, 'sent', CURRENT_DATE + 30, 'Demo quotation — window frames + glass', 73160,
  (SELECT id FROM users WHERE email = 'demo.agent@example.com' LIMIT 1)
FROM customers c
WHERE c.email = 'accounts@precision-metals.demo'
  AND NOT EXISTS (SELECT 1 FROM quotations WHERE quotation_number = 'DEMO-QT-1001');

INSERT INTO quotation_items (quotation_id, product_id, description, quantity, unit_price, gst_rate, total)
SELECT q.id, p.id, p.name, 10, 6200, 18, 73160
FROM quotations q
JOIN products p ON p.sku = 'DEMO-AWF-600'
WHERE q.quotation_number = 'DEMO-QT-1001'
  AND NOT EXISTS (SELECT 1 FROM quotation_items qi WHERE qi.quotation_id = q.id);

INSERT INTO quotations (quotation_number, customer_id, status, valid_until, notes, total_amount, created_by)
SELECT 'DEMO-QT-1002', c.id, 'draft', CURRENT_DATE + 14, 'Demo draft for developer kits', 0,
  (SELECT id FROM users WHERE email = 'demo.agent@example.com' LIMIT 1)
FROM customers c
WHERE c.email = 'purchase@greenhomes.demo'
  AND NOT EXISTS (SELECT 1 FROM quotations WHERE quotation_number = 'DEMO-QT-1002');

INSERT INTO sales_orders (order_number, customer_id, status, notes, total_amount, created_by)
SELECT 'DEMO-SO-2001', c.id, 'processing', 'Demo order — window kits', 19824,
  (SELECT id FROM users WHERE email = 'demo.agent@example.com' LIMIT 1)
FROM customers c
WHERE c.email = 'accounts@precision-metals.demo'
  AND NOT EXISTS (SELECT 1 FROM sales_orders WHERE order_number = 'DEMO-SO-2001');

INSERT INTO sales_order_items (order_id, product_id, description, quantity, unit_price, gst_rate, total)
SELECT o.id, p.id, p.name, 1, 16800, 18, 19824
FROM sales_orders o
JOIN products p ON p.sku = 'DEMO-KIT-WINDOW'
WHERE o.order_number = 'DEMO-SO-2001'
  AND NOT EXISTS (SELECT 1 FROM sales_order_items oi WHERE oi.order_id = o.id);

-- ── Purchase: PO (draft) ────────────────────────────────────
INSERT INTO purchase_orders (po_number, vendor_id, status, notes, total_amount, created_by)
SELECT 'DEMO-PO-3001', v.id, 'sent', 'Demo PO — glass sheets', 37760,
  (SELECT id FROM users WHERE email = 'demo.manager@example.com' LIMIT 1)
FROM vendors v
WHERE v.email = 'sales@glassworks.demo'
  AND NOT EXISTS (SELECT 1 FROM purchase_orders WHERE po_number = 'DEMO-PO-3001');

INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_price, gst_rate, total)
SELECT po.id, p.id, 40, 800, 18, 37760
FROM purchase_orders po
JOIN products p ON p.sku = 'DEMO-GLP-5MM'
WHERE po.po_number = 'DEMO-PO-3001'
  AND NOT EXISTS (SELECT 1 FROM purchase_order_items pi WHERE pi.po_id = po.id);

-- ── BOM + work order ────────────────────────────────────────
INSERT INTO bom (product_id, name, version)
SELECT p.id, 'Standard window kit BOM', '1.0'
FROM products p WHERE p.sku = 'DEMO-KIT-WINDOW'
  AND NOT EXISTS (SELECT 1 FROM bom b WHERE b.product_id = p.id AND b.name = 'Standard window kit BOM');

INSERT INTO bom_items (bom_id, component_id, quantity, unit)
SELECT b.id, c.id, 1, 'pcs'
FROM bom b
JOIN products fp ON fp.id = b.product_id AND fp.sku = 'DEMO-KIT-WINDOW'
JOIN products c ON c.sku = 'DEMO-AWF-600'
WHERE b.name = 'Standard window kit BOM'
  AND NOT EXISTS (SELECT 1 FROM bom_items bi WHERE bi.bom_id = b.id AND bi.component_id = c.id);

INSERT INTO bom_items (bom_id, component_id, quantity, unit)
SELECT b.id, c.id, 2.5, 'sqm'
FROM bom b
JOIN products fp ON fp.id = b.product_id AND fp.sku = 'DEMO-KIT-WINDOW'
JOIN products c ON c.sku = 'DEMO-GLP-5MM'
WHERE b.name = 'Standard window kit BOM'
  AND NOT EXISTS (SELECT 1 FROM bom_items bi WHERE bi.bom_id = b.id AND bi.component_id = c.id);

INSERT INTO work_orders (wo_number, product_id, bom_id, quantity, status, planned_start, notes, created_by)
SELECT 'DEMO-WO-4001', p.id, b.id, 25, 'in_progress', CURRENT_DATE, 'Demo work order',
  (SELECT id FROM users WHERE email = 'demo.manager@example.com' LIMIT 1)
FROM products p
JOIN bom b ON b.product_id = p.id AND b.name = 'Standard window kit BOM'
WHERE p.sku = 'DEMO-KIT-WINDOW'
  AND NOT EXISTS (SELECT 1 FROM work_orders WHERE wo_number = 'DEMO-WO-4001');

-- ── HR: employees, attendance, payroll ──────────────────────
INSERT INTO employees (user_id, employee_code, department, designation, date_of_joining, basic_salary)
SELECT u.id, 'DEMO-E001', 'Sales', 'Account Executive', DATE '2024-06-01', 45000
FROM users u WHERE u.email = 'demo.agent@example.com'
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO employees (user_id, employee_code, department, designation, date_of_joining, basic_salary)
SELECT u.id, 'DEMO-E002', 'Operations', 'Operations Manager', DATE '2023-01-15', 72000
FROM users u WHERE u.email = 'demo.manager@example.com'
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO attendance (employee_id, date, status, check_in, check_out)
SELECT e.id, CURRENT_DATE - 1, 'present', '09:15', '18:05'
FROM employees e WHERE e.employee_code = 'DEMO-E001'
ON CONFLICT (employee_id, date) DO NOTHING;

INSERT INTO payroll (employee_id, month, year, basic, hra, allowances, deductions, pf, gross, net, status)
SELECT e.id, 3, 2026, 45000, 15000, 5000, 2000, 1800, 63200, 61200, 'draft'
FROM employees e WHERE e.employee_code = 'DEMO-E001'
ON CONFLICT (employee_id, month, year) DO NOTHING;

-- ── Finance: minimal chart of accounts ────────────────────
INSERT INTO accounts (code, name, type) VALUES
  ('1000', 'Cash and Bank', 'asset'),
  ('1100', 'Accounts Receivable', 'asset'),
  ('2000', 'Accounts Payable', 'liability'),
  ('4000', 'Sales Revenue', 'income'),
  ('5000', 'Cost of Goods Sold', 'expense'),
  ('6000', 'Operating Expenses', 'expense')
ON CONFLICT (code) DO NOTHING;

-- ── Communication templates ─────────────────────────────────
INSERT INTO comm_templates (name, channel, subject, body)
SELECT 'Demo — Welcome email', 'email', 'Thanks for contacting us',
  'Hi {{name}}, thank you for your interest. A representative will reach out within one business day.'
WHERE NOT EXISTS (SELECT 1 FROM comm_templates WHERE name = 'Demo — Welcome email');

INSERT INTO comm_templates (name, channel, subject, body)
SELECT 'Demo — Follow-up WhatsApp', 'whatsapp', NULL,
  'Hi {{name}}, this is a quick follow-up regarding your recent inquiry. Reply YES to schedule a call.'
WHERE NOT EXISTS (SELECT 1 FROM comm_templates WHERE name = 'Demo — Follow-up WhatsApp');

-- ── Notifications (demo agent) ──────────────────────────────
INSERT INTO notifications (user_id, title, body, type, module, is_read)
SELECT u.id, 'New lead: Ravi Kumar', 'South India Traders — qualified, high priority.', 'info', 'crm', FALSE
FROM users u WHERE u.email = 'demo.agent@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = u.id AND n.title = 'New lead: Ravi Kumar'
  );

INSERT INTO notifications (user_id, title, body, type, module, is_read)
SELECT u.id, 'Quotation DEMO-QT-1001 sent', 'Customer: Precision Metals India.', 'success', 'sales', TRUE
FROM users u WHERE u.email = 'demo.agent@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = u.id AND n.title = 'Quotation DEMO-QT-1001 sent'
  );
