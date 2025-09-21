import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase';
import { Jurisdiction } from '../types';

export interface AppSettings {
  id: string;
  default_theme: 'light' | 'dark' | 'system';
  default_jurisdictions: Jurisdiction[];
  global_email_reports_enabled: boolean;
  is_maintenance_mode: boolean; // ADDED: New field
  created_at: string;
  updated_at: string;
}

export function useAppSettings() {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      // If no user is logged in, you might want to load default settings
      // or handle this state appropriately for public-facing pages.
      // For now, we'll assume authenticated access is required for these settings.
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Directly query the app_settings table
      const { data, error: fetchError } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000000') // Assuming a single row with this ID
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      // If no settings found (e.g., table is empty or not initialized), provide a default fallback
      if (!data) {
        setSettings({
          id: '00000000-0000-0000-0000-000000000000',
          default_theme: 'system',
          default_jurisdictions: [],
          global_email_reports_enabled: true,
          is_maintenance_mode: false, // ADDED: Default value for new field
          created_at: new Date().toISOString(), // Placeholder
          updated_at: new Date().toISOString(), // Placeholder
        });
      } else {
        setSettings(data as AppSettings);
      }
    } catch (err: any) {
      console.error('Error fetching app settings directly:', err);
      setError(err.message || 'Failed to load application settings.');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, supabase]);

  const updateSettings = useCallback(async (updatedData: Partial<AppSettings>) => {
    if (!session?.user?.id) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true); // Indicate saving process
    setError(null);
    try {
      // This still calls the admin-only Edge Function, which is correct for updates
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-app-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update app settings.');
      }

      const data = await response.json();
      setSettings(data.settings); // Update state with the newly saved settings
      return true;
    } catch (err: any) {
      console.error('Error updating app settings:', err);
      setError(err.message || 'Failed to update application settings.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [session, supabase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, error, fetchSettings, updateSettings };
}