-- Separate billing/shipping addresses for sales customers.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS billing_address TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address TEXT;

-- Keep existing integrations working by treating old `address` as billing address.
UPDATE customers
SET billing_address = address
WHERE billing_address IS NULL
  AND address IS NOT NULL;
