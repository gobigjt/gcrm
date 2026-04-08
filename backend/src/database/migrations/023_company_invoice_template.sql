-- Optional copy for Tax Invoice print/PDF (header tagline, payment terms, bank block).
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS invoice_tagline TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS invoice_bank_details TEXT;
