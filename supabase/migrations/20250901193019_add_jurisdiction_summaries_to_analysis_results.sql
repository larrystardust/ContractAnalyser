-- Create a new migration file (e.g., add_jurisdiction_summaries_to_analysis_results.sql)
-- and add the following SQL:

-- Up Migration
ALTER TABLE public.analysis_results
ADD COLUMN jurisdiction_summaries JSONB;

-- Down Migration
ALTER TABLE public.analysis_results
DROP COLUMN jurisdiction_summaries;