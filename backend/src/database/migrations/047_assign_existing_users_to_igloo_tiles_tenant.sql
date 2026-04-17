-- Migration 047 — Introduce tenants and move existing users to "igloo tiles"
-- Safe, idempotent step for current single-tenant data.

CREATE TABLE IF NOT EXISTS tenants (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  slug       VARCHAR(120) NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

INSERT INTO tenants (name, slug, is_active)
VALUES ('igloo tiles', 'igloo-tiles', TRUE)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  is_active = TRUE,
  updated_at = NOW();

UPDATE users
SET tenant_id = t.id
FROM tenants t
WHERE t.slug = 'igloo-tiles'
  AND users.tenant_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_tenant_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

DO $$
DECLARE
  v_tenant_id INTEGER;
BEGIN
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE slug = 'igloo-tiles'
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE users ALTER COLUMN tenant_id SET DEFAULT %s',
      v_tenant_id
    );
  END IF;
END $$;
