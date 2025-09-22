-- Add language_preference column to profiles table
ALTER TABLE public.profiles
ADD COLUMN language_preference text DEFAULT 'en';

-- Optional: Update existing profiles to 'en' if you want to explicitly set it
-- UPDATE public.profiles SET language_preference = 'en' WHERE language_preference IS NULL;