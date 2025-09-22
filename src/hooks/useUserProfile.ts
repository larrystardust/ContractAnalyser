import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase';
import { Jurisdiction } from '../types'; // Import Jurisdiction type

export function useUserProfile() {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const [defaultJurisdictions, setDefaultJurisdictions] = useState<Jurisdiction[]>([]);
  const [emailReportsEnabled, setEmailReportsEnabled] = useState(false); // ADDED
  const [autoStartAnalysisEnabled, setAutoStartAnalysisEnabled] = useState(false); // ADDED
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) {
        setDefaultJurisdictions([]);
        setEmailReportsEnabled(false); // ADDED
        setAutoStartAnalysisEnabled(false); // ADDED
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('default_jurisdictions, email_reports_enabled, auto_start_analysis_enabled') // MODIFIED: Select new columns
          .eq('id', session.user.id)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
          throw fetchError;
        }

        setDefaultJurisdictions((data?.default_jurisdictions as Jurisdiction[]) || []);
        setEmailReportsEnabled(data?.email_reports_enabled || false); // ADDED
        setAutoStartAnalysisEnabled(data?.auto_start_analysis_enabled || false); // ADDED
      } catch (err: any) {
        console.error('Error fetching user profile for jurisdictions:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [session?.user?.id, supabase]);

  return { defaultJurisdictions, emailReportsEnabled, autoStartAnalysisEnabled, loading, error }; // MODIFIED: Return new states
}