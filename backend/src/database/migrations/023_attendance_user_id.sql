-- Attendance keyed by users.id instead of employees.id (idempotent if already migrated).
DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE attendance ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

    UPDATE attendance AS a
    SET user_id = e.user_id
    FROM employees AS e
    WHERE e.id = a.employee_id AND e.user_id IS NOT NULL;

    DELETE FROM attendance WHERE user_id IS NULL;

    ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_fkey;
    ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_date_key;

    ALTER TABLE attendance DROP COLUMN employee_id;

    ALTER TABLE attendance ALTER COLUMN user_id SET NOT NULL;

    ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_user_id_date_key;
    ALTER TABLE attendance ADD CONSTRAINT attendance_user_id_date_key UNIQUE (user_id, date);
  END IF;
END $migrate$;
