-- Policy for contract_artifacts bucket
CREATE POLICY "Allow service role to manage contract artifacts"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'contract_artifacts') WITH CHECK (bucket_id = 'contract_artifacts');

CREATE POLICY "Allow authenticated users to download their own contract artifacts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contract_artifacts' AND auth.uid() = (storage.foldername(name))[1]::uuid); -- Assuming path is user_id/contract_id/filename