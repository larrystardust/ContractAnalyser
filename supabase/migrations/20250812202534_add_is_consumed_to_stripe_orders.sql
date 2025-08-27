-- supabase/migrations/20250812200000_add_is_consumed_to_stripe_orders.sql

ALTER TABLE public.stripe_orders
ADD COLUMN is_consumed BOOLEAN DEFAULT FALSE NOT NULL;

-- Optional: Add an index for faster lookup of unconsumed orders
CREATE INDEX idx_stripe_orders_customer_id_is_consumed
ON public.stripe_orders (customer_id, is_consumed);

-- Add RLS policy to allow users to view their own orders based on is_consumed
-- This assumes your existing policy is:
-- ((customer_id IN ( SELECT stripe_customers.customer_id FROM stripe_customers WHERE ((stripe_customers.user_id = uid()) AND (stripe_customers.deleted_at IS NULL)))) AND (deleted_at IS NULL))
-- We will modify it to include is_consumed if needed, but for now, the existing policy should cover it.
-- If you need to restrict viewing only *unconsumed* orders, you'd adjust the RLS policy.
