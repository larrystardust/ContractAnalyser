-- Add is_admin column to profiles table
ALTER TABLE public.profiles
ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Optional: Add an index if this column will be frequently queried
CREATE INDEX idx_profiles_is_admin ON public.profiles (is_admin);

-- Optional: Update existing users to be non-admin by default
-- If you want to make a specific user an admin, you'll need to update their row manually:
-- UPDATE public.profiles SET is_admin = TRUE WHERE id = 'your_user_uuid_here';