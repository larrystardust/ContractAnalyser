-- supabase/migrations/20250812182918_create_inquiries_and_support_tickets_tables.sql

-- Create the inquiries table for public contact form submissions
CREATE TABLE public.inquiries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    recaptcha_token text, -- Store reCAPTCHA token for verification on backend
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Optional: Add RLS for inquiries if you want to restrict who can view them
-- For public submissions, you might not need RLS on this table if only admins access it directly.
-- If you expose an API for users to view their own inquiries, then RLS is needed.
-- For now, assuming public submission, no RLS needed for users to SELECT.
-- Only backend/admin should INSERT.

-- Create the support_tickets table for authenticated user support requests
CREATE TABLE public.support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Link to auth.users table
    subject text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'open' NOT NULL, -- e.g., 'open', 'in_progress', 'closed'
    priority text DEFAULT 'medium' NOT NULL, -- e.g., 'low', 'medium', 'high', 'urgent'
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security for support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view their own support tickets
CREATE POLICY "Users can view their own support tickets."
ON public.support_tickets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy for authenticated users to create their own support tickets
CREATE POLICY "Users can create their own support tickets."
ON public.support_tickets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy for authenticated users to update their own support tickets (e.g., add more info)
CREATE POLICY "Users can update their own support tickets."
ON public.support_tickets FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Optional: Policy for admins to manage all support tickets (if you have an admin role)
-- CREATE POLICY "Admins can manage all support tickets."
-- ON public.support_tickets FOR ALL
-- TO service_role -- Or a specific admin role
-- USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Set up functions to update updated_at column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inquiries_updated_at
BEFORE UPDATE ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();