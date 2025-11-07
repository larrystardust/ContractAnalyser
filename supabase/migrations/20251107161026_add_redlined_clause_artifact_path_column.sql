-- Add redlined_clause_artifact_path column to analysis_results
ALTER TABLE public.analysis_results
ADD COLUMN redlined_clause_artifact_path text NULL;