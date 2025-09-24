-- up.sql
ALTER TABLE public.stripe_orders
RENAME COLUMN is_consumed TO credits_remaining;

ALTER TABLE public.stripe_orders
ALTER COLUMN credits_remaining TYPE INTEGER USING CASE WHEN credits_remaining THEN 1 ELSE 0 END;

ALTER TABLE public.stripe_orders
ALTER COLUMN credits_remaining SET DEFAULT 0;

-- down.sql
ALTER TABLE public.stripe_orders
ALTER COLUMN credits_remaining TYPE BOOLEAN USING CASE WHEN credits_remaining > 0 THEN TRUE ELSE FALSE END;

ALTER TABLE public.stripe_orders
RENAME COLUMN credits_remaining TO is_consumed;

ALTER TABLE public.stripe_orders
ALTER COLUMN is_consumed SET DEFAULT FALSE;