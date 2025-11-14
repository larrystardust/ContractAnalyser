import { useEffect, useState, useCallback, useRef } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { Database } from '../types/supabase';
import { stripeProducts } from '../../supabase/functions/_shared/stripe_products_data';
import { RealtimeChannel } from '@supabase/supabase-js';

// MODIFIED: Update StripeOrder type to reflect credits_remaining
export type StripeOrder = Database['public']['Tables']['stripe_orders']['Row'];

export function useUserOrders() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const [orders, setOrders] = useState<StripeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchOrders = useCallback(async (currentCustomerId: string | null) => {
    // console.log('useUserOrders: fetchOrders called with customerId:', currentCustomerId); // ADDED LOG
    if (!session?.user?.id || !currentCustomerId) {
      // console.log('useUserOrders: No session user ID or currentCustomerId. Skipping order fetch.'); // ADDED LOG
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // MODIFIED: Select credits_remaining instead of is_consumed
      const { data: ordersData, error: ordersError } = await supabase
        .from('stripe_orders')
        .select('*')
        .eq('customer_id', currentCustomerId)
        .order('created_at', { ascending: false });

      if (ordersError) {
        throw ordersError;
      }

      // console.log('useUserOrders: Fetched orders for customerId', currentCustomerId, ':', ordersData); // ADDED LOG
      setOrders(ordersData || []);
    } catch (err: any) {
      console.error('useUserOrders: Error fetching user orders:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, session?.user?.id]);

  useEffect(() => {
    async function getCustomerIdAndInitialOrders() {
      // console.log('useUserOrders: getCustomerIdAndInitialOrders called. Session user ID:', session?.user?.id); // ADDED LOG
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
        // console.log('useUserOrders: Fetched customerId for user', session.user.id, ':', fetchedCustomerId); // ADDED LOG
        setCustomerId(fetchedCustomerId);

        if (fetchedCustomerId) {
          await fetchOrders(fetchedCustomerId);
        } else {
          // console.log('useUserOrders: No customerId found for user. Setting orders to empty.'); // ADDED LOG
          setOrders([]);
          setLoading(false);
        }
      } catch (err: any) {
        // console.error('useUserOrders: Error fetching customer ID or initial orders:', err);
        setError(err);
        setLoading(false);
      }
    }

    getCustomerIdAndInitialOrders();
  }, [supabase, session?.user?.id, fetchOrders]);

  useEffect(() => {
    if (customerId) {
      // console.log('useUserOrders: Subscribing to realtime changes for customerId:', customerId); // ADDED LOG
      const newChannel = supabase
        .channel(`stripe_orders_for_customer:${customerId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'stripe_orders',
            filter: `customer_id=eq.${customerId}`,
          },
          (payload) => {
            // console.log('useUserOrders: Realtime update for stripe_orders received:', payload); // ADDED LOG
            fetchOrders(customerId);
          }
        )
        .subscribe();
      channelRef.current = newChannel;
    }

    return () => {
      const currentChannel = channelRef.current;
      if (currentChannel && (currentChannel.state === 'joined' || currentChannel.state === 'joining')) {
        // console.log('useUserOrders: Unsubscribing from realtime channel for customerId:', customerId); // ADDED LOG
        supabase.removeChannel(currentChannel);
      }
      channelRef.current = null;
    };
  }, [supabase, customerId, fetchOrders]);

  const hasAvailableSingleUse = () => {
    const singleUseProduct = stripeProducts.find(p => p.mode === 'payment');
    const singleUsePriceId = singleUseProduct?.pricing.one_time?.priceId;

    // console.log('useUserOrders: hasAvailableSingleUse called. SingleUsePriceId:', singleUsePriceId); // ADDED LOG

    if (!singleUsePriceId) {
      console.warn('useUserOrders: Single-use product price ID not found in stripe-config.ts');
      return false;
    }

    // MODIFIED: Check if any order has credits_remaining > 0
    const result = orders.some(order => 
      order.payment_status === 'paid' && 
      order.status === 'completed' && 
      (order.credits_remaining || 0) > 0 && // Check credits_remaining
      order.price_id === singleUsePriceId
    );
    // console.log('useUserOrders: hasAvailableSingleUse result:', result); // ADDED LOG
    return result;
  };

  const getAvailableSingleUseOrderId = () => {
    const singleUseProduct = stripeProducts.find(p => p.mode === 'payment');
    const singleUsePriceId = singleUseProduct?.pricing.one_time?.priceId;

    if (!singleUsePriceId) {
      console.warn('useUserOrders: Single-use product price ID not found in stripe-config.ts');
      return null;
    }

    // MODIFIED: Return the ID of an order with credits_remaining > 0
    const availableOrder = orders.find(order => 
      order.payment_status === 'paid' && 
      order.status === 'completed' && 
      (order.credits_remaining || 0) > 0 && // Check credits_remaining
      order.price_id === singleUsePriceId
    );
    // console.log('useUserOrders: getAvailableSingleUseOrderId result:', availableOrder ? availableOrder.id : null); // ADDED LOG
    return availableOrder ? availableOrder.id : null;
  };

  // ADDED: New function to get total single-use credits remaining
  const getTotalSingleUseCredits = () => {
    const singleUseProduct = stripeProducts.find(p => p.mode === 'payment');
    const singleUsePriceId = singleUseProduct?.pricing.one_time?.priceId;

    // console.log('useUserOrders: getTotalSingleUseCredits called. SingleUsePriceId:', singleUsePriceId); // ADDED LOG

    if (!singleUsePriceId) {
      console.warn('useUserOrders: Single-use product price ID not found in stripe-config.ts');
      return 0;
    }

    const totalCredits = orders.reduce((total, order) => {
      if (order.payment_status === 'paid' && order.status === 'completed' && order.price_id === singleUsePriceId) {
        return total + (order.credits_remaining || 0);
      }
      return total;
    }, 0);
    // console.log('useUserOrders: Total available single-use credits:', totalCredits); // ADDED LOG
    return totalCredits;
  };

  // ADDED: New function to check if user has enough credits for a specific amount
  const hasEnoughCredits = useCallback((requiredCredits: number): boolean => {
    const result = getTotalSingleUseCredits() >= requiredCredits;
    // console.log('useUserOrders: hasEnoughCredits called. Required:', requiredCredits, 'Available:', getTotalSingleUseCredits(), 'Result:', result); // ADDED LOG
    return result;
  }, [getTotalSingleUseCredits]);


  return { orders, loading, error, hasAvailableSingleUse, getAvailableSingleUseOrderId, getTotalSingleUseCredits, hasEnoughCredits }; // MODIFIED: Export new function
}