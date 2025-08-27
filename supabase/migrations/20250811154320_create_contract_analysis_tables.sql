-- Create 'contracts' table
CREATE TABLE public.contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    name text NOT NULL,
    file_path text NOT NULL,
    size text NOT NULL,
    jurisdictions text[] NOT NULL,
    status text NOT NULL DEFAULT 'pending', -- 'pending', 'analyzing', 'completed', 'failed'
    processing_progress integer DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key constraint for user_id in 'contracts' table
ALTER TABLE public.contracts
ADD CONSTRAINT fk_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable Row Level Security (RLS) for 'contracts' table
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for 'contracts' table to allow users to view and manage their own contracts
CREATE POLICY "Users can view their own contracts." ON public.contracts
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contracts." ON public.contracts
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contracts." ON public.contracts
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contracts." ON public.contracts
FOR DELETE USING (auth.uid() = user_id);


-- Create 'analysis_results' table
CREATE TABLE public.analysis_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id uuid NOT NULL,
    executive_summary text NOT NULL,
    data_protection_impact text,
    compliance_score integer NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key constraint for contract_id in 'analysis_results' table
ALTER TABLE public.analysis_results
ADD CONSTRAINT fk_contract_id
FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;

-- Enable Row Level Security (RLS) for 'analysis_results' table
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for 'analysis_results' table
-- Assuming analysis results should only be visible to the owner of the associated contract
CREATE POLICY "Users can view analysis results for their contracts." ON public.analysis_results
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.contracts WHERE id = contract_id AND user_id = auth.uid())
);

CREATE POLICY "Users can insert analysis results for their contracts." ON public.analysis_results
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.contracts WHERE id = contract_id AND user_id = auth.uid())
);

CREATE POLICY "Users can update analysis results for their contracts." ON public.analysis_results
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.contracts WHERE id = contract_id AND user_id = auth.uid())
);

CREATE POLICY "Users can delete analysis results for their contracts." ON public.analysis_results
FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.contracts WHERE id = contract_id AND user_id = auth.uid())
);


-- Create 'findings' table
CREATE TABLE public.findings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_result_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    risk_level text NOT NULL, -- 'high', 'medium', 'low', 'none'
    jurisdiction text NOT NULL,
    category text NOT NULL,
    recommendations text[] NOT NULL,
    clause_reference text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key constraint for analysis_result_id in 'findings' table
ALTER TABLE public.findings
ADD CONSTRAINT fk_analysis_result_id
FOREIGN KEY (analysis_result_id) REFERENCES public.analysis_results(id) ON DELETE CASCADE;

-- Enable Row Level Security (RLS) for 'findings' table
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for 'findings' table
-- Assuming findings should only be visible if the user owns the associated analysis result and contract
CREATE POLICY "Users can view findings for their analysis results." ON public.findings
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.analysis_results ar
        JOIN public.contracts c ON ar.contract_id = c.id
        WHERE ar.id = analysis_result_id AND c.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert findings for their analysis results." ON public.findings
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.analysis_results ar
        JOIN public.contracts c ON ar.contract_id = c.id
        WHERE ar.id = analysis_result_id AND c.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update findings for their analysis results." ON public.findings
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.analysis_results ar
        JOIN public.contracts c ON ar.contract_id = c.id
        WHERE ar.id = analysis_result_id AND c.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete findings for their analysis results." ON public.findings
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.analysis_results ar
        JOIN public.contracts c ON ar.contract_id = c.id
        WHERE ar.id = analysis_result_id AND c.user_id = auth.uid()
    )
);
