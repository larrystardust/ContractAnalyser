import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase';
import { Jurisdiction } from '../types'; // Import Jurisdiction type

export function useUserProfile() {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const [defaultJurisdictions, setDefaultJurisdictions] = useState<Jurisdiction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) {
        setDefaultJurisdictions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('default_jurisdictions')
          .eq('id', session.user.id)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
          throw fetchError;
        }

        setDefaultJurisdictions((data?.default_jurisdictions as Jurisdiction[]) || []);
      } catch (err: any) {
        console.error('Error fetching user profile for jurisdictions:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [session?.user?.id, supabase]);

  return { defaultJurisdictions, loading, error };
}