import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';
import { stripeProducts } from '../../../src/stripe-config.ts'; // Import stripeProducts

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// ADDED: Helper to insert notification
async function insertNotification(userId: string, title: string, message: string, type: string) {
  const { error: notificationError } = await supabase.from('notifications').insert({
    user_id: userId,
    title: title,
    message: message,
    type: type,
  });
  if (notificationError) {
    console.error('Error inserting notification:', notificationError);
  }
}

function corsResponse(body: string | object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
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
    const { userId } = await req.json();

    if (!userId) {
      return corsResponse({ error: 'Missing userId' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminProfileError || !adminProfile?.is_admin) {
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }

    // Get the user's Stripe customer ID
    const { data: customerData, error: customerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    let customerId = customerData?.customer_id;

    // If no customer ID exists, create one
    if (!customerId) {
      const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(userId);
      if (authUserError || !authUser?.user?.email) {
        return corsResponse({ error: 'Could not retrieve user email to create Stripe customer.' }, 500);
      }

      const Stripe = (await import('npm:stripe@17.7.0')).default;
      const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
      const stripe = new Stripe(stripeSecret, {
        appInfo: {
          name: 'Bolt Integration',
          version: '1.0.0',
        },
      });

      const newCustomer = await stripe.customers.create({
        email: authUser.user.email,
        metadata: {
          userId: userId,
        },
      });
      customerId = newCustomer.id;

      const { error: insertCustomerError } = await supabase.from('stripe_customers').insert({
        user_id: userId,
        customer_id: customerId,
      });
      if (insertCustomerError) {
        console.error('Error inserting new Stripe customer:', insertCustomerError);
        return corsResponse({ error: 'Failed to create Stripe customer record.' }, 500);
      }
    }

    // Find the single-use product's priceId
    const singleUseProduct = stripeProducts.find(p => p.mode === 'payment');
    const singleUsePriceId = singleUseProduct?.pricing.one_time?.priceId;

    if (!singleUsePriceId) {
      console.error('Single-use product price ID not found in stripe-config.ts');
      return corsResponse({ error: 'Configuration error: Single-use product price ID not found.' }, 500);
    }

    // Insert a new unconsumed single-use order
    const { error: insertOrderError } = await supabase.from('stripe_orders').insert({
      checkout_session_id: `admin_granted_${Date.now()}`, // Unique ID
      payment_intent_id: `admin_granted_pi_${Date.now()}`, // Unique ID
      customer_id: customerId,
      amount_subtotal: 999, // Placeholder amount for single use
      amount_total: 999,
      currency: 'usd', // Default currency
      payment_status: 'paid',
      status: 'completed',
      is_consumed: false,
      price_id: singleUsePriceId, // Include the price_id
    });

    if (insertOrderError) {
      console.error('Error inserting single-use order:', insertOrderError);
      return corsResponse({ error: 'Failed to grant single-use credit.' }, 500);
    }

    // ADDED: Send notification to the user
    await insertNotification(
      userId,
      'Credit Granted!',
      `An administrator has granted you a single-use credit for ${singleUseProduct?.name || 'ContractAnalyser Single Use'}.`,
      'info'
    );

    // Log activity
    await logActivity(
      supabase,
      user.id,
      'ADMIN_SINGLE_USE_CREDIT_GRANTED',
      `Admin ${user.email} granted single-use credit to user: ${userId}`,
      { target_user_id: userId, price_id: singleUsePriceId }
    );

    return corsResponse({ message: 'Single-use credit granted successfully' });

  } catch (error: any) {
    console.error('Error in admin-grant-single-use-credit Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});