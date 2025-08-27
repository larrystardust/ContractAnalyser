-- supabase/migrations/20250813010522_add_unique_to_stripe_subscription_id.sql

-- Add a unique constraint to the subscription_id column in stripe_subscriptions
ALTER TABLE public.stripe_subscriptions
ADD CONSTRAINT unique_stripe_subscription_id UNIQUE (subscription_id);

-- Optional: If there are existing NULL values in subscription_id and you want to enforce NOT NULL,
-- you would first need to update those NULLs to a non-NULL value or delete the rows,
-- then add NOT NULL. However, for Stripe subscription IDs, they should generally not be NULL.
-- If you encounter issues due to existing NULLs, you might need to adjust this.
-- For now, PostgreSQL allows multiple NULLs in a UNIQUE constraint unless NOT NULL is also specified.
