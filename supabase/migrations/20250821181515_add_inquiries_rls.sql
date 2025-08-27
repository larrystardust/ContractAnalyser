-- Enable Row Level Security for the inquiries table
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Policy for INSERT: Anyone can submit inquiries
CREATE POLICY "Anyone can submit inquiries"
ON public.inquiries FOR INSERT
TO public
WITH CHECK (true);

-- Policy for SELECT: Admins can view inquiries
CREATE POLICY "Admins can view inquiries"
ON public.inquiries FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Policy for UPDATE: Admins can update inquiries
CREATE POLICY "Admins can update inquiries"
ON public.inquiries FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Policy for DELETE: Admins can delete inquiries
CREATE POLICY "Admins can delete inquiries"
ON public.inquiries FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));