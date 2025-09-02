-- up.sql
-- Create a temporary function to execute the RLS policy creation with elevated privileges
CREATE OR REPLACE FUNCTION public.create_admin_reports_delete_policy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- This makes the function run with the privileges of the user who *defines* it (supabase_admin)
AS $$
BEGIN
    -- Drop policy if it already exists to make the migration idempotent
    EXECUTE 'DROP POLICY IF EXISTS "Allow admins to delete any report" ON storage.objects';

    -- Create the RLS policy for authenticated admin users to delete any report
    EXECUTE 'CREATE POLICY "Allow admins to delete any report"
             ON storage.objects FOR DELETE
             TO authenticated
             USING (
                 bucket_id = ''reports'' AND
                 EXISTS (
                     SELECT 1
                     FROM public.profiles
                     WHERE id = auth.uid() AND is_admin = TRUE
                 )
             )';
END;
$$;

-- Grant execution rights to the current user (who is running the migration)
GRANT EXECUTE ON FUNCTION public.create_admin_reports_delete_policy() TO postgres;

-- Execute the function
SELECT public.create_admin_reports_delete_policy();

-- Drop the temporary function
DROP FUNCTION public.create_admin_reports_delete_policy();

-- down.sql
-- This section is intentionally left empty as per user request.