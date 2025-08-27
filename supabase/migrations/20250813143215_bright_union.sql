/*
  # Add user preferences columns to profiles table

  1. New Columns
    - `default_jurisdictions` (text array) - stores user's preferred jurisdictions for contract uploads
    - `theme_preference` (text) - stores user's theme preference (light, dark, system)
    - `email_reports_enabled` (boolean) - controls whether user receives email reports

  2. Security
    - No additional RLS policies needed as existing policies cover these columns
*/

-- Add default_jurisdictions column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'default_jurisdictions'
  ) THEN
    ALTER TABLE profiles ADD COLUMN default_jurisdictions text[] DEFAULT '{}';
  END IF;
END $$;

-- Add theme_preference column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'theme_preference'
  ) THEN
    ALTER TABLE profiles ADD COLUMN theme_preference text DEFAULT 'system';
  END IF;
END $$;

-- Add email_reports_enabled column (this already exists but ensuring it's there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email_reports_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email_reports_enabled boolean DEFAULT false;
  END IF;
END $$;