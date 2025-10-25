ALTER TABLE public.stripe_product_metadata
ADD COLUMN tier INTEGER;

-- You might want to add a default value or make it NOT NULL later if all products will have a tier.
-- For now, it's nullable to allow existing rows to be updated.

-- Optional: Add an index if you plan to query by tier frequently
-- CREATE INDEX idx_stripe_product_metadata_tier ON public.stripe_product_metadata (tier);