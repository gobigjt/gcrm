-- ============================================================
-- Migration 004 — Seed Application Data
-- Inserts: lead_sources, lead_stages, warehouses
-- ============================================================

INSERT INTO lead_sources (name) VALUES
  ('Website'),
  ('Facebook Ads'),
  ('Google Ads'),
  ('Referral'),
  ('Cold Call'),
  ('LinkedIn'),
  ('Walk-in')
ON CONFLICT DO NOTHING;

INSERT INTO lead_stages (name, position) VALUES
  ('New',           0),
  ('Contacted',     1),
  ('Qualified',     2),
  ('Proposal Sent', 3),
  ('Negotiation',   4),
  ('Won',           5),
  ('Lost',          6)
ON CONFLICT DO NOTHING;

INSERT INTO warehouses (name, location) VALUES
  ('Main Warehouse', 'Head Office')
ON CONFLICT DO NOTHING;
