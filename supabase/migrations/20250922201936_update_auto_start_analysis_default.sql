-- Set the default value of auto_start_analysis_enabled to TRUE
ALTER TABLE public.profiles
ALTER COLUMN auto_start_analysis_enabled SET DEFAULT TRUE;