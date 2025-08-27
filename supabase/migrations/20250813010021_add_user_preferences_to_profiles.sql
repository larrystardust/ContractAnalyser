-- supabase/migrations/20250813010021_add_user_preferences_to_profiles.sql

ALTER TABLE public.profiles
ADD COLUMN theme_preference TEXT DEFAULT 'system' NOT NULL,
ADD COLUMN email_reports_enabled BOOLEAN DEFAULT FALSE NOT NULL;

-- Optional: Update existing profiles with default values if needed
-- UPDATE public.profiles SET theme_preference = 'system', email_reports_enabled = FALSE WHERE theme_preference IS NULL;
