-- ============================================================
-- Lead Generation Platforms — Facebook Pages: store URL
-- ============================================================

ALTER TABLE lead_platform_facebook_pages
  ADD COLUMN IF NOT EXISTS page_url VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_lead_platform_facebook_pages_page_url
  ON lead_platform_facebook_pages(page_url);

