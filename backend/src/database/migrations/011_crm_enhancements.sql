-- ============================================================
-- Migration 011 — CRM enhancements
-- Adds priority field to leads; adds more lead sources
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'warm'
    CHECK (priority IN ('hot','warm','cold'));

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 0;

INSERT INTO lead_sources (name) VALUES
  ('WhatsApp'),
  ('Instagram'),
  ('Trade Show'),
  ('Email Campaign')
ON CONFLICT DO NOTHING;
