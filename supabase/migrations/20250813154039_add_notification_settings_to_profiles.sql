ALTER TABLE public.profiles
ADD COLUMN notification_settings JSONB DEFAULT '{}'::JSONB;

COMMENT ON COLUMN public.profiles.notification_settings IS 'Granular notification preferences for the user.';