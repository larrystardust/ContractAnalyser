import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react'; // ADDED: Import useSession

export function useStripe() {
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const session = useSession(); // ADDED: Get the user session

  // MODIFIED: createCheckoutSession now accepts priceId and mode directly
  const createCheckoutSession = useCallback(
    async (priceId: string, mode: 'subscription' | 'payment') => {
      try {
        const {
          data: { session: currentSession }, // Renamed to avoid conflict with outer session
          error,
        } = await supabase.auth.getSession();

        if (error || !currentSession) {
          // Redirect to login if not authenticated
          navigate('/login'); 
          throw new Error('You must be logged in to make a purchase'); // Still throw for internal error handling
        }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({
            price_id: priceId, // Use the directly passed priceId
            success_url: `${window.location.origin}/checkout/success`,
            cancel_url: `${window.location.origin}/checkout/cancel`,
            mode: mode, // Use the directly passed mode
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create checkout session');
        }

        const { url } = await response.json();

        if (!url) {
          throw new Error('No checkout URL received');
        }

        window.location.href = url;
      } catch (error: any) {
        console.error('Checkout error:', error);
        // You might want to display a user-friendly message here
        // e.g., using a toast notification
      }
    },
    [supabase, navigate]
  );

  // ADDED: New function to create a Stripe Customer Portal session
  const createCustomerPortalSession = useCallback(async () => {
    if (!session) {
      alert('You must be logged in to manage billing.');
      navigate('/login');
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}), // Send an empty JSON object
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open billing portal.');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No customer portal URL received.');
      }
    } catch (error: any) {
      console.error('Error creating customer portal session:', error);
      alert(`Failed to open billing portal: ${error.message}`);
    }
  }, [supabase, session, navigate]);


  return { createCheckoutSession, createCustomerPortalSession }; // MODIFIED: Export new function
}