-- Add product category field for CRM leads forms/lists.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS product_category VARCHAR(150);
