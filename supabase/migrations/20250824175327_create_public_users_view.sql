CREATE OR REPLACE VIEW public.users AS
SELECT
    id,
    aud,
    role,
    email,
    email_confirmed_at,
    phone,
    phone_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_sso_user,
    created_at,
    updated_at
FROM auth.users;

ALTER VIEW public.users OWNER TO postgres;
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;