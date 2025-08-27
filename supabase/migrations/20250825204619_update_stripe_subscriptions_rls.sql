-- migrations/20250825204619_update_stripe_subscriptions_rls.sql

-- Alter the existing SELECT policy on public.stripe_subscriptions
ALTER POLICY "Users can view their own subscription data" ON public.stripe_subscriptions
USING (
  (
    -- Condition 1: User is the customer (owner) of the subscription
    (public.stripe_subscriptions.customer_id IN (
      SELECT public.stripe_customers.customer_id
      FROM public.stripe_customers
      WHERE (public.stripe_customers.user_id = auth.uid()) AND (public.stripe_customers.deleted_at IS NULL)
    ))
    OR
    -- Condition 2: User is an active member of the subscription
    (EXISTS (
      SELECT 1
      FROM public.subscription_memberships sm
      WHERE (sm.subscription_id = public.stripe_subscriptions.subscription_id)
        AND (sm.user_id = auth.uid())
        AND (sm.status = 'active'::text)
    ))
  )
  -- Additional condition: The subscription itself is not marked as deleted
  AND (public.stripe_subscriptions.deleted_at IS NULL)
);