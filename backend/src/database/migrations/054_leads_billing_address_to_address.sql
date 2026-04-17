-- Migration 054 — Leads: replace billing_address with address
-- Safe/data-preserving: keep existing address; fill missing address from billing_address.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS address TEXT;

UPDATE leads
SET address = billing_address
WHERE (address IS NULL OR BTRIM(address) = '')
  AND billing_address IS NOT NULL
  AND BTRIM(billing_address) <> '';

ALTER TABLE leads
  DROP COLUMN IF EXISTS billing_address;
