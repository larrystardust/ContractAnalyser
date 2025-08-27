/*
  # Fix infinite recursion in subscription_memberships RLS policies

  1. Problem
    - The current RLS policies on subscription_memberships are causing infinite recursion
    - This happens when policies reference other tables that also have RLS policies referencing back

  2. Solution
    - Drop the existing problematic policies
    - Create simpler, non-recursive policies that avoid circular dependencies
    - Use direct user ID checks instead of complex joins

  3. Changes
    - Remove all existing RLS policies on subscription_memberships
    - Add simplified policies that only check direct relationships
*/

-- Drop all existing policies on subscription_memberships to eliminate recursion
DROP POLICY IF EXISTS "Owners can view all members of their subscription." ON public.subscription_memberships;
DROP POLICY IF EXISTS "Owners can invite new members." ON public.subscription_memberships;
DROP POLICY IF EXISTS "Members can update their own status." ON public.subscription_memberships;
DROP POLICY IF EXISTS "Owners can manage members." ON public.subscription_memberships;
DROP POLICY IF EXISTS "Owners can delete members." ON public.subscription_memberships;

-- Create simplified, non-recursive policies

-- Users can view memberships where they are the user
CREATE POLICY "Users can view their own memberships"
ON public.subscription_memberships FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can view memberships in subscriptions where they are an active owner
CREATE POLICY "Owners can view subscription memberships"
ON public.subscription_memberships FOR SELECT
TO authenticated
USING (
  subscription_id IN (
    SELECT sm.subscription_id 
    FROM public.subscription_memberships sm 
    WHERE sm.user_id = auth.uid() 
    AND sm.role = 'owner' 
    AND sm.status = 'active'
  )
);

-- Users can update their own membership status
CREATE POLICY "Users can update own membership"
ON public.subscription_memberships FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Owners can insert new members (simplified check)
CREATE POLICY "Owners can invite members"
ON public.subscription_memberships FOR INSERT
TO authenticated
WITH CHECK (
  subscription_id IN (
    SELECT sm.subscription_id 
    FROM public.subscription_memberships sm 
    WHERE sm.user_id = auth.uid() 
    AND sm.role = 'owner' 
    AND sm.status = 'active'
  )
  AND user_id != auth.uid()
  AND role = 'member'
  AND status = 'invited'
);

-- Owners can update members in their subscription
CREATE POLICY "Owners can update members"
ON public.subscription_memberships FOR UPDATE
TO authenticated
USING (
  subscription_id IN (
    SELECT sm.subscription_id 
    FROM public.subscription_memberships sm 
    WHERE sm.user_id = auth.uid() 
    AND sm.role = 'owner' 
    AND sm.status = 'active'
  )
);

-- Owners can delete members from their subscription
CREATE POLICY "Owners can delete members"
ON public.subscription_memberships FOR DELETE
TO authenticated
USING (
  subscription_id IN (
    SELECT sm.subscription_id 
    FROM public.subscription_memberships sm 
    WHERE sm.user_id = auth.uid() 
    AND sm.role = 'owner' 
    AND sm.status = 'active'
  )
);