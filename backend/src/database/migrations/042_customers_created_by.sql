ALTER TABLE customers
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

UPDATE customers c
SET created_by = l.created_by
FROM leads l
WHERE c.created_by IS NULL
  AND c.lead_id = l.id
  AND l.created_by IS NOT NULL;
