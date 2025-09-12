import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { stripeProducts } from '../_shared/stripe_products_data.ts';
import { insertNotification } from '../_shared/notification_utils.ts';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    const body = await req.text();

    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    console.warn('No stripeData in event.');
    return;
  }

  if (event.type === 'payment_intent.succeeded' && (stripeData as Stripe.PaymentIntent).invoice === null) {
    console.log('Ignoring payment_intent.succeeded event not linked to an invoice.');
    return;
  }

  const customerId = (stripeData as any).customer || (stripeData as any).id;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer ID found in event data: ${JSON.stringify(event)}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = stripeData as Stripe.Checkout.Session;
    console.log('Stripe Webhook: Received checkout.session.completed event. Session:', JSON.stringify(session, null, 2));

    if (session.mode === 'subscription') {
      // For subscriptions, rely on 'customer.subscription.created' or 'customer.subscription.updated'
      // to trigger syncCustomerFromStripe. This prevents duplicate processing.
      console.info(`Checkout session completed for subscription. Will rely on customer.subscription events for sync.`);
      return; // Exit early, let other webhooks handle the sync
    } else if (session.mode === 'payment' && session.payment_status === 'paid') {
      console.log('Stripe Webhook: Handling one-time payment.');
      try {
        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items'],
        });
        console.log('Stripe Webhook: Retrieved full session with line_items:', JSON.stringify(fullSession, null, 2));

        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
          line_items,
        } = fullSession;

        const priceId = line_items?.data?.[0]?.price?.id || null;
        console.log('Stripe Webhook: Extracted priceId:', priceId);

        if (!priceId) {
          console.error('Stripe Webhook: Price ID is null or undefined for one-time payment. Cannot insert order.');
          return;
        }

        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent as string,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status: session.payment_status,
          status: 'completed',
          is_consumed: false,
          price_id: priceId,
        });

        if (orderError) {
          console.error('Stripe Webhook: Error inserting order into stripe_orders table:', orderError);
          return;
        }
        console.log('Stripe Webhook: Order successfully inserted into stripe_orders table.');

        const { data: customerUser, error: customerUserError } = await supabase.from('stripe_customers').select('user_id').eq('customer_id', customerId).single();
        if (customerUserError) {
          console.error('Stripe Webhook: Error fetching user_id from stripe_customers:', customerUserError);
          return;
        }
        console.log('Stripe Webhook: Retrieved customerUser:', JSON.stringify(customerUser, null, 2));

        if (customerUser) {
          const singleUseProduct = stripeProducts.find(p => p.pricing.one_time?.priceId === priceId);
          const productName = singleUseProduct?.name || 'Single Use Credit';
          await insertNotification(
            customerUser.user_id,
            'Payment Successful!',
            `Your one-time payment for ${productName} has been processed successfully.`,
            'success'
          );
          console.log('Stripe Webhook: Notification sent for one-time payment.');
        }
        console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
      } catch (error) {
        console.error('Stripe Webhook: Error processing one-time payment:', error);
      }
    }
  } else if (event.type.startsWith('customer.subscription.')) {
    console.info(`Processing subscription event ${event.type} for customer: ${customerId}`);
    await syncCustomerFromStripe(customerId);
  } else {
    console.log(`Unhandled event type: ${event.type}`);
  }
}

async function syncCustomerFromStripe(customerId: string) {
  try {
    // 1. Fetch the current state of the subscription from our DB *before* any updates
    const { data: oldSubscriptionDb, error: oldSubError } = await supabase
      .from('stripe_subscriptions')
      .select('status, price_id, subscription_id') // Select subscription_id here
      .eq('customer_id', customerId)
      .maybeSingle();

    if (oldSubError) {
      console.warn('Error fetching old subscription status from DB:', oldSubError);
    }

    // 2. Fetch the latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method', 'data.items.data.price'],
    });

    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
      return;
    }

    const stripeSubscription = subscriptions.data[0];
    const priceId = stripeSubscription.items.data[0].price.id;

    // 3. Fetch product metadata (unchanged)
    const { data: productMetadata, error: metadataError } = await supabase
      .from('stripe_product_metadata')
      .select('max_users, max_files')
      .eq('price_id', priceId)
      .maybeSingle();

    if (metadataError) {
      console.error('Error fetching product metadata:', metadataError);
    }

    const maxUsers = productMetadata?.max_users ?? null;
    const maxFiles = productMetadata?.max_files ?? null;

    // Get the user_id associated with this customer_id
    const { data: customerUser, error: customerUserError } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId) // CORRECTED: Use customer_id column here
      .single();

    if (customerUserError || !customerUser) {
      console.error(`Could not find user_id for customer ${customerId}:`, customerUserError);
      return; // Cannot proceed without user_id
    }
    const userId = customerUser.user_id;

    const oldDbSubscriptionId = oldSubscriptionDb?.subscription_id;
    const newStripeSubscriptionId = stripeSubscription.id;

    // Step 1: Temporarily set contracts.subscription_id to NULL for contracts referencing the old subscription ID
    // This is only necessary if the subscription ID is actually changing.
    if (oldDbSubscriptionId && oldDbSubscriptionId !== newStripeSubscriptionId) {
      console.log(`Subscription ID changed from ${oldDbSubscriptionId} to ${newStripeSubscriptionId}. Temporarily nullifying contracts' subscription_id...`);
      const { error: nullifyContractsError } = await supabase
        .from('contracts')
        .update({ subscription_id: null }) // Set to NULL
        .eq('user_id', userId)
        .eq('subscription_id', oldDbSubscriptionId);

      if (nullifyContractsError) {
        console.error('Error temporarily nullifying contracts\' subscription_id:', nullifyContractsError);
        throw new Error('Failed to prepare contracts for subscription ID change.');
      }
      console.log('Contracts\' old subscription_id temporarily nullified.');
    }

    // Step 2: UPSERT the stripe_subscriptions table with the new subscription data.
    // This will now succeed because contracts no longer reference the old ID (if it changed).
    const { error: subUpsertError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: stripeSubscription.customer as string,
        subscription_id: stripeSubscription.id,
        price_id: priceId,
        current_period_start: stripeSubscription.current_period_start,
        current_period_end: stripeSubscription.current_period_end,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        ...(stripeSubscription.default_payment_method && typeof stripeSubscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: stripeSubscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: stripeSubscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: stripeSubscription.status, // Use status from Stripe
        max_users: maxUsers,
        max_files: maxFiles,
      },
      {
        onConflict: 'customer_id', // Conflict on customer_id to update the existing record
      },
    );

    if (subUpsertError) {
      console.error('Error upserting subscription:', subUpsertError);
      throw new Error('Failed to update subscription status in database');
    }

    // Step 3: Re-link contracts to the new subscription ID
    // This is only necessary if the subscription ID actually changed.
    if (oldDbSubscriptionId && oldDbSubscriptionId !== newStripeSubscriptionId) {
      console.log(`Re-linking contracts to new subscription ID: ${newStripeSubscriptionId}...`);
      const { error: relinkContractsError } = await supabase
        .from('contracts')
        .update({ subscription_id: newStripeSubscriptionId })
        .eq('user_id', userId)
        .is('subscription_id', null); // Update only those that were just nullified

      if (relinkContractsError) {
        console.error('Error re-linking contracts to new subscription ID:', relinkContractsError);
        throw new Error('Failed to re-link contracts to new subscription ID.');
      }
      console.log('Contracts successfully re-linked to new subscription ID.');
    }

    // Upsert the subscription_memberships entry for the owner
    const { error: membershipUpsertError } = await supabase
      .from('subscription_memberships')
      .upsert(
        {
          user_id: userId,
          subscription_id: stripeSubscription.id, // Use the Stripe subscription ID
          role: 'owner', // Assign 'owner' role
          status: stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing' ? 'active' : 'inactive', // Set status based on Stripe subscription status
          accepted_at: new Date().toISOString(), // Set accepted_at for direct subscribers
        },
        { onConflict: ['user_id', 'subscription_id'] } // Conflict on user_id and subscription_id
      );

    if (membershipUpsertError) {
      console.error('Error upserting subscription_memberships for owner:', membershipUpsertError);
      // Do not throw, just log the error.
    }

    // 6. Fetch the *new* state of the subscription from our DB *after* the upsert
    const { data: newSubscriptionDb, error: newSubFetchError } = await supabase
      .from('stripe_subscriptions')
      .select('status, price_id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (newSubFetchError || !newSubscriptionDb) {
      console.error('Error fetching new subscription status from DB after upsert:', newSubFetchError);
      // This is a critical error, but we might still want to proceed with other logic if possible
      return;
    }

    // 7. Compare old and new DB states to decide on notifications
    const oldStatus = oldSubscriptionDb?.status;
    const newStatus = newSubscriptionDb.status;
    const oldPriceId = oldSubscriptionDb?.price_id;
    const newPriceId = newSubscriptionDb.price_id;

    const currentProduct = stripeProducts.find(p =>
      p.pricing.monthly?.priceId === newPriceId ||
      p.pricing.yearly?.priceId === newPriceId ||
      p.pricing.one_time?.priceId === newPriceId
    );
    const productName = currentProduct?.name || 'Subscription';

    if (oldStatus !== newStatus) {
      let title = 'Subscription Update';
      let message = `Your ${productName} subscription status changed to: ${newStatus}.`;
      let type = 'info';

      if (newStatus === 'active' || newStatus === 'trialing') {
        title = 'Subscription Active!';
        message = `Your ${productName} subscription is now active.`;
        type = 'success';
      } else if (newStatus === 'canceled' || newStatus === 'unpaid' || newStatus === 'past_due') {
        title = 'Subscription Alert!';
        message = `Your ${productName} subscription status is now ${newStatus}. Please check your billing details.`;
        type = 'warning';
        if (newStatus === 'canceled' && stripeSubscription.cancel_at_period_end) {
          message = `Your ${productName} subscription has been cancelled and will end on ${new Date(stripeSubscription.current_period_end * 1000).toLocaleDateString()}.`;
        }
      }
      await insertNotification(userId, title, message, type);
    } else if (oldPriceId !== newPriceId && newStatus === 'active') {
      const oldProduct = stripeProducts.find(p =>
        p.pricing.monthly?.priceId === oldPriceId ||
        p.pricing.yearly?.priceId === oldPriceId ||
        p.pricing.one_time?.priceId === oldPriceId
      );
      const oldProductName = oldProduct?.name || 'previous plan';
      await insertNotification(
        userId,
        'Subscription Plan Changed',
        `Your subscription plan has changed from ${oldProductName} to ${productName}.`,
        'info'
      );
    }
    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}