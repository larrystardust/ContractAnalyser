CREATE TABLE public.stripe_product_metadata (
    price_id text PRIMARY KEY,
    product_id text NOT NULL,
    max_users integer,
    max_files integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.stripe_product_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.stripe_product_metadata FOR SELECT USING (true);