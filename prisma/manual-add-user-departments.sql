ALTER TABLE crm_users
  ADD COLUMN IF NOT EXISTS departments TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE crm_users
SET departments = ARRAY[department]
WHERE department IS NOT NULL
  AND cardinality(departments) = 0;
