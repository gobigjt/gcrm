-- ============================================================
-- Migration 024 — Product catalog fields (brand, code, category, image)
-- Adds richer product attributes without breaking existing data.
-- ============================================================

-- Brands master
CREATE TABLE IF NOT EXISTS brands (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(120) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products: additional catalog fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS code      VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS category  VARCHAR(120);
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id  INTEGER REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Uniqueness: allow multiple NULLs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='products_code_uq'
  ) THEN
    CREATE UNIQUE INDEX products_code_uq ON products(code) WHERE code IS NOT NULL;
  END IF;
END$$;

