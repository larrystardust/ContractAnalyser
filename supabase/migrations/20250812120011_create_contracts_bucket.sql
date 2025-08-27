-- Create a new storage bucket for contracts
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false);

-- REMOVE THIS LINE: ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to upload their own contracts
CREATE POLICY "Allow authenticated users to upload their own contracts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contracts' AND auth.uid() = owner);

-- Policy to allow authenticated users to view their own contracts
CREATE POLICY "Allow authenticated users to view their own contracts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contracts' AND auth.uid() = owner);

-- Policy to allow authenticated users to update their own contracts
CREATE POLICY "Allow authenticated users to update their own contracts"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contracts' AND auth.uid() = owner);

-- Policy to allow authenticated users to delete their own contracts
CREATE POLICY "Allow authenticated users to delete their own contracts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contracts' AND auth.uid() = owner);
