import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import Stripe from 'npm:stripe@17.7.0';
import { logActivity } from '../_shared/logActivity.ts';
import { insertNotification } from '../_shared/notification_utils.ts';
import { stripeProducts } from '../_shared/stripe_products_data.ts'; // ADDED: Import stripeProducts

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

    // Find the product associated with the priceId
    const selectedProduct = stripeProducts.find(p =>
      p.pricing.monthly?.priceId === priceId ||
      p.pricing.yearly?.priceId === priceId ||
      p.pricing.one_time?.priceId === priceId
    );

    // Handle removing user from all subscriptions
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

      // Also delete any existing subscription entry for this customer in stripe_subscriptions
      // This covers both Stripe-managed and admin-assigned subscriptions
      const { error: deleteSubError } = await supabase
        .from('stripe_subscriptions')
        .delete()
        .eq('customer_id', customerId);

      if (deleteSubError) {
        console.error('admin-manage-subscription: Error deleting existing subscription for customer:', deleteSubError);
        // Continue, but log the error.
      }

      // Update the contract's subscription_id to null if this user was the primary
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

      await insertNotification(
        userId,
        'Subscription Removed',
        `Your subscription access has been removed by an administrator.`,
        'warning'
      );

      return corsResponse({ message: 'User removed from subscription successfully.' });

    } else if (selectedProduct?.mode === 'admin_assigned') {
      console.log('admin-manage-subscription: Assigning admin-only free plan.');
      if (!role) {
        console.error('admin-manage-subscription: Role is required when assigning a subscription.');
        return corsResponse({ error: 'Role is required when assigning a subscription.' }, 400);
      }

      // Get max_users and max_files from the selectedProduct
      const maxUsers = selectedProduct.max_users ?? null; // MODIFIED: Use selectedProduct.max_users
      const maxFiles = selectedProduct.maxFiles ?? null;

      // Generate a unique, non-Stripe subscription_id
      const adminAssignedSubscriptionId = `admin_assigned_${userId}_${Date.now()}`;

      // First, cancel any existing Stripe subscriptions for this customer
      const { data: existingActiveStripeSubscription, error: existingStripeSubError } = await supabase
        .from('stripe_subscriptions')
        .select('subscription_id, status')
        .eq('customer_id', customerId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();

      if (existingStripeSubError) {
        console.error('admin-manage-subscription: Error checking existing active Stripe subscription:', existingStripeSubError);
        // Continue, but log the error.
      }

      if (existingActiveStripeSubscription && existingActiveStripeSubscription.subscription_id && !existingActiveStripeSubscription.subscription_id.startsWith('admin_assigned_')) {
        console.log(`admin-manage-subscription: User ${userId} has an active Stripe subscription (${existingActiveStripeSubscription.subscription_id}). Cancelling it.`);
        try {
          await stripe.subscriptions.cancel(existingActiveStripeSubscription.subscription_id);
          console.log(`admin-manage-subscription: Old Stripe subscription ${existingActiveStripeSubscription.subscription_id} cancelled.`);
          // The webhook will update the DB status for the old subscription.
        } catch (stripeCancelError: any) {
          console.error('admin-manage-subscription: Error cancelling old Stripe subscription:', stripeCancelError);
          // Continue, but log the error.
        }
      }

      // Upsert directly into stripe_subscriptions table
      const { error: upsertSubError } = await supabase
        .from('stripe_subscriptions')
        .upsert({
          customer_id: customerId,
          subscription_id: adminAssignedSubscriptionId, // Use the generated ID
          price_id: priceId, // The admin-only priceId
          current_period_start: Math.floor(Date.now() / 1000), // Current timestamp
          current_period_end: Math.floor(new Date('2099-12-31').getTime() / 1000), // Far future date
          cancel_at_period_end: false,
          payment_method_brand: 'Admin', // Indicate admin assignment
          payment_method_last4: 'Free', // Indicate admin assignment
          status: 'active', // Always active for admin-assigned
          max_users: maxUsers,
          max_files: maxFiles,
        }, { onConflict: 'customer_id' }); // Update if customer already has a subscription

      if (upsertSubError) {
        console.error('admin-manage-subscription: Error upserting admin-assigned subscription:', upsertSubError);
        return corsResponse({ error: 'Failed to assign admin-managed subscription.' }, 500);
      }

      // Upsert membership for the owner
      const { error: membershipUpsertError } = await supabase
        .from('subscription_memberships')
        .upsert(
          {
            user_id: userId,
            subscription_id: adminAssignedSubscriptionId,
            role: role,
            status: 'active',
            accepted_at: new Date().toISOString(),
          },
          { onConflict: ['user_id', 'subscription_id'] }
        );

      if (membershipUpsertError) {
        console.error('admin-manage-subscription: Error upserting membership for admin-assigned plan:', membershipUpsertError);
        // Do not return error, just log it.
      }

      await logActivity(
        supabase,
        user.id,
        'ADMIN_SUBSCRIPTION_ASSIGNED_FREE',
        `Admin ${user.email} assigned free plan (${selectedProduct.name}) to user: ${targetUserEmail}`,
        { target_user_id: userId, target_user_email: targetUserEmail, price_id: priceId, subscription_id: adminAssignedSubscriptionId, role: role }
      );

      await insertNotification(
        userId,
        'Plan Assigned!',
        `An administrator has assigned you to the ${selectedProduct.name} plan.`,
        'success'
      );

      return corsResponse({ message: 'User assigned to free plan successfully.', subscription_id: adminAssignedSubscriptionId });

    } else { // This is for actual Stripe subscriptions (mode === 'subscription' or 'payment')
      console.log('admin-manage-subscription: Assigning Stripe subscription.');
      if (!role) {
        console.error('admin-manage-subscription: Role is required when assigning a subscription.');
        return corsResponse({ error: 'Role is required when assigning a subscription.' }, 400);
      }

      if (!selectedProduct) {
        console.error('admin-manage-subscription: Product not found for priceId:', priceId);
        return corsResponse({ error: 'Product details not found for the selected plan.' }, 404);
      }

      // Check if the user already has an active subscription (Stripe-managed or admin-assigned)
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
        // If it's an admin-assigned subscription, delete it directly
        if (existingActiveSubscription.subscription_id && existingActiveSubscription.subscription_id.startsWith('admin_assigned_')) {
          console.log(`admin-manage-subscription: User ${userId} has an active admin-assigned subscription (${existingActiveSubscription.subscription_id}). Deleting it.`);
          const { error: deleteAdminAssignedSubError } = await supabase
            .from('stripe_subscriptions')
            .delete()
            .eq('subscription_id', existingActiveSubscription.subscription_id);
          if (deleteAdminAssignedSubError) {
            console.error('admin-manage-subscription: Error deleting old admin-assigned subscription:', deleteAdminAssignedSubError);
          }
        } else if (existingActiveSubscription.subscription_id) {
          // If it's a Stripe-managed subscription, cancel it via Stripe API
          console.log(`admin-manage-subscription: User ${userId} has an active Stripe subscription (${existingActiveSubscription.subscription_id}). Cancelling it.`);
          try {
            await stripe.subscriptions.cancel(existingActiveSubscription.subscription_id);
            console.log(`admin-manage-subscription: Old Stripe subscription ${existingActiveSubscription.subscription_id} cancelled.`);
            // The webhook will update the DB status for the old subscription.
          } catch (stripeCancelError: any) {
            console.error('admin-manage-subscription: Error cancelling old Stripe subscription:', stripeCancelError);
            // Continue, but log the error.
          }
        }
      }

      // Create a new Stripe Subscription for the user
      console.log(`admin-manage-subscription: Creating new Stripe subscription for customer ${customerId} with price ${priceId}.`);
      const newStripeSubscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        collection_method: 'charge_automatically',
        expand: ['latest_invoice.payment_intent'],
      });
      let newStripeSubscriptionId = newStripeSubscription.id;
      console.log('admin-manage-subscription: New Stripe subscription created:', newStripeSubscriptionId);

      await logActivity(
        supabase,
        user.id,
        'ADMIN_SUBSCRIPTION_ASSIGNED',
        `Admin ${user.email} assigned user ${targetUserEmail} to subscription ${newStripeSubscriptionId} with role ${role}.`,
        { target_user_id: userId, target_user_email: targetUserEmail, subscription_id: newStripeSubscriptionId, role: role, price_id: priceId }
      );

      const productName = selectedProduct.name || 'a subscription plan';

      await insertNotification(
        userId,
        'Subscription Assigned!',
        `An administrator has assigned you to ${productName} with the role of ${role}.`,
        'success'
      );

      return corsResponse({ message: 'User assigned to subscription successfully.', subscription_id: newStripeSubscriptionId });
    }

  } catch (error: any) {
    console.error('admin-manage-subscription: Unhandled error in Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});