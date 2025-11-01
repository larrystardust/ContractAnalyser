CREATE TABLE public.scan_sessions (
id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
user_id uuid NOT NULL,
created_at timestamp with time zone DEFAULT now() NOT NULL,
expires_at timestamp with time zone NOT NULL,
status text DEFAULT 'active'::text NOT NULL,
CONSTRAINT scan_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable Row Level Security (RLS) for the scan_sessions table
ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow users to manage their own scan sessions
CREATE POLICY "Users can manage their own scan sessions" ON public.scan_sessions
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);