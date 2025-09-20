-- Add output_language column to contracts table
ALTER TABLE public.contracts
ADD COLUMN output_language text DEFAULT 'en' NOT NULL;

-- Optional: Update existing rows with a default value if needed
-- UPDATE public.contracts
-- SET output_language = 'en'
-- WHERE output_language IS NULL;