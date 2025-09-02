-- up.sql
-- Ensure RLS is enabled on storage.objects. This is usually enabled by default in new Supabase projects.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows the 'service_role' to perform all operations (SELECT, INSERT, UPDATE, DELETE)
-- on objects within the 'reports' bucket.
-- Note: The 'service_role' key typically bypasses RLS, so this policy might be redundant for the service key itself,
-- but it explicitly defines the intended access for the 'service_role' within the RLS framework.
CREATE POLICY "Allow service_role to manage reports bucket"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'reports');