-- Create email_otps table
CREATE TABLE public.email_otps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    otp_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_used boolean DEFAULT false NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- Create policies for email_otps table (only service_role can access)
CREATE POLICY "Enable all access for service role" ON public.email_otps
FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.uid() = '00000000-0000-0000-0000-000000000000' -- Placeholder for service_role, actual check is done in Edge Function
  )
);

-- This policy is a placeholder. In a real scenario, you'd typically grant
-- access to the service_role key directly within the Edge Function,
-- bypassing RLS. The RLS is primarily for client-side access.
-- For Edge Functions using the service_role key, RLS is bypassed by default.
-- So, these policies are more for clarity and to prevent accidental client access.