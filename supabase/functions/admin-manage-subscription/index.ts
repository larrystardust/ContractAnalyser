import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import Stripe from 'npm:stripe@17.7.0';

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

    // 1. Get or Create Stripe Customer for the target user
    let customerId: string | null = null;
    const { data: existingCustomer, error: customerFetchError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (customerFetchError) {
      console.error('Error fetching existing customer:', customerFetchError);
      return corsResponse({ error: 'Failed to fetch customer information.' }, 500);
    }

    if (existingCustomer) {
      customerId = existingCustomer.customer_id;
    } else {
      // Create new Stripe customer
      const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(userId);
      if (authUserError || !authUser?.user?.email) {
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
        console.error('Error inserting new Stripe customer:', insertCustomerError);
        return corsResponse({ error: 'Failed to create Stripe customer record.' }, 500);
      }
    }

    // 2. Manage Subscription Membership
    if (subscriptionId === null) {
      // Remove user from any existing subscription memberships
      const { error: deleteMembershipError } = await supabase
        .from('subscription_memberships')
        .delete()
        .eq('user_id', userId);

      if (deleteMembershipError) {
        console.error('Error deleting membership:', deleteMembershipError);
        return corsResponse({ error: 'Failed to remove user from subscription.' }, 500);
      }
      // Also update the contract's subscription_id to null if this user was the primary
      await supabase.from('contracts').update({ subscription_id: null }).eq('user_id', userId);

      return corsResponse({ message: 'User removed from subscription successfully.' });

    } else {
      // Assign user to a new/existing subscription
      if (!role) {
        return corsResponse({ error: 'Role is required when assigning a subscription.' }, 400);
      }

      // Check subscription details for max_users
      const { data: subscriptionDetails, error: subDetailsError } = await supabase
        .from('stripe_subscriptions')
        .select('max_users')
        .eq('subscription_id', subscriptionId)
        .maybeSingle();

      if (subDetailsError || !subscriptionDetails) {
        return corsResponse({ error: 'Subscription details not found.' }, 404);
      }

      const maxUsers = subscriptionDetails.max_users;

      // Count current active/invited members for this subscription
      const { count: currentMembersCount, error: countError } = await supabase
        .from('subscription_memberships')
        .select('id', { count: 'exact' })
        .eq('subscription_id', subscriptionId)
        .in('status', ['active', 'invited']);

      if (countError) {
        return corsResponse({ error: 'Could not count current members.' }, 500);
      }

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
          return corsResponse({ error: `Subscription limit reached. Max users: ${maxUsers}` }, 403);
        }
      }

      // Upsert (insert or update) the subscription_memberships record
      const { data: upsertedMembership, error: upsertError } = await supabase
        .from('subscription_memberships')
        .upsert(
          {
            user_id: userId,
            subscription_id: subscriptionId,
            role: role,
            status: 'active', // Admin-assigned memberships are active immediately
            accepted_at: new Date().toISOString(),
          },
          { onConflict: ['user_id', 'subscription_id'] } // Conflict on user_id and subscription_id
        )
        .select()
        .single();

      if (upsertError) {
        console.error('Error upserting membership:', upsertError);
        return corsResponse({ error: 'Failed to assign user to subscription.' }, 500);
      }

      // Update the contract's subscription_id for this user
      // This ensures contracts are linked to the correct subscription for RLS
      await supabase.from('contracts').update({ subscription_id: subscriptionId }).eq('user_id', userId);

      return corsResponse({ message: 'User assigned to subscription successfully.', membership: upsertedMembership });
    }

  } catch (error: any) {
    console.error('Error in admin-manage-subscription Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});