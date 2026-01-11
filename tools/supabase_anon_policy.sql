-- Supabase: Create a narrow anon INSERT policy for public.complaints
-- Copy and paste everything below into the Supabase SQL editor and run.

-- 1) Inspect current policies and table columns (run first)
SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'complaints';

SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'complaints'
ORDER BY ordinal_position;

-- 2) (Optional) Drop any existing policy with this name to avoid conflicts
DROP POLICY IF EXISTS anon_insert_complaints_client_only ON public.complaints;

-- 3) Create a narrow policy that allows anonymous INSERTs only when source = 'client'
CREATE POLICY anon_insert_complaints_client_only
  ON public.complaints
  FOR INSERT
  TO anon
  WITH CHECK (source = 'client'::text);

-- 4) Verify the policy was created
SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'complaints';

-- 5) (Optional) If you want a slightly stricter policy that also requires complaint_reason
-- DROP POLICY IF EXISTS anon_insert_complaints_client_only ON public.complaints;
-- CREATE POLICY anon_insert_complaints_client_only
--   ON public.complaints
--   FOR INSERT
--   TO anon
--   WITH CHECK (
--     source = 'client'::text
--     AND complaint_reason IS NOT NULL
--   );

-- 6) If you prefer the DB to generate UUID ids when clients omit id, enable this (run only if needed):
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ALTER TABLE public.complaints ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 7) Remove the service_role key from your local .env after testing. Do NOT commit it.

-- End of file
