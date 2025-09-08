import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import Stripe from 'npm:stripe@17.7.0';
import { logActivity } from '../_shared/logActivity.ts';

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
    const { userId, subscriptionId, role } = await req.json();
    console.log('admin-manage-subscription: Received request with userId:', userId, 'subscriptionId:', subscriptionId, 'role:', role);

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
    if (subscriptionId === null) {
      console.log('admin-manage-subscription: subscriptionId is null, removing user from all subscriptions.');
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

      // ADDED: Log activity
      await logActivity(
        supabase,
        user.id,
        'ADMIN_SUBSCRIPTION_REMOVED',
        `Admin ${user.email} removed user ${targetUserEmail} from all subscriptions.`,
        { target_user_id: userId, target_user_email: targetUserEmail }
      );

      return corsResponse({ message: 'User removed from subscription successfully.' });

    } else {
      console.log('admin-manage-subscription: subscriptionId is not null, assigning user to subscription.');
      // Assign user to a new/existing subscription
      if (!role) {
        console.error('admin-manage-subscription: Role is required when assigning a subscription.');
        return corsResponse({ error: 'Role is required when assigning a subscription.' }, 400);
      }

      // Check subscription details for max_users
      const { data: subscriptionDetails, error: subDetailsError } = await supabase
        .from('stripe_subscriptions')
        .select('max_users')
        .eq('subscription_id', subscriptionId)
        .maybeSingle();

      if (subDetailsError || !subscriptionDetails) {
        console.error('admin-manage-subscription: Subscription details not found for subscriptionId:', subscriptionId, subDetailsError);
        return corsResponse({ error: 'Subscription details not found.' }, 404);
      }

      const maxUsers = subscriptionDetails.max_users;
      console.log('admin-manage-subscription: Subscription max_users:', maxUsers);

      // Count current active/invited members for this subscription
      const { count: currentMembersCount, error: countError } = await supabase
        .from('subscription_memberships')
        .select('id', { count: 'exact' })
        .eq('subscription_id', subscriptionId)
        .in('status', ['active', 'invited']);

      if (countError) {
        console.error('admin-manage-subscription: Could not count current members:', countError);
        return corsResponse({ error: 'Could not count current members.' }, 500);
      }
      console.log('admin-manage-subscription: Current members count:', currentMembersCount);

      // If maxUsers is not unlimited (999999) and limit is reached, prevent adding more
      if (maxUsers !== 999999 && currentMembersCount && currentMembersCount >= maxUsers) {
        // Allow updating role for existing members, but not adding new ones if limit is reached
        const { data: existingMembership } = await supabase
          .from('subscription_memberships')
          .select('id')
          .eq('user_id', userId)
          .eq('subscription_id', subscriptionId)
          .maybeSingle();

        if (!existingMembership) {
          console.warn('admin-manage-subscription: Subscription limit reached. Max users:', maxUsers);
          return corsResponse({ error: `Subscription limit reached. Max users: ${maxUsers}` }, 403);
        }
      }

      // Upsert (insert or update) the subscription_memberships record
      const upsertPayload = {
        user_id: userId,
        subscription_id: subscriptionId,
        role: role,
        status: 'active', // Admin-assigned memberships are active immediately
        accepted_at: new Date().toISOString(),
      };
      console.log('admin-manage-subscription: Upserting membership with payload:', upsertPayload);

      const { data: upsertedMembership, error: upsertError } = await supabase
        .from('subscription_memberships')
        .upsert(
          upsertPayload,
          { onConflict: ['user_id', 'subscription_id'] }
        )
        .select()
        .single();

      if (upsertError) {
        console.error('admin-manage-subscription: Error upserting membership:', upsertError);
        return corsResponse({ error: 'Failed to assign user to subscription.' }, 500);
      }
      console.log('admin-manage-subscription: Membership upserted successfully:', upsertedMembership);

      // Update the contract's subscription_id for this user
      const { error: updateContractsError } = await supabase.from('contracts').update({ subscription_id: subscriptionId }).eq('user_id', userId);
      if (updateContractsError) {
        console.error('admin-manage-subscription: Error updating contracts subscription_id:', updateContractsError);
      }

      await logActivity(
        supabase,
        user.id,
        'ADMIN_SUBSCRIPTION_ASSIGNED',
        `Admin ${user.email} assigned user ${targetUserEmail} to subscription ${subscriptionId} with role ${role}.`,
        { target_user_id: userId, target_user_email: targetUserEmail, subscription_id: subscriptionId, role: role }
      );

      return corsResponse({ message: 'User assigned to subscription successfully.', membership: upsertedMembership });
    }

  } catch (error: any) {
    console.error('admin-manage-subscription: Unhandled error in Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});