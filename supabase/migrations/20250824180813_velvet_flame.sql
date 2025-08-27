/*
  # Fix infinite recursion in subscription_memberships RLS policy

  1. Problem
    - The current RLS policy on subscription_memberships causes infinite recursion
    - This happens when the policy queries the same table it's protecting
    - Error: "infinite recursion detected in policy for relation subscription_memberships"

  2. Solution
    - Create a SECURITY DEFINER function to check ownership without triggering RLS
    - Replace the recursive policy with one that uses this function
    - This breaks the circular dependency by running the ownership check with elevated privileges

  3. Changes
    - Drop existing problematic RLS policies
    - Create is_subscription_owner() function with SECURITY DEFINER
    - Create new non-recursive RLS policies for SELECT, INSERT, UPDATE, DELETE operations
*/

-- Drop all existing policies on subscription_memberships to start fresh
DROP POLICY IF EXISTS "Owners and members can view subscription memberships" ON public.subscription_memberships;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.subscription_memberships;
DROP POLICY IF EXISTS "Owners can invite members" ON public.subscription_memberships;
DROP POLICY IF EXISTS "Owners can update members" ON public.subscription_memberships;
DROP POLICY IF EXISTS "Users can update own membership" ON public.subscription_memberships;
DROP POLICY IF EXISTS "Owners can delete members" ON public.subscription_memberships;

-- Create a SECURITY DEFINER function to check if a user is an owner of a subscription
-- This function runs with postgres privileges, bypassing RLS and preventing recursion
CREATE OR REPLACE FUNCTION is_subscription_owner(p_user_id uuid, p_subscription_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM subscription_memberships
    WHERE user_id = p_user_id
      AND subscription_id = p_subscription_id
      AND role = 'owner'
      AND status = 'active'
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_subscription_owner(uuid, text) TO authenticated;

-- Create new RLS policies that use the SECURITY DEFINER function

-- Policy 1: SELECT - Users can view their own memberships OR all memberships if they're the owner
CREATE POLICY "subscription_memberships_select_policy"
ON public.subscription_memberships
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  is_subscription_owner(auth.uid(), subscription_id)
);

-- Policy 2: INSERT - Only owners can invite new members
CREATE POLICY "subscription_memberships_insert_policy"
ON public.subscription_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  is_subscription_owner(auth.uid(), subscription_id) AND
  user_id != auth.uid() AND
  role = 'member' AND
  status = 'invited'
);

-- Policy 3: UPDATE - Owners can update any member, users can update their own membership
CREATE POLICY "subscription_memberships_update_policy"
ON public.subscription_memberships
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR 
  is_subscription_owner(auth.uid(), subscription_id)
)
WITH CHECK (
  user_id = auth.uid() OR 
  is_subscription_owner(auth.uid(), subscription_id)
);

-- Policy 4: DELETE - Only owners can delete members
CREATE POLICY "subscription_memberships_delete_policy"
ON public.subscription_memberships
FOR DELETE
TO authenticated
USING (
  is_subscription_owner(auth.uid(), subscription_id)
);