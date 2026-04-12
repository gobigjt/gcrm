-- Migration 036 — add created_by to leads
-- Allows scoping: sales executive sees leads assigned_to OR created_by them.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
