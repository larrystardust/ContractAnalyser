import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import Stripe from 'npm:stripe@17.7.0';
import { logActivity } from '../_shared/logActivity.ts';
import { insertNotification } from '../_shared/notification_utils.ts';
import { stripeProducts } from '../_shared/stripe_products_data.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';

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
    return corsResponse({ error: getTranslatedMessage('message_method_not_allowed', 'en') }, 405);
  }

  try {
    const { userId, priceId, role } = await req.json();
    // console.log('admin-manage-subscription: Received request with userId:', userId, 'priceId:', priceId, 'role:', role); // REMOVED

    if (!userId) {
      return corsResponse({ error: getTranslatedMessage('error_missing_userid', 'en') }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: getTranslatedMessage('message_unauthorized', 'en') }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: getTranslatedMessage('message_unauthorized', 'en') }, 401);
    }

    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminProfileError || !adminProfile?.is_admin) {
      return corsResponse({ error: getTranslatedMessage('message_forbidden', 'en') }, 403);
    }

    // Fetch target user's email and language for logging and notifications
    const { data: targetUserAuth, error: targetUserAuthError } = await supabase.auth.admin.getUserById(userId);
    const targetUserEmail = targetUserAuth?.user?.email || 'Unknown';

    let targetUserPreferredLanguage = 'en';
    const { data: targetUserProfile, error: targetUserProfileError } = await supabase
      .from('profiles')
      .select('language_preference')
      .eq('id', userId)
      .maybeSingle();

    if (targetUserProfileError) {
      console.warn('admin-manage-subscription: Error fetching target user profile for language:', targetUserProfileError);
    } else if (targetUserProfile?.language_preference) {
      targetUserPreferredLanguage = targetUserProfile.language_preference;
    }

    // console.log('admin-manage-subscription: Admin user:', user.email, 'managing user:', targetUserEmail); // REMOVED

    // 1. Get or Create Stripe Customer for the target user
    let customerId: string | null = null;
    const { data: existingCustomer, error: customerFetchError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (customerFetchError) {
      console.error('admin-manage-subscription: Error fetching existing customer:', customerFetchError);
      return corsResponse({ error: getTranslatedMessage('error_failed_to_fetch_customer_info', targetUserPreferredLanguage) }, 500);
    }

    if (existingCustomer) {
      customerId = existingCustomer.customer_id;
      // console.log('admin-manage-subscription: Found existing customerId:', customerId); // REMOVED
    } else {
      // console.log('admin-manage-subscription: No existing customer, creating new one.'); // REMOVED
      const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(userId);
      if (authUserError || !authUser?.user?.email) {
        console.error('admin-manage-subscription: Could not retrieve user email to create Stripe customer.', authUserError);
        return corsResponse({ error: getTranslatedMessage('error_could_not_retrieve_user_email', targetUserPreferredLanguage) }, 500);
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
        return corsResponse({ error: getTranslatedMessage('error_failed_to_create_stripe_customer_record', targetUserPreferredLanguage) }, 500);
      }
      // console.log('admin-manage-subscription: Created new customerId:', customerId); // REMOVED
    }

    // Find the product associated with the priceId
    const selectedProduct = stripeProducts.find(p =>
      p.pricing.monthly?.priceId === priceId ||
      p.pricing.yearly?.priceId === priceId ||
      p.pricing.one_time?.priceId === priceId
    );

    // --- START: Fetch existing invited_email_address before deletion ---
    let existingInvitedEmail: string | null = null;
    const { data: existingMembershipRecord, error: fetchExistingMembershipError } = await supabase
      .from('subscription_memberships')
      .select('invited_email_address')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchExistingMembershipError) {
      console.error('admin-manage-subscription: Error fetching existing membership for invited_email_address:', fetchExistingMembershipError);
      // Continue, but log the error.
    } else if (existingMembershipRecord) {
      existingInvitedEmail = existingMembershipRecord.invited_email_address;
      // console.log('admin-manage-subscription: Found existing invited_email_address:', existingInvitedEmail); // REMOVED
    }
    // --- END: Fetch existing invited_email_address before deletion ---


    // Handle removing user from all subscriptions
    if (priceId === null) {
      // console.log('admin-manage-subscription: priceId is null, removing user from all subscriptions.'); // REMOVED
      // Remove user from any existing subscription memberships
      const { error: deleteMembershipError } = await supabase
        .from('subscription_memberships')
        .delete()
        .eq('user_id', userId);

      if (deleteMembershipError) {
        console.error('admin-manage-subscription: Error deleting membership:', deleteMembershipError);
        return corsResponse({ error: getTranslatedMessage('error_failed_to_remove_user_from_subscription', targetUserPreferredLanguage) }, 500);
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

      // MODIFIED: Translate notification title and message before inserting
      const notificationTitleRemoved = getTranslatedMessage('notification_title_subscription_removed', targetUserPreferredLanguage);
      const notificationMessageRemoved = getTranslatedMessage('notification_message_subscription_removed', targetUserPreferredLanguage);
      await insertNotification(
        userId,
        notificationTitleRemoved,
        notificationMessageRemoved,
        'warning'
      );

      return corsResponse({ message: notificationMessageRemoved });

    } else if (selectedProduct?.mode === 'admin_assigned') {
      // console.log('admin-manage-subscription: Assigning admin-only free plan.'); // REMOVED
      if (!role) {
        console.error('admin-manage-subscription: Role is required when assigning a subscription.');
        return corsResponse({ error: getTranslatedMessage('error_role_required', targetUserPreferredLanguage) }, 400);
      }

      // Declare and initialize adminAssignedSubscriptionId
      const adminAssignedSubscriptionId = `admin_assigned_${userId}_${Date.now()}`; // Unique ID for admin-assigned subscription

      // Get max_users and max_files from the selectedProduct
      const maxUsers = selectedProduct.max_users ?? null;
      const maxFiles = selectedProduct.maxFiles ?? null;
      const tier = selectedProduct.tier ?? null; // MODIFIED: Get tier from selectedProduct

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
        // console.log(`admin-manage-subscription: User ${userId} has an active Stripe subscription (${existingActiveStripeSubscription.subscription_id}). Cancelling it.`); // REMOVED
        try {
          await stripe.subscriptions.cancel(existingActiveStripeSubscription.subscription_id);
          // console.log(`admin-manage-subscription: Old Stripe subscription ${existingActiveStripeSubscription.subscription_id} cancelled.`); // REMOVED
          // The webhook will update the DB status for the old subscription.
        } catch (stripeCancelError: any) {
          console.error('admin-manage-subscription: Error cancelling old Stripe subscription:', stripeCancelError);
          // Continue, but log the error.
        }
      }

      // NEW: Delete any existing membership records for this user before upserting the new one
      const { error: deleteExistingMembershipsError } = await supabase
        .from('subscription_memberships')
        .delete()
        .eq('user_id', userId);

      if (deleteExistingMembershipsError) {
        console.error('admin-manage-subscription: Error deleting existing memberships for admin_assigned plan:', deleteExistingMembershipsError);
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
          tier: tier, // MODIFIED: Add tier here
        }, { onConflict: 'customer_id' }); // Update if customer already has a subscription

      if (upsertSubError) {
        console.error('admin-manage-subscription: Error upserting admin-assigned subscription:', upsertSubError);
        return corsResponse({ error: getTranslatedMessage('error_failed_to_assign_admin_managed_subscription', targetUserPreferredLanguage) }, 500);
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
            invited_email_address: existingInvitedEmail, // ADDED: Preserve invited_email_address
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

      const translatedProductName = getTranslatedMessage(selectedProduct.name, targetUserPreferredLanguage);
      // MODIFIED: Translate notification title and message before inserting
      const notificationTitleAssigned = getTranslatedMessage('notification_title_plan_assigned', targetUserPreferredLanguage);
      const notificationMessageAssigned = getTranslatedMessage('notification_message_admin_assigned_plan', targetUserPreferredLanguage, { productName: translatedProductName });
      await insertNotification(
        userId,
        notificationTitleAssigned,
        notificationMessageAssigned,
        'success'
      );

      return corsResponse({ message: notificationMessageAssigned });

    } else { // This is for actual Stripe subscriptions (mode === 'subscription' or 'payment')
      // console.log('admin-manage-subscription: Assigning Stripe subscription.'); // REMOVED
      if (!role) {
        console.error('admin-manage-subscription: Role is required when assigning a subscription.');
        return corsResponse({ error: getTranslatedMessage('error_role_required', targetUserPreferredLanguage) }, 400);
      }

      if (!selectedProduct) {
        console.error('admin-manage-subscription: Product not found for priceId:', priceId);
        return corsResponse({ error: getTranslatedMessage('error_product_details_not_found', targetUserPreferredLanguage) }, 404);
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
        return corsResponse({ error: getTranslatedMessage('error_failed_to_check_existing_subscriptions', targetUserPreferredLanguage) }, 500);
      }

      if (existingActiveSubscription) {
        // If it's an admin-assigned subscription, delete it directly
        if (existingActiveSubscription.subscription_id && existingActiveSubscription.subscription_id.startsWith('admin_assigned_')) {
          // console.log(`admin-manage-subscription: User ${userId} has an active admin-assigned subscription (${existingActiveSubscription.subscription_id}). Deleting it.`); // REMOVED
          const { error: deleteAdminAssignedSubError } = await supabase
            .from('stripe_subscriptions')
            .delete()
            .eq('subscription_id', existingActiveSubscription.subscription_id);
          if (deleteAdminAssignedSubError) {
            console.error('admin-manage-subscription: Error deleting old admin-assigned subscription:', deleteAdminAssignedSubError);
          }
        } else if (existingActiveSubscription.subscription_id) {
          // If it's a Stripe-managed subscription, cancel it via Stripe API
          // console.log(`admin-manage-subscription: User ${userId} has an active Stripe subscription (${existingActiveStripeSubscription.subscription_id}). Cancelling it.`); // REMOVED
          try {
            await stripe.subscriptions.cancel(existingActiveStripeSubscription.subscription_id);
            // console.log(`admin-manage-subscription: Old Stripe subscription ${existingActiveStripeSubscription.subscription_id} cancelled.`); // REMOVED
            // The webhook will update the DB status for the old subscription.
          } catch (stripeCancelError: any) {
            console.error('admin-manage-subscription: Error cancelling old Stripe subscription:', stripeCancelError);
            // Continue, but log the error.
          }
        }
      }

      // NEW: Delete any existing membership records for this user before upserting the new one
      const { error: deleteExistingMembershipsError } = await supabase
        .from('subscription_memberships')
        .delete()
        .eq('user_id', userId);

      if (deleteExistingMembershipsError) {
        console.error('admin-manage-subscription: Error deleting existing memberships for Stripe plan:', deleteExistingMembershipsError);
      }

      // Create a new Stripe Subscription for the user
      // console.log(`admin-manage-subscription: Creating new Stripe subscription for customer ${customerId} with price ${priceId}.`); // REMOVED
      const newStripeSubscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        collection_method: 'charge_automatically',
        expand: ['latest_invoice.payment_intent'],
      });
      let newStripeSubscriptionId = newStripeSubscription.id;
      // console.log('admin-manage-subscription: New Stripe subscription created:', newStripeSubscriptionId); // REMOVED

      await logActivity(
        supabase,
        user.id,
        'ADMIN_SUBSCRIPTION_ASSIGNED',
        `Admin ${user.email} assigned user ${targetUserEmail} to subscription ${newStripeSubscriptionId} with role ${role}.`,
        { target_user_id: userId, target_user_email: targetUserEmail, subscription_id: newStripeSubscriptionId, role: role, price_id: priceId }
      );

      const translatedProductName = getTranslatedMessage(selectedProduct.name, targetUserPreferredLanguage);
      // MODIFIED: Translate notification title and message before inserting
      const notificationTitleStripeAssigned = getTranslatedMessage('notification_title_subscription_assigned', targetUserPreferredLanguage);
      const notificationMessageStripeAssigned = getTranslatedMessage('notification_message_admin_assigned_stripe_plan', targetUserPreferredLanguage, { productName: translatedProductName, role: role });
      await insertNotification(
        userId,
        notificationTitleStripeAssigned,
        notificationMessageStripeAssigned,
        'success'
      );

      return corsResponse({ message: notificationMessageStripeAssigned });
    }

  } catch (error: any) {
    console.error('admin-manage-subscription: Unhandled error in Edge Function:', error);
    return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: error.message }) }, 500);
  }
});
