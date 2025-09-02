-- up.sql
-- Create a temporary function to execute the RLS policy creation with elevated privileges
CREATE OR REPLACE FUNCTION public.create_authenticated_reports_delete_policy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- This makes the function run with the privileges of the user who *defines* it (supabase_admin)
AS $$
BEGIN
    -- Drop the policy if it already exists to make the migration idempotent
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated users to delete their own reports" ON storage.objects';

    -- Create the RLS policy for authenticated users to delete their own reports
    EXECUTE 'CREATE POLICY "Allow authenticated users to delete their own reports"
             ON storage.objects FOR DELETE
             TO authenticated
             USING (
                 bucket_id = ''reports'' AND
                 EXISTS (
                     SELECT 1
                     FROM public.analysis_results ar
                     JOIN public.contracts c ON ar.contract_id = c.id
                     WHERE ar.report_file_path = name -- ''name'' refers to the object name in storage.objects
                     AND c.user_id = auth.uid()
                 )
             )';
END;
$$;

-- Grant execution rights to the current user (who is running the migration)
GRANT EXECUTE ON FUNCTION public.create_authenticated_reports_delete_policy() TO postgres;

-- Execute the function
SELECT public.create_authenticated_reports_delete_policy();

-- Drop the temporary function
DROP FUNCTION public.create_authenticated_reports_delete_policy();

-- down.sql
-- This section is intentionally left empty as per user request.