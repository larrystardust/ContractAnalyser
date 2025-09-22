-- Set the default value of auto_start_analysis_enabled to TRUE
ALTER TABLE public.profiles
ALTER COLUMN auto_start_analysis_enabled SET DEFAULT TRUE;

-- Optional: Update existing rows that are currently FALSE to TRUE
-- Only run this if you want existing users to have auto-start analysis enabled by default
-- If you want existing users to keep their current setting (FALSE), do NOT run this UPDATE.
UPDATE public.profiles
SET auto_start_analysis_enabled = TRUE
WHERE auto_start_analysis_enabled = FALSE;