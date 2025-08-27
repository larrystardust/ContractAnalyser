-- supabase/migrations/20250813011519_add_max_users_and_subscription_memberships.sql

-- Add max_users column to stripe_subscriptions
ALTER TABLE public.stripe_subscriptions
ADD COLUMN max_users INTEGER DEFAULT 1; -- Default to 1 for single-user plans

-- Create subscription_memberships table
CREATE TABLE public.subscription_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id TEXT REFERENCES public.stripe_subscriptions(subscription_id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', -- e.g., 'owner', 'member'
    status TEXT NOT NULL DEFAULT 'active', -- e.g., 'active', 'invited', 'inactive'
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Who invited this user
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (subscription_id, user_id) -- A user can only be a member of a subscription once
);

-- Indexes for faster lookups
CREATE INDEX idx_subscription_memberships_subscription_id ON public.subscription_memberships (subscription_id);
CREATE INDEX idx_subscription_memberships_user_id ON public.subscription_memberships (user_id);

-- Enable Row Level Security for subscription_memberships
ALTER TABLE public.subscription_memberships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_memberships
-- Owners can view all members of their subscription
CREATE POLICY "Owners can view all members of their subscription."
ON public.subscription_memberships FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.subscription_memberships sm_owner
        WHERE sm_owner.subscription_id = subscription_memberships.subscription_id
        AND sm_owner.user_id = auth.uid()
        AND sm_owner.role = 'owner'
        AND sm_owner.status = 'active'
    )
);

-- Owners can invite new members (insert)
CREATE POLICY "Owners can invite new members."
ON public.subscription_memberships FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.subscription_memberships sm_owner
        WHERE sm_owner.subscription_id = subscription_memberships.subscription_id
        AND sm_owner.user_id = auth.uid()
        AND sm_owner.role = 'owner'
        AND sm_owner.status = 'active'
    )
    AND subscription_memberships.user_id != auth.uid() -- Cannot invite self
    AND subscription_memberships.role = 'member' -- Only owners can invite members
    AND subscription_memberships.status = 'invited' -- Initial status is invited
);

-- Members can update their own status (e.g., accept invitation)
CREATE POLICY "Members can update their own status."
ON public.subscription_memberships FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Owners can update members' roles/status (e.g., remove member)
CREATE POLICY "Owners can manage members."
ON public.subscription_memberships FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.subscription_memberships sm_owner
        WHERE sm_owner.subscription_id = subscription_memberships.subscription_id
        AND sm_owner.user_id = auth.uid()
        AND sm_owner.role = 'owner'
        AND sm_owner.status = 'active'
    )
);

-- Owners can delete members
CREATE POLICY "Owners can delete members."
ON public.subscription_memberships FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.subscription_memberships sm_owner
        WHERE sm_owner.subscription_id = subscription_memberships.subscription_id
        AND sm_owner.user_id = auth.uid()
        AND sm_owner.role = 'owner'
        AND sm_owner.status = 'active'
    )
);

-- Initial data for max_users based on existing products (adjust price_id as needed)
-- This is a one-time update. Run this after the ALTER TABLE statement.
UPDATE public.stripe_subscriptions
SET max_users = 2
WHERE price_id = 'price_1RRwf1A2AL71pSgRJuQ61Bni'; -- Professional Use price_id

UPDATE public.stripe_subscriptions
SET max_users = 999999 -- Effectively unlimited
WHERE price_id = 'price_1RRwnFA2AL71pSgRLU6QhzlT'; -- Enterprise Use price_id

-- For single use, it's already default 1.