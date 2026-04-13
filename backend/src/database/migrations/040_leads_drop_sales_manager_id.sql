-- Manager scoping uses assigned_manager_id only; drop redundant column if 039 was applied.

DROP INDEX IF EXISTS idx_leads_sales_manager_id;
ALTER TABLE leads DROP COLUMN IF EXISTS sales_manager_id;
