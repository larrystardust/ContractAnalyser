-- Drop the problematic RLS policy first
DROP POLICY IF EXISTS "Owners and members can view subscription memberships" ON public.subscription_memberships;

-- Create a SECURITY DEFINER function to check if a user is an owner of a subscription
-- This function runs with the privileges of the user who created it (postgres),
-- bypassing RLS on the subscription_memberships table when it's called from an RLS policy.
CREATE OR REPLACE FUNCTION is_owner_of_subscription(p_user_id uuid, p_subscription_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Crucial: runs with definer's privileges, bypassing RLS on its own query
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.subscription_memberships
    WHERE
      user_id = p_user_id AND
      subscription_id = p_subscription_id AND
      role = 'owner'::text AND
      status = 'active'::text
  );
END;
$$;

-- Grant execution to authenticated users so the RLS policy can call it
GRANT EXECUTE ON FUNCTION is_owner_of_subscription(uuid, text) TO authenticated;

-- Create the new RLS policy using the function
CREATE POLICY "Owners and members can view subscription memberships"
ON public.subscription_memberships
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid()) OR
  (is_owner_of_subscription(auth.uid(), subscription_id))
);