-- Add auto_start_analysis_enabled to profiles table
ALTER TABLE public.profiles
ADD COLUMN auto_start_analysis_enabled BOOLEAN DEFAULT TRUE;

-- Set existing users to FALSE for this new column
UPDATE public.profiles
SET auto_start_analysis_enabled = TRUE
WHERE auto_start_analysis_enabled IS NULL;

-- Ensure the column is not nullable
ALTER TABLE public.profiles
ALTER COLUMN auto_start_analysis_enabled SET NOT NULL;