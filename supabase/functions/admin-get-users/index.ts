import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { stripeProducts } from '../_shared/stripe_products_data.ts'; // MODIFIED PATH

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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
    'Content-Type': 'application/json',
  };
  if (status === 204) {
    return new Response(null, { status, headers });
  }
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(null, 204);
  }

  if (req.method !== 'POST') {
    return corsResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }

    // Fetch all profiles
    const { data: profilesData, error: fetchProfilesError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        business_name,
        mobile_phone_number,
        country_code,
        theme_preference,
        email_reports_enabled,
        is_admin,
        created_at,
        default_jurisdictions,
        notification_settings
      `)
      .order('created_at', { ascending: false });

    if (fetchProfilesError) {
      console.error('Error fetching profiles:', fetchProfilesError);
      return corsResponse({ error: 'Failed to fetch profiles' }, 500);
    }

    // Fetch all auth.users data using admin.listUsers()
    const { data: authUsersData, error: fetchAuthUsersError } = await supabase.auth.admin.listUsers();

    if (fetchAuthUsersError) {
      console.error('Error fetching auth users:', fetchAuthUsersError);
      return corsResponse({ error: 'Failed to fetch authentication users' }, 500);
    }

    const authUsersMap = new Map(authUsersData.users.map(u => [u.id, u]));

    // Fetch all Stripe customers
    const { data: customersData, error: fetchCustomersError } = await supabase
      .from('stripe_customers')
      .select('user_id, customer_id');

    if (fetchCustomersError) {
      console.error('Error fetching Stripe customers:', fetchCustomersError);
      return corsResponse({ error: 'Failed to fetch Stripe customers' }, 500);
    }
    const customersMap = new Map(customersData.map(c => [c.user_id, c.customer_id]));

    // Fetch all Stripe subscriptions
    const { data: subscriptionsData, error: fetchSubscriptionsError } = await supabase
      .from('stripe_subscriptions')
      .select('*');

    if (fetchSubscriptionsError) {
      console.error('Error fetching Stripe subscriptions:', fetchSubscriptionsError);
      return corsResponse({ error: 'Failed to fetch Stripe subscriptions' }, 500);
    }
    const allStripeSubscriptionsMap = new Map(subscriptionsData.map(s => [s.subscription_id, s]));

    // Fetch all subscription memberships
    const { data: membershipsData, error: fetchMembershipsError } = await supabase
      .from('subscription_memberships')
      .select('*');

    if (fetchMembershipsError) {
      console.error('Error fetching subscription memberships:', fetchMembershipsError);
      return corsResponse({ error: 'Failed to fetch subscription memberships' }, 500);
    }
    const membershipsMap = new Map(membershipsData.map(m => [m.user_id, m]));

    // MODIFIED: Fetch all orders with credits_remaining > 0
    const { data: ordersData, error: fetchOrdersError } = await supabase
      .from('stripe_orders')
      .select('customer_id, credits_remaining')
      .eq('payment_status', 'paid')
      .eq('status', 'completed')
      .gt('credits_remaining', 0); // MODIFIED: Filter for credits_remaining > 0

    if (fetchOrdersError) {
      console.error('Error fetching unconsumed orders:', fetchOrdersError);
      return corsResponse({ error: 'Failed to fetch unconsumed orders' }, 500);
    }
    // MODIFIED: Sum credits_remaining for each customer
    const customerCreditsMap = new Map<string, number>();
    ordersData.forEach(order => {
      customerCreditsMap.set(order.customer_id, (customerCreditsMap.get(order.customer_id) || 0) + (order.credits_remaining || 0));
    });

    // Construct the combinedUsers array
    const combinedUsers = profilesData.map(profile => {
      const authUser = authUsersMap.get(profile.id);
      const customerId = customersMap.get(profile.id);
      const membership = membershipsMap.get(profile.id);

      let subscriptionDetails = null;

      // Prioritize membership's active subscription
      if (membership && membership.subscription_id) {
        const sub = allStripeSubscriptionsMap.get(membership.subscription_id);
        if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
          subscriptionDetails = sub;
        }
      }

      // If no active membership subscription, check for direct customer active subscriptions
      if (!subscriptionDetails && customerId) {
        // Find the most recent active subscription for this customer
        const activeDirectSubscription = subscriptionsData.find(s =>
          s.customer_id === customerId && (s.status === 'active' || s.status === 'trialing')
        );
        if (activeDirectSubscription) {
          subscriptionDetails = activeDirectSubscription;
        }
      }

      return {
        ...profile,
        email: authUser?.email || null,
        auth_created_at: authUser?.created_at || null,
        customer_id: customerId || null,
        subscription_details: subscriptionDetails, // This will now be the active subscription or null
        membership_details: membership || null,
        single_use_credits: customerId ? (customerCreditsMap.get(customerId) || 0) : 0 // MODIFIED: Use customerCreditsMap
      };
    });

    const { data: allSubscriptions, error: allSubscriptionsError } = await supabase
      .from('stripe_subscriptions')
      .select('subscription_id, price_id, status, max_users');

    if (allSubscriptionsError) {
      console.error('Error fetching all subscriptions for dropdown:', allSubscriptionsError);
      return corsResponse({ error: 'Failed to fetch all subscriptions for dropdown' }, 500);
    }

    // Enrich allSubscriptions with product names
    const enrichedAllSubscriptions = allSubscriptions.map(sub => {
      const product = stripeProducts.find(p =>
        p.pricing.monthly?.priceId === sub.price_id ||
        p.pricing.yearly?.priceId === sub.price_id ||
        p.pricing.one_time?.priceId === sub.price_id
      );
      return {
        ...sub,
        product_name: product ? product.name : 'unknown_product', // MODIFIED: Changed to translation key
      };
    });


    return corsResponse({ users: combinedUsers, all_subscriptions: enrichedAllSubscriptions });

  } catch (error: any) {
    console.error('Error in admin-get-users Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});