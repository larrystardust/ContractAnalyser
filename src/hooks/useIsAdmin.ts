import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase';

export function useIsAdmin() {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAdminStatus, setLoadingAdminStatus] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!session?.user?.id) {
        setIsAdmin(false);
        setLoadingAdminStatus(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching admin status in useIsAdmin hook:', error);
          setIsAdmin(false); // Fallback to not admin on errors
        } else {
          setIsAdmin(data?.is_admin || false);
        }
      } catch (err) {
        console.error('Unexpected error checking admin status in useIsAdmin hook:', err);
        setIsAdmin(false);
      } finally {
        setLoadingAdminStatus(false);
      }
    };

    checkAdminStatus();
  }, [session?.user?.id, supabase]);

  return { isAdmin, loadingAdminStatus };
}