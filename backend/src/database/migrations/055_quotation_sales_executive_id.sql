-- Migration 055: keep quotation creator and assigned sales executive separate.
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS sales_executive_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

UPDATE quotations
SET sales_executive_id = created_by
WHERE sales_executive_id IS NULL
  AND created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_sales_executive_id
  ON quotations(sales_executive_id);
