import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase';

// MODIFIED: Added max_files to the Subscription type
export type Subscription = Database['public']['Tables']['stripe_subscriptions']['Row'] & { max_users?: number; max_files?: number; };
export type SubscriptionMembership = Database['public']['Tables']['subscription_memberships']['Row'];

export function useSubscription() {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [membership, setMembership] = useState<SubscriptionMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function getSubscriptionAndMembership() {
      console.log('useSubscription: Fetching subscription and membership...');
      if (!session?.user?.id) {
        console.log('useSubscription: No user session. Resetting state.');
        setSubscription(null);
        setMembership(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let fetchedSubscription: Subscription | null = null;
        let fetchedMembership: SubscriptionMembership | null = null;

        // 1. First, try to fetch the user's membership record
        console.log('useSubscription: Attempting to fetch membership record for user:', session.user.id);
        const { data: memberData, error: memberError } = await supabase
          .from('subscription_memberships')
          .select('*')
          .eq('user_id', session.user.id)
          .in('status', ['active', 'invited']) // Consider both active and invited memberships
          .maybeSingle();

        if (memberError) {
          console.error('useSubscription: Error fetching membership record:', memberError);
          throw memberError;
        }

        if (memberData) {
          // If a membership record is found, use its subscription_id to fetch the subscription details
          fetchedMembership = memberData;
          setMembership(fetchedMembership);
          console.log('useSubscription: Found membership:', fetchedMembership);

          console.log('useSubscription: Fetching subscription details for subscription_id:', fetchedMembership.subscription_id);
          const { data: subData, error: subError } = await supabase
            .from('stripe_subscriptions')
            .select('*, max_users, max_files')
            .eq('subscription_id', fetchedMembership.subscription_id)
            .maybeSingle();

          if (subError) {
            console.error('useSubscription: Error fetching subscription details:', subError);
            throw subError;
          }
          fetchedSubscription = subData;
          setSubscription(fetchedSubscription);
          console.log('useSubscription: Found subscription:', fetchedSubscription);

        } else {
          // 2. If no membership record is found, check if the user is a direct customer (owner)
          console.log('useSubscription: No membership found. Attempting to fetch customer record for user:', session.user.id);
          const { data: customerData, error: customerError } = await supabase
            .from('stripe_customers')
            .select('customer_id')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (customerError) {
            console.error('useSubscription: Error fetching customer record:', customerError);
            throw customerError;
          }

          if (customerData?.customer_id) {
            console.log('useSubscription: Found customer_id:', customerData.customer_id);
            console.log('useSubscription: Fetching direct subscription for customer_id:', customerData.customer_id);
            const { data: subData, error: subError } = await supabase
              .from('stripe_subscriptions')
              .select('*, max_users, max_files')
              .eq('customer_id', customerData.customer_id)
              .in('status', ['trialing', 'active']) // Only consider active subscriptions
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (subError) {
              console.error('useSubscription: Error fetching direct subscription:', subError);
              throw subError;
            }
            fetchedSubscription = subData;
            setSubscription(fetchedSubscription);
            console.log('useSubscription: Found direct subscription:', fetchedSubscription);

            // If a direct subscription is found, ensure an 'owner' membership exists for consistency
            if (fetchedSubscription) {
              console.log('useSubscription: Upserting owner membership for direct subscriber...');
              const { data: upsertedMember, error: upsertError } = await supabase
                .from('subscription_memberships')
                .upsert(
                  {
                    user_id: session.user.id,
                    subscription_id: fetchedSubscription.subscription_id,
                    role: 'owner',
                    status: 'active',
                    accepted_at: new Date().toISOString(),
                  },
                  { onConflict: ['user_id', 'subscription_id'] }
                )
                .select()
                .single();

              if (upsertError) {
                console.error('useSubscription: Error upserting owner membership:', upsertError);
                // Do not throw, just log the error and proceed
              } else {
                fetchedMembership = upsertedMember;
                setMembership(fetchedMembership);
                console.log('useSubscription: Upserted owner membership:', fetchedMembership);
              }
            }
          } else {
            console.log('useSubscription: No customer_id found for user.');
          }
        }
      } catch (err: any) {
        console.error('useSubscription: Overall error fetching subscription or membership:', err);
        setError(err);
        setSubscription(null);
        setMembership(null);
      } finally {
        console.log('useSubscription: Finished fetching. Loading set to false.');
        setLoading(false);
      }
    }

    getSubscriptionAndMembership();
  }, [supabase, session?.user?.id]);

  return { subscription, membership, loading, error };
}