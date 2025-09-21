ALTER TABLE public.app_settings
ADD COLUMN is_maintenance_mode BOOLEAN DEFAULT FALSE NOT NULL;