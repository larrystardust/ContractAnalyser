-- Up Migration
ALTER TABLE public.analysis_results
ADD COLUMN jurisdiction_summaries JSONB;

-- Down Migration
ALTER TABLE public.analysis_results
DROP COLUMN jurisdiction_summaries;
