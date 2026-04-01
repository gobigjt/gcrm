-- ============================================================
-- Migration 013 — Fix demo user password hashes
--
-- Migration 012 used a bcrypt hash that did not match Demo@123
-- (verified: bcrypt.compare returned false). This updates any
-- seeded demo accounts to a correct hash for password Demo@123.
-- Safe if demo users do not exist (updates 0 rows).
-- ============================================================

UPDATE users
SET password = '$2b$10$lZ5A3R.E9gCL0nUU.bJvGOXurwbGCId1GbtiU0vXvwS/Fw/iJBrnG'
WHERE email IN (
  'demo.super@example.com',
  'demo.manager@example.com',
  'demo.agent@example.com',
  'demo.accountant@example.com'
);
