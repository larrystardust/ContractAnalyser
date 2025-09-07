CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000',
  default_theme text NOT NULL DEFAULT 'system',
  default_jurisdictions text[] NOT NULL DEFAULT '{}',
  global_email_reports_enabled boolean NOT NULL DEFAULT TRUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT enforce_single_row CHECK (id = '00000000-0000-0000-0000-000000000000')
);

-- Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read settings
CREATE POLICY "Allow authenticated read access to app_settings" ON public.app_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for administrators to update settings
CREATE POLICY "Allow admin update access to app_settings" ON public.app_settings
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Optional: Insert initial default settings if the table is empty
-- This ensures there's always one row to work with.
INSERT INTO public.app_settings (id, default_theme, default_jurisdictions, global_email_reports_enabled)
VALUES ('00000000-0000-0000-0000-000000000000', 'system', '{}', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Create a trigger to update the 'updated_at' column automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();