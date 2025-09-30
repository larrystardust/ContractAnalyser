import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { useTranslation } from 'react-i18next';

export function useStripe() {
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const session = useSession();
  const { i18n } = useTranslation();

  // ADDED: List of Stripe-supported locales
  const stripeSupportedLocales = [
    'auto', 'bg', 'cs', 'da', 'de', 'el', 'en', 'en-GB', 'es', 'es-419', 'et', 'fi', 'fil', 'fr', 'fr-CA', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'ms', 'mt', 'nb', 'nl', 'pl', 'pt', 'pt-BR', 'ro', 'ru', 'sk', 'sl', 'sv', 'th', 'tr', 'vi', 'zh', 'zh-HK', 'zh-TW'
  ];

  // ADDED: Helper function to get the effective locale for Stripe
  const getStripeLocale = useCallback(() => {
    const currentLang = i18n.language;
    if (stripeSupportedLocales.includes(currentLang)) {
      return currentLang;
    }
    // Fallback to English if the current language is not supported by Stripe
    return 'en';
  }, [i18n.language]);


  const createCheckoutSession = useCallback(
    async (priceId: string, mode: 'subscription' | 'payment') => {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error || !currentSession) {
          navigate('/login');
          throw new Error('You must be logged in to make a purchase');
        }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({
            price_id: priceId,
            success_url: `${window.location.origin}/checkout/success`,
            cancel_url: `${window.location.origin}/checkout/cancel`,
            mode: mode,
            locale: getStripeLocale(), // MODIFIED: Use getStripeLocale()
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
    [supabase, navigate, getStripeLocale] // MODIFIED: Add getStripeLocale to dependencies
  );

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
        body: JSON.stringify({
          locale: getStripeLocale(), // MODIFIED: Use getStripeLocale()
        }),
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
  }, [supabase, session, navigate, getStripeLocale]); // MODIFIED: Add getStripeLocale to dependencies


  return { createCheckoutSession, createCustomerPortalSession };
}