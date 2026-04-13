-- Lead row links to overseeing sales manager (scoped list for Sales Manager login).
-- Kept in sync with assigned_manager_id for existing UI/API.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS sales_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_sales_manager_id ON leads(sales_manager_id);

UPDATE leads
   SET sales_manager_id = assigned_manager_id
 WHERE sales_manager_id IS NULL
   AND assigned_manager_id IS NOT NULL;
