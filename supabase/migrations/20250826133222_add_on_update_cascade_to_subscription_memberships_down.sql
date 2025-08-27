-- down.sql
-- Drop the foreign key constraint with ON UPDATE CASCADE
ALTER TABLE public.subscription_memberships
DROP CONSTRAINT subscription_memberships_subscription_id_fkey;

-- Add the foreign key constraint back without ON UPDATE CASCADE
ALTER TABLE public.subscription_memberships
ADD CONSTRAINT subscription_memberships_subscription_id_fkey
FOREIGN KEY (subscription_id)
REFERENCES public.stripe_subscriptions(subscription_id)
ON DELETE CASCADE;