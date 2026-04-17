ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS invoice_footer_content TEXT;
