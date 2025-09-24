-- 1. Remove the existing default constraint on is_consumed
ALTER TABLE public.stripe_orders
ALTER COLUMN is_consumed DROP DEFAULT;

-- 2. Rename the column
ALTER TABLE public.stripe_orders
RENAME COLUMN is_consumed TO credits_remaining;

-- 3. Change the column type and convert existing boolean values to integer
ALTER TABLE public.stripe_orders
ALTER COLUMN credits_remaining TYPE INTEGER USING CASE WHEN credits_remaining THEN 1 ELSE 0 END;

-- 4. Add the new default constraint for the integer type
ALTER TABLE public.stripe_orders
ALTER COLUMN credits_remaining SET DEFAULT 0;