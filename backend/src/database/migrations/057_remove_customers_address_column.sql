-- Migration 057: remove deprecated customers.address and keep billing_address.
UPDATE customers
SET billing_address = address
WHERE billing_address IS NULL
  AND address IS NOT NULL;

ALTER TABLE customers
  DROP COLUMN IF EXISTS address;
