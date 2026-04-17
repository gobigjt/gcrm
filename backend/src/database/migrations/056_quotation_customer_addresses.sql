-- Migration 056: store quotation-specific customer addresses.
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS customer_billing_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_shipping_address TEXT;

UPDATE quotations q
SET customer_billing_address = COALESCE(c.billing_address, c.address),
    customer_shipping_address = c.shipping_address
FROM customers c
WHERE c.id = q.customer_id
  AND (q.customer_billing_address IS NULL OR q.customer_shipping_address IS NULL);
