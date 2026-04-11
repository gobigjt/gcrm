-- ============================================================
-- Migration 033 — Re-seed lead_sources with all known sources
-- ============================================================

INSERT INTO lead_sources (name) VALUES
  ('Website'),
  ('Facebook Ads'),
  ('Google Ads'),
  ('Referral'),
  ('Cold Call'),
  ('LinkedIn'),
  ('Walk-in'),
  ('WhatsApp'),
  ('Instagram'),
  ('Trade Show'),
  ('Email Campaign'),
  ('Google Sheet')
ON CONFLICT (name) DO NOTHING;
