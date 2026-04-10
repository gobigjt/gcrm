ALTER TABLE lead_platform_google_sheets
  ADD COLUMN IF NOT EXISTS data_start_row INTEGER;
-- NULL = first CSV row is headers (legacy). >= 1 = 1-based first data row; columns A–R fixed layout.
