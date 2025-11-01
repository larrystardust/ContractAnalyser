-- Policies for the 'temp_scans' storage bucket

-- Allow authenticated users to upload files to their specific user/session folder
CREATE POLICY "Allow authenticated users to upload to their scan session folder" ON storage.objects
FOR INSERT WITH CHECK (
bucket_id = 'temp_scans' AND auth.role() = 'authenticated' AND (storage.foldername(name)) = auth.uid()::text
);

-- Allow authenticated users to download files from their specific user/session folder
CREATE POLICY "Allow authenticated users to download from their scan session folder" ON storage.objects
FOR SELECT USING (
bucket_id = 'temp_scans' AND auth.role() = 'authenticated' AND (storage.foldername(name)) = auth.uid()::text
);

-- Allow authenticated users to delete files from their specific user/session folder
CREATE POLICY "Allow authenticated users to delete from their scan session folder" ON storage.objects
FOR DELETE USING (
bucket_id = 'temp_scans' AND auth.role() = 'authenticated' AND (storage.foldername(name)) = auth.uid()::text
);