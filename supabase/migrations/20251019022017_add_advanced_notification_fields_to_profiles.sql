-- Add new columns to the profiles table for notification preferences
ALTER TABLE public.profiles
ADD COLUMN renewal_notification_days_before integer DEFAULT 30,
ADD COLUMN termination_notification_days_before integer DEFAULT 30;

-- Update the 'updated_at' column for existing rows in profiles
-- This is optional but good practice if you want to trigger RLS or other triggers
-- UPDATE public.profiles SET updated_at = now();
