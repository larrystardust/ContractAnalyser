import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';
import { stripeProducts } from '../_shared/stripe_products_data.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts'; // MODIFIED: Import getTranslatedMessage

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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

    // Find the single-use product's priceId and credits
    const singleUseProduct = stripeProducts.find(p => p.mode === 'payment');
    const singleUsePriceId = singleUseProduct?.pricing.one_time?.priceId;
    const creditsToGrant = singleUseProduct?.credits || 1; // Default to 1 if not specified

    if (!singleUsePriceId) {
      console.error('Single-use product price ID not found in stripe-config.ts');
      return corsResponse({ error: 'Configuration error: Single-use product price ID not found.' }, 500);
    }

    // Insert a new unconsumed single-use order
    const { error: insertOrderError } = await supabase.from('stripe_orders').insert({
      checkout_session_id: `admin_granted_${Date.now()}`,
      payment_intent_id: `admin_granted_pi_${Date.now()}`,
      customer_id: customerId,
      amount_subtotal: 0, // Admin granted, so amount is 0
      amount_total: 0,   // Admin granted, so amount is 0
      currency: 'usd',
      payment_status: 'paid',
      status: 'completed',
      credits_remaining: creditsToGrant, // MODIFIED: Initialize with creditsToGrant
      price_id: singleUsePriceId,
    });

    if (insertOrderError) {
      console.error('Error inserting single-use order:', insertOrderError);
      return corsResponse({ error: 'Failed to grant single-use credit.' }, 500);
    }

    // ADDED: Fetch user's preferred language for notification
    let userPreferredLanguage = 'en'; // Default to English
    const { data: profileData, error: profileError } = await supabase.from('profiles').select('language_preference').eq('id', userId).maybeSingle();
    if (profileError) {
      console.error('Error fetching user profile for language:', profileError);
    } else if (profileData?.language_preference) {
      userPreferredLanguage = profileData.language_preference;
    }

    const productNameKey = singleUseProduct?.name || 'product_name_single_use'; // Use key
    const translatedProductName = getTranslatedMessage(productNameKey, userPreferredLanguage); // MODIFIED: Translate product name
    const notificationMessage = getTranslatedMessage('credit_granted_message', userPreferredLanguage, { productName: translatedProductName }); // MODIFIED: Pass interpolation object
    await insertNotification(
      userId,
      'notification_title_credit_granted',
      notificationMessage,
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