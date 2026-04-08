ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200);
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(200);
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(80);
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(20);
