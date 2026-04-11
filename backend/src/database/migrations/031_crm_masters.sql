-- ============================================================
-- Migration 031 — CRM master tables: platforms, segments, priorities
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_platforms (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_segments (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_priorities (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  color      VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults
INSERT INTO crm_platforms (name) VALUES
  ('Facebook'), ('Instagram'), ('Google'), ('WhatsApp'), ('Walk-in'), ('Referral'), ('Website')
ON CONFLICT DO NOTHING;

INSERT INTO crm_segments (name) VALUES
  ('B2B'), ('B2C'), ('Enterprise'), ('SMB'), ('Startup')
ON CONFLICT DO NOTHING;

INSERT INTO crm_priorities (name, color) VALUES
  ('Hot',  'red'),
  ('Warm', 'amber'),
  ('Cold', 'blue')
ON CONFLICT DO NOTHING;
