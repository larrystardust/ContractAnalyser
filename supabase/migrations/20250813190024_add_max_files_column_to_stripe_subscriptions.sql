ALTER TABLE public.stripe_subscriptions
ADD COLUMN max_files INTEGER;

-- Update existing subscription types with their respective quotas
-- You'll need to know the price_id for your Professional and Enterprise plans
UPDATE public.stripe_subscriptions
SET max_files = 200
WHERE price_id = 'price_1RRwf1A2AL71pSgRJuQ61Bni'; -- Replace with your Professional price_id

UPDATE public.stripe_subscriptions
SET max_files = 1000
WHERE price_id = 'price_1RRwnFA2AL71pSgRLU6QhzlT'; -- Replace with your Enterprise price_id

-- For any other plans (e.g., single-use or free tiers), you might set it to NULL or a very high number
-- UPDATE public.stripe_subscriptions
-- SET max_files = NULL
-- WHERE price_id = 'your_single_use_price_id';