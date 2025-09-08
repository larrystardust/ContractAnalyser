import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import Stripe from 'npm:stripe@17.7.0';
import { logActivity } from '../_shared/logActivity.ts';
import { insertNotification } from '../_shared/notification_utils.ts';
import { stripeProducts } from '../_shared/stripe_products_data.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

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
    // MODIFIED: Receive priceId instead of subscriptionId
    const { userId, priceId, role } = await req.json();
    console.log('admin-manage-subscription: Received request with userId:', userId, 'priceId:', priceId, 'role:', role);

    if (!userId) {
      console.error('admin-manage-subscription: Missing userId in request.');
      return corsResponse({ error: 'Missing userId' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('admin-manage-subscription: Authorization header missing.');
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('admin-manage-subscription: Unauthorized: Invalid or missing user token:', userError?.message);
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminProfileError || !adminProfile?.is_admin) {
      console.error('admin-manage-subscription: Forbidden: User is not an administrator.', adminProfileError);
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }

    // Fetch target user's email for logging
    const { data: targetUserAuth, error: targetUserAuthError } = await supabase.auth.admin.getUserById(userId);
    const targetUserEmail = targetUserAuth?.user?.email || 'Unknown';
    console.log('admin-manage-subscription: Admin user:', user.email, 'managing user:', targetUserEmail);

    // 1. Get or Create Stripe Customer for the target user
    let customerId: string | null = null;
    const { data: existingCustomer, error: customerFetchError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (customerFetchError) {
      console.error('admin-manage-subscription: Error fetching existing customer:', customerFetchError);
      return corsResponse({ error: 'Failed to fetch customer information.' }, 500);
    }

    if (existingCustomer) {
      customerId = existingCustomer.customer_id;
      console.log('admin-manage-subscription: Found existing customerId:', customerId);
    } else {
      console.log('admin-manage-subscription: No existing customer, creating new one.');
      const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(userId);
      if (authUserError || !authUser?.user?.email) {
        console.error('admin-manage-subscription: Could not retrieve user email to create Stripe customer.', authUserError);
        return corsResponse({ error: 'Could not retrieve user email to create Stripe customer.' }, 500);
      }
      const newStripeCustomer = await stripe.customers.create({
        email: authUser.user.email,
        metadata: { userId: userId },
      });
      customerId = newStripeCustomer.id;

      const { error: insertCustomerError } = await supabase.from('stripe_customers').insert({
        user_id: userId,
        customer_id: customerId,
      });
      if (insertCustomerError) {
        console.error('admin-manage-subscription: Error inserting new Stripe customer:', insertCustomerError);
        return corsResponse({ error: 'Failed to create Stripe customer record.' }, 500);
      }
      console.log('admin-manage-subscription: Created new customerId:', customerId);
    }

    // 2. Manage Subscription Membership
    let newStripeSubscriptionId: string | null = null;

    if (priceId === null) {
      console.log('admin-manage-subscription: priceId is null, removing user from all subscriptions.');
      // Remove user from any existing subscription memberships
      const { error: deleteMembershipError } = await supabase
        .from('subscription_memberships')
        .delete()
        .eq('user_id', userId);

      if (deleteMembershipError) {
        console.error('admin-manage-subscription: Error deleting membership:', deleteMembershipError);
        return corsResponse({ error: 'Failed to remove user from subscription.' }, 500);
      }
      // Also update the contract's subscription_id to null if this user was the primary
      const { error: updateContractsError } = await supabase.from('contracts').update({ subscription_id: null }).eq('user_id', userId);
      if (updateContractsError) {
        console.error('admin-manage-subscription: Error updating contracts subscription_id to null:', updateContractsError);
      }

      await logActivity(
        supabase,
        user.id,
        'ADMIN_SUBSCRIPTION_REMOVED',
        `Admin ${user.email} removed user ${targetUserEmail} from all subscriptions.`,
        { target_user_id: userId, target_user_email: targetUserEmail }
      );

      // Send notification to the user that their subscription was removed
      await insertNotification(
        userId,
        'Subscription Removed',
        `Your subscription access has been removed by an administrator.`,
        'warning'
      );

      return corsResponse({ message: 'User removed from subscription successfully.' });

    } else {
      console.log('admin-manage-subscription: priceId is not null, assigning user to a new subscription.');
      if (!role) {
        console.error('admin-manage-subscription: Role is required when assigning a subscription.');
        return corsResponse({ error: 'Role is required when assigning a subscription.' }, 400);
      }

      // Fetch product details to get max_users for the selected priceId
      const { data: productMetadata, error: productMetadataError } = await supabase
        .from('stripe_product_metadata')
        .select('max_users, product_id')
        .eq('price_id', priceId)
        .maybeSingle();

      if (productMetadataError || !productMetadata) {
        console.error('admin-manage-subscription: Product metadata not found for priceId:', priceId, productMetadataError);
        return corsResponse({ error: 'Product details not found for the selected plan.' }, 404);
      }

      const maxUsers = productMetadata.max_users;
      const productId = productMetadata.product_id;
      console.log('admin-manage-subscription: Product max_users:', maxUsers);
      console.log('admin-manage-subscription: Product price_id:', priceId);

      // Check if the user already has an active subscription
      const { data: existingActiveSubscription, error: existingSubError } = await supabase
        .from('stripe_subscriptions')
        .select('subscription_id, status')
        .eq('customer_id', customerId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();

      if (existingSubError) {
        console.error('admin-manage-subscription: Error checking existing active subscription:', existingSubError);
        return corsResponse({ error: 'Failed to check existing subscriptions.' }, 500);
      }

      if (existingActiveSubscription) {
        // If user already has an active subscription, we might want to update it or cancel it first.
        // For simplicity, let's assume we cancel the old one and create a new one.
        // In a real scenario, you'd use Stripe's subscription modification API.
        console.log(`admin-manage-subscription: User ${userId} already has an active subscription (${existingActiveSubscription.subscription_id}). Cancelling it.`);
        try {
          await stripe.subscriptions.cancel(existingActiveSubscription.subscription_id);
          console.log(`admin-manage-subscription: Old Stripe subscription ${existingActiveSubscription.subscription_id} cancelled.`);
          // The webhook will update the DB status for the old subscription.
        } catch (stripeCancelError: any) {
          console.error('admin-manage-subscription: Error cancelling old Stripe subscription:', stripeCancelError);
          // Continue, but log the error.
        }
      }

      // Create a new Stripe Subscription for the user
      console.log(`admin-manage-subscription: Creating new Stripe subscription for customer ${customerId} with price ${priceId}.`);
      const newStripeSubscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        collection_method: 'charge_automatically', // Or 'send_invoice' depending on desired flow
        expand: ['latest_invoice.payment_intent'], // Useful for webhooks
      });
      newStripeSubscriptionId = newStripeSubscription.id;
      console.log('admin-manage-subscription: New Stripe subscription created:', newStripeSubscriptionId);

      // The stripe-webhook will handle populating the stripe_subscriptions table.
      // We now need to update the subscription_memberships table with this new subscription ID.

      // Upsert (insert or update) the subscription_memberships record
      const upsertPayload = {
        user_id: userId,
        subscription_id: newStripeSubscriptionId, // Use the NEW Stripe subscription ID
        role: role,
        status: 'active', // Admin-assigned memberships are active immediately
        accepted_at: new Date().toISOString(),
      };
      console.log('admin-manage-subscription: Upserting membership with payload:', upsertPayload);

      const { data: upsertedMembership, error: upsertError } = await supabase
        .from('subscription_memberships')
        .upsert(
          upsertPayload,
          { onConflict: ['user_id', 'subscription_id'] } // Conflict on user_id and new_stripe_subscription_id
        )
        .select()
        .single();

      if (upsertError) {
        console.error('admin-manage-subscription: Error upserting membership:', upsertError);
        console.error('admin-manage-subscription: Full upsert error details:', JSON.stringify(upsertError, null, 2));
        return corsResponse({ error: 'Failed to assign user to subscription.' }, 500);
      }
      console.log('admin-manage-subscription: Membership upserted successfully:', upsertedMembership);

      // Update the contract's subscription_id for this user
      const { error: updateContractsError } = await supabase.from('contracts').update({ subscription_id: newStripeSubscriptionId }).eq('user_id', userId);
      if (updateContractsError) {
        console.error('admin-manage-subscription: Error updating contracts subscription_id:', updateContractsError);
      }

      await logActivity(
        supabase,
        user.id,
        'ADMIN_SUBSCRIPTION_ASSIGNED',
        `Admin ${user.email} assigned user ${targetUserEmail} to subscription ${newStripeSubscriptionId} with role ${role}.`,
        { target_user_id: userId, target_user_email: targetUserEmail, subscription_id: newStripeSubscriptionId, role: role, price_id: priceId }
      );

      // Get product name for notification
      const assignedProduct = stripeProducts.find(p =>
        p.pricing.monthly?.priceId === priceId ||
        p.pricing.yearly?.priceId === priceId ||
        p.pricing.one_time?.priceId === priceId
      );
      const productName = assignedProduct?.name || 'a subscription plan';

      // Send notification to the user that their subscription was assigned
      await insertNotification(
        userId,
        'Subscription Assigned!',
        `An administrator has assigned you to ${productName} with the role of ${role}.`,
        'success'
      );

      return corsResponse({ message: 'User assigned to subscription successfully.', membership: upsertedMembership });
    }

  } catch (error: any) {
    console.error('admin-manage-subscription: Unhandled error in Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});