-- supabase/migrations/20250813020011_link_contracts_to_subscriptions.sql

-- Add subscription_id to contracts table
ALTER TABLE public.contracts
ADD COLUMN subscription_id TEXT REFERENCES public.stripe_subscriptions(subscription_id) ON DELETE SET NULL;

-- Update existing contracts with their associated subscription_id
-- This assumes a user has only one active subscription at a time.
-- This is a complex update and might need manual verification or a more robust script
-- if your data model allows multiple subscriptions per user or historical subscriptions.
UPDATE public.contracts c
SET subscription_id = (
    SELECT ss.subscription_id
    FROM public.stripe_customers sc
    JOIN public.stripe_subscriptions ss ON sc.customer_id = ss.customer_id
    WHERE sc.user_id = c.user_id
    AND ss.status IN ('trialing', 'active') -- Only link to active subscriptions
    ORDER BY ss.created_at DESC
    LIMIT 1
);

-- Create an index for faster lookups
CREATE INDEX idx_contracts_subscription_id ON public.contracts (subscription_id);

-- Update RLS for contracts to allow access to all active members of the subscription
-- This policy replaces the existing "Users can view their own contracts." policy
DROP POLICY IF EXISTS "Users can view their own contracts." ON public.contracts;
CREATE POLICY "Subscription members can view contracts."
ON public.contracts FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.subscription_memberships sm
        WHERE sm.subscription_id = contracts.subscription_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    )
    OR auth.uid() = user_id -- Allow the original uploader to always see it
);

-- Update RLS for analysis_results to allow access to all active members of the subscription
-- This policy replaces the existing "Users can view analysis results for their contracts." policy
DROP POLICY IF EXISTS "Users can view analysis results for their contracts." ON public.analysis_results;
CREATE POLICY "Subscription members can view analysis results."
ON public.analysis_results FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.contracts c
        JOIN public.subscription_memberships sm ON c.subscription_id = sm.subscription_id
        WHERE c.id = analysis_results.contract_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
    )
    OR EXISTS (
        SELECT 1
        FROM public.contracts c
        WHERE c.id = analysis_results.contract_id
        AND c.user_id = auth.uid()
    )
);

-- You might need to review and update INSERT/UPDATE/DELETE policies for contracts and analysis_results
-- to ensure only authorized users (e.g., subscription owners or the original uploader) can modify/delete.
-- For now, we'll keep the existing INSERT/UPDATE/DELETE policies which are based on user_id.
-- If you want to allow all active members to modify, you'd need to adjust those policies similarly.