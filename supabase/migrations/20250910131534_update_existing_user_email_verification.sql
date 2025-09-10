UPDATE public.profiles
SET is_email_verified_by_admin = TRUE
WHERE id IN (SELECT id FROM auth.users WHERE email_confirmed_at IS NOT NULL);