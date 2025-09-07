import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase';
import { Jurisdiction } from '../types';

export interface AppSettings {
  id: string;
  default_theme: 'light' | 'dark' | 'system';
  default_jurisdictions: Jurisdiction[];
  global_email_reports_enabled: boolean;
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
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-app-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch app settings.');
      }

      const data = await response.json();
      setSettings(data.settings);
    } catch (err: any) {
      console.error('Error fetching app settings:', err);
      setError(err.message || 'Failed to load application settings.');
    } finally {
      setLoading(false);
    }
  }, [session, supabase]);

  const updateSettings = useCallback(async (updatedData: Partial<AppSettings>) => {
    if (!session?.user?.id) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true); // Indicate saving process
    setError(null);
    try {
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