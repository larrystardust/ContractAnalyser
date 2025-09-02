-- up.sql
-- Create a temporary function to execute the RLS policy creation with elevated privileges
CREATE OR REPLACE FUNCTION public.create_reports_bucket_policy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- This makes the function run with the privileges of the user who *defines* it (supabase_admin)
AS $$
BEGIN
    -- Ensure RLS is enabled on storage.objects (idempotent)
    EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';

    -- Drop policy if it already exists to make the migration idempotent
    EXECUTE 'DROP POLICY IF EXISTS "Allow service_role to manage reports bucket" ON storage.objects';

    -- Create the policy
    EXECUTE 'CREATE POLICY "Allow service_role to manage reports bucket"
             ON storage.objects FOR ALL
             TO service_role
             USING (bucket_id = ''reports'')';
END;
$$;

-- Grant execution rights to the current user (who is running the migration)
-- This is necessary for the 'postgres' user (or whoever is running the migration) to call the function.
GRANT EXECUTE ON FUNCTION public.create_reports_bucket_policy() TO postgres;

-- Execute the function
SELECT public.create_reports_bucket_policy();

-- Revoke execution rights from public (good practice for security definer functions)
-- This ensures only the definer (supabase_admin) and explicitly granted roles can execute it directly.
REVOKE EXECUTE ON FUNCTION public.create_reports_bucket_policy() FROM public;

-- Drop the temporary function
DROP FUNCTION public.create_reports_bucket_policy();


-- down.sql
-- Create a temporary function to drop the RLS policy with elevated privileges
CREATE OR REPLACE FUNCTION public.drop_reports_bucket_policy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Allow service_role to manage reports bucket" ON storage.objects';
END;
$$;

-- Grant execution rights to the current user
GRANT EXECUTE ON FUNCTION public.drop_reports_bucket_policy() TO postgres;

-- Execute the function
SELECT public.drop_reports_bucket_policy();

-- Revoke execution rights from public
REVOKE EXECUTE ON FUNCTION public.drop_reports_bucket_policy() FROM public;

-- Drop the temporary function
DROP FUNCTION public.drop_reports_bucket_policy();