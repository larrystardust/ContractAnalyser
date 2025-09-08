import { useEffect, useState, useCallback, useRef } from 'react'; // Import useRef
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase';
import { stripeProducts } from '../../supabase/functions/_shared/stripe_products_data';
import { RealtimeChannel } from '@supabase/supabase-js'; // Import RealtimeChannel type

export type StripeOrder = Database['public']['Tables']['stripe_orders']['Row'];

export function useUserOrders() {
  const supabase = useSupabaseClient<Database>();
  const session = useSession();
  const [orders, setOrders] = useState<StripeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null); // Store customerId
  const channelRef = useRef<RealtimeChannel | null>(null); // Use useRef for the channel

  // Use useCallback to memoize fetchOrders
  const fetchOrders = useCallback(async (currentCustomerId: string | null) => {
    if (!session?.user?.id || !currentCustomerId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: ordersData, error: ordersError } = await supabase
        .from('stripe_orders')
        .select('*')
        .eq('customer_id', currentCustomerId)
        .order('created_at', { ascending: false });

      if (ordersError) {
        throw ordersError;
      }

      setOrders(ordersData || []);
    } catch (err: any) {
      console.error('Error fetching user orders:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, session?.user?.id]); // Dependencies for useCallback

  // Effect to fetch customer ID and initial orders
  useEffect(() => {
    async function getCustomerIdAndInitialOrders() {
      if (!session?.user?.id) {
        setCustomerId(null);
        setOrders([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data: customerData, error: customerError } = await supabase
          .from('stripe_customers')
          .select('customer_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (customerError) {
          throw customerError;
        }

        const fetchedCustomerId = customerData?.customer_id || null;
        setCustomerId(fetchedCustomerId); // Set customerId state

        // Fetch initial orders using the fetched customerId
        if (fetchedCustomerId) {
          await fetchOrders(fetchedCustomerId);
        } else {
          setOrders([]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error fetching customer ID or initial orders:', err);
        setError(err);
        setLoading(false);
      }
    }

    getCustomerIdAndInitialOrders();
  }, [supabase, session?.user?.id, fetchOrders]); // Re-run if session or supabase changes

  // Effect for real-time subscription
  useEffect(() => {
    if (customerId) { // Only subscribe if customerId is available
      const newChannel = supabase
        .channel(`stripe_orders_for_customer:${customerId}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'stripe_orders',
            filter: `customer_id=eq.${customerId}`,
          },
          (payload) => {
            console.log('Realtime update for stripe_orders:', payload);
            // Re-fetch orders to get the latest state
            fetchOrders(customerId);
          }
        )
        .subscribe();
      channelRef.current = newChannel; // Assign the new channel to the ref
    }

    return () => {
      // Defensive check: Only remove if the channel is defined and still active
      const currentChannel = channelRef.current;
      if (currentChannel && (currentChannel.state === 'joined' || currentChannel.state === 'joining')) {
        supabase.removeChannel(currentChannel);
      }
      channelRef.current = null; // Clear the ref
    };
  }, [supabase, customerId, fetchOrders]); // Re-subscribe if customerId changes

  // Helper to check for available single-use credits
  const hasAvailableSingleUse = () => {
    // Dynamically get the single-use priceId from stripeProducts
    const singleUseProduct = stripeProducts.find(p => p.mode === 'payment');
    const singleUsePriceId = singleUseProduct?.pricing.one_time?.priceId;

    if (!singleUsePriceId) {
      console.warn('Single-use product price ID not found in stripe-config.ts');
      return false;
    }

    return orders.some(order => 
      order.payment_status === 'paid' && 
      order.status === 'completed' && 
      order.is_consumed === false &&
      order.price_id === singleUsePriceId // MODIFIED: Filter by price_id
    );
  };

  // Helper to get the ID of an available single-use order
  const getAvailableSingleUseOrderId = () => {
    const singleUseProduct = stripeProducts.find(p => p.mode === 'payment');
    const singleUsePriceId = singleUseProduct?.pricing.one_time?.priceId;

    if (!singleUsePriceId) {
      console.warn('Single-use product price ID not found in stripe-config.ts');
      return null;
    }

    const availableOrder = orders.find(order => 
      order.payment_status === 'paid' && 
      order.status === 'completed' && 
      order.is_consumed === false &&
      order.price_id === singleUsePriceId // MODIFIED: Filter by price_id
    );
    return availableOrder ? availableOrder.id : null;
  };


  return { orders, loading, error, hasAvailableSingleUse, getAvailableSingleUseOrderId };
}