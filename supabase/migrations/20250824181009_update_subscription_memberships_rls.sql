-- Drop the existing policy that only allows users to view their own memberships
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.subscription_memberships;

-- Create a new policy that allows owners to view all memberships for their subscription,
-- and allows any user to view their own membership.
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