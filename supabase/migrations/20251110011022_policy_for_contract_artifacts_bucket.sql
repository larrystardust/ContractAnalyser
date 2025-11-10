CREATE POLICY "Allow authenticated users to read contract artifacts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contract_artifacts');