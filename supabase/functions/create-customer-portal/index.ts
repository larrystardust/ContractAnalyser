import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { getTranslatedMessage } from '../_shared/edge_translations.ts'; // ADDED

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

// Helper for CORS responses
function corsResponse(body: string | object | null, status = 200, origin: string | null = null) {
  const allowedOrigins = [
    'https://www.contractanalyser.com',
    'https://contractanalyser.com'
  ];
  
  let accessControlAllowOrigin = '*'; // Default to wildcard for development/safety if origin is not allowed
  if (origin && allowedOrigins.includes(origin)) {
    accessControlAllowOrigin = origin;
  }

  const headers = {
    'Access-Control-Allow-Origin': accessControlAllowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  };

  if (status === 204) {
    return new Response(null, { status, headers });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  let userPreferredLanguage = 'en'; // Default language

  try {
    if (req.method === 'OPTIONS') {
      return corsResponse({}, 204);
    }

    if (req.method !== 'POST') {
      return corsResponse({ error: getTranslatedMessage('message_method_not_allowed', userPreferredLanguage) }, 405); // MODIFIED
    }

    let requestBody: { target_user_id?: string, locale?: string } = {};
    try {
      requestBody = await req.json();
    } catch (e) {
      console.warn('Could not parse request body as JSON, assuming empty body for target_user_id:', e);
    }

    const { target_user_id, locale } = requestBody;
    userPreferredLanguage = locale || 'en'; // MODIFIED: Set userPreferredLanguage from locale

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: getTranslatedMessage('message_authorization_header_missing', userPreferredLanguage) }, 401); // MODIFIED
    }
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);

    if (getUserError || !user) {
      return corsResponse({ error: getTranslatedMessage('message_unauthorized_invalid_token', userPreferredLanguage) }, 401); // MODIFIED
    }

    let userIdToManage = user.id;

    // If target_user_id is provided, check if the current user is an admin
    if (target_user_id) {
      const { data: adminProfile, error: adminProfileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (adminProfileError || !adminProfile?.is_admin) {
        return corsResponse({ error: getTranslatedMessage('message_forbidden_admin_only_billing', userPreferredLanguage) }, 403); // MODIFIED
      }
      userIdToManage = target_user_id;
    }

    // Get the user's Stripe customer ID from your database
    const { data: customerData, error: customerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', userIdToManage)
      .maybeSingle();

    if (customerError || !customerData?.customer_id) {
      console.error(`User ${userIdToManage} has no Stripe customer ID or error fetching:`, customerError);
      return corsResponse({ error: getTranslatedMessage('message_no_stripe_customer_found', userPreferredLanguage) }, 404); // MODIFIED
    }

    const customerId = customerData.customer_id;
    
// console.log(`create-customer-portal: Constructing return_url: ${req.headers.get('Origin')}/settings/billing`); // REMOVED
const portalSession = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: `${req.headers.get('Origin')}/settings/billing`, // Redirect back to billing settings
  locale: locale, // ADDED: Pass locale to Stripe Customer Portal
});

    return corsResponse({ url: portalSession.url });

  } catch (error: any) {
    console.error(`Error creating customer portal session: ${error.message}`);
    return corsResponse({ error: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: error.message }) }, 500); // MODIFIED
  }
});