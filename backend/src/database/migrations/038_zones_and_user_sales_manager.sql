-- Zones (territory) + optional zone per user; Sales Executive → Sales Manager reporting.

CREATE TABLE IF NOT EXISTS zones (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  code       VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS zones_code_unique ON zones (code) WHERE code IS NOT NULL AND trim(code) <> '';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_zone_id ON users(zone_id);
CREATE INDEX IF NOT EXISTS idx_users_sales_manager_id ON users(sales_manager_id);
