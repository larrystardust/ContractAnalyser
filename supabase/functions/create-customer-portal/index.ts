import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

// Helper function to create responses with CORS headers
function corsResponse(body: string | object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
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
  try {
    if (req.method === 'OPTIONS') {
      return corsResponse({}, 204);
    }

    if (req.method !== 'POST') {
      return corsResponse({ error: 'Method not allowed' }, 405);
    }

    let requestBody: { target_user_id?: string } = {};
    try {
      // Attempt to parse JSON body
      requestBody = await req.json();
    } catch (e) {
      // If parsing fails (e.g., empty body), log and proceed with empty object
      console.warn('Could not parse request body as JSON, assuming empty body for target_user_id:', e);
      // requestBody remains {}
    }

    const { target_user_id } = requestBody; // Now target_user_id will be undefined if body was empty or invalid

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);

    if (getUserError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
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
        return corsResponse({ error: 'Forbidden: Only administrators can manage other users\' billing.' }, 403);
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
      return corsResponse({ error: 'No associated Stripe customer found for this user.' }, 404);
    }

    const customerId = customerData.customer_id;

    console.log(`create-customer-portal: Constructing return_url: ${req.headers.get('Origin')}/settings/billing`); // ADDED LOG
// Create a Stripe Customer Portal session
const portalSession = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: `${req.headers.get('Origin')}/settings/billing`, // Redirect back to billing settings
});

    return corsResponse({ url: portalSession.url });

  } catch (error: any) {
    console.error(`Error creating customer portal session: ${error.message}`);
    return corsResponse({ error: error.message }, 500);
  }
});