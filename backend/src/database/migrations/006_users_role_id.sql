-- ============================================================
-- Migration 006 — Add role_id to users table
-- Adds role_id FK → roles(id), backfills from role varchar,
-- then sets NOT NULL. The role varchar column is kept for
-- backward-compat but role_id is now the authoritative column.
-- ============================================================

-- 1. Add nullable column first so existing rows don't violate NOT NULL
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;

-- 2. Backfill: match existing role varchar → roles.id
UPDATE users u
   SET role_id = r.id
  FROM roles r
 WHERE r.name = u.role
   AND u.role_id IS NULL;

-- 3. For any users whose role string doesn't match a role row,
--    fall back to 'Agent' so NOT NULL can be enforced safely
UPDATE users u
   SET role_id = (SELECT id FROM roles WHERE name = 'Agent' LIMIT 1)
 WHERE u.role_id IS NULL;

-- 4. Enforce NOT NULL now that every row has a value
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;

-- 5. Keep role varchar in sync via a trigger so both columns stay consistent
CREATE OR REPLACE FUNCTION sync_user_role_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
    SELECT name INTO NEW.role FROM roles WHERE id = NEW.role_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_role_name ON users;
CREATE TRIGGER trg_sync_user_role_name
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_user_role_name();
