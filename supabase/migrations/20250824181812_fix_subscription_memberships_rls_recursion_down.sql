-- Drop the new RLS policy
DROP POLICY IF EXISTS "Owners and members can view subscription memberships" ON public.subscription_memberships;

-- Drop the function
DROP FUNCTION IF EXISTS is_owner_of_subscription(uuid, text);

-- Re-create the previous (problematic) RLS policy for rollback purposes
-- This policy caused recursion, but is included for full rollback capability.
CREATE POLICY "Owners and members can view subscription memberships"
ON public.subscription_memberships
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid()) OR
  (
    EXISTS (
      SELECT 1
      FROM public.subscription_memberships AS sm_owner
      WHERE
        sm_owner.subscription_id = public.subscription_memberships.subscription_id AND
        sm_owner.user_id = auth.uid() AND
        sm_owner.role = 'owner'::text AND
        sm_owner.status = 'active'::text
    )
  )
);
