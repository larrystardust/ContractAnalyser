-- supabase/migrations/20250812223726_create_notifications_table.sql

CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info' NOT NULL, -- e.g., 'info', 'warning', 'success', 'error'
    is_read boolean DEFAULT FALSE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable Row Level Security for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view their own notifications
CREATE POLICY "Users can view their own notifications."
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy for authenticated users to insert notifications (e.g., from backend functions)
-- This policy allows users to insert, but typically notifications are inserted by backend services.
-- You might want to restrict this to 'service_role' if notifications are only system-generated.
CREATE POLICY "Users can insert their own notifications."
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy for authenticated users to update their own notifications (e.g., mark as read)
CREATE POLICY "Users can update their own notifications."
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Policy for authenticated users to delete their own notifications
CREATE POLICY "Users can delete their own notifications."
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);