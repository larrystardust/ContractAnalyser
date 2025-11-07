-- Create the cached_clause_analysis table
CREATE TABLE public.cached_clause_analysis (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clause_hash text NOT NULL UNIQUE,
    jurisdiction text[],
    analysis_type text NOT NULL, -- e.g., 'full', 'risk_only', 'dream_team'
    llm_model text NOT NULL, -- e.g., 'claude-4.5-sonnet', 'gpt-4o'
    cached_result jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add indexes for efficient lookup
CREATE INDEX idx_cached_clause_analysis_hash ON public.cached_clause_analysis USING btree (clause_hash);
CREATE INDEX idx_cached_clause_analysis_model ON public.cached_clause_analysis USING btree (llm_model);

-- Enable Row Level Security (RLS)
ALTER TABLE public.cached_clause_analysis ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow authenticated users to read cached results (as they are public/derived)
CREATE POLICY "Allow authenticated users to read cached clause analysis"
ON public.cached_clause_analysis FOR SELECT
TO authenticated
USING (true);

-- Allow service role to insert/update/delete (Edge Functions will use service role)
CREATE POLICY "Allow service role to manage cached clause analysis"
ON public.cached_clause_analysis FOR ALL
TO service_role
USING (true) WITH CHECK (true);