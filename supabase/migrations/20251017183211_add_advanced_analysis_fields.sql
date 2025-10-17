ALTER TABLE public.analysis_results
ADD COLUMN effective_date text NULL,
ADD COLUMN termination_date text NULL,
ADD COLUMN renewal_date text NULL,
ADD COLUMN contract_type text NULL,
ADD COLUMN contract_value text NULL,
ADD COLUMN parties text[] NULL,
ADD COLUMN liability_cap_summary text NULL,
ADD COLUMN indemnification_clause_summary text NULL,
ADD COLUMN confidentiality_obligations_summary text NULL;

-- Optional: Add indexes for frequently queried advanced fields if needed for performance
-- Uncomment and modify these lines if you anticipate frequent queries on these new columns
-- CREATE INDEX idx_analysis_results_effective_date ON public.analysis_results (effective_date);
-- CREATE INDEX idx_analysis_results_termination_date ON public.analysis_results (termination_date);
-- CREATE INDEX idx_analysis_results_contract_type ON public.analysis_results (contract_type);