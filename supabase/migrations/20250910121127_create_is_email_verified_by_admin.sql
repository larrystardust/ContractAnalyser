-- Up Migration
ALTER TABLE public.profiles
ADD COLUMN is_email_verified_by_admin BOOLEAN DEFAULT FALSE;