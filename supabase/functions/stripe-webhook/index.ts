import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { stripeProducts } from '../_shared/stripe_products_data.ts';
import { insertNotification } from '../_shared/notification_utils.ts'; // MODIFIED IMPORT

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

  let isSubscription = true;

  if (event.type === 'checkout.session.completed') {
    const session = stripeData as Stripe.Checkout.Session;
    console.log('Stripe Webhook: Received checkout.session.completed event. Session:', JSON.stringify(session, null, 2));

    isSubscription = session.mode === 'subscription';

    console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session for customer: ${customerId}`);

    if (isSubscription) {
      console.info(`Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId);
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
          payment_intent_id: payment_intent, // MODIFIED: Changed 'payment_intent' to 'payment_intent_id'
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
      .select('status, price_id')
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
      await supabase.from('subscription_memberships')
        .delete()
        .eq('user_id', (await supabase.from('stripe_customers').select('user_id').eq('customer_id', customerId).single()).data?.user_id)
        .eq('subscription_id', subscriptions.data[0]?.id);
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

    // 4. UPSERT the subscription data into our database
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
        onConflict: 'customer_id',
      },
    );

    if (subUpsertError) {
      console.error('Error upserting subscription:', subUpsertError);
      throw new Error('Failed to update subscription status in database');
    }

    // 5. Fetch the *new* state of the subscription from our DB *after* the upsert
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

    // 6. Compare old and new DB states to decide on notifications
    const oldStatus = oldSubscriptionDb?.status;
    const newStatus = newSubscriptionDb.status;
    const oldPriceId = oldSubscriptionDb?.price_id;
    const newPriceId = newSubscriptionDb.price_id;

    // Fetch user ID for notification
    const { data: customerUser, error: customerUserError } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId)
      .single();

    if (customerUserError || !customerUser) {
      console.error(`Could not find user_id for customer ${customerId}:`, customerUserError);
      return;
    }

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
      await insertNotification(customerUser.user_id, title, message, type);
    } else if (oldPriceId !== newPriceId && newStatus === 'active') {
      const oldProduct = stripeProducts.find(p =>
        p.pricing.monthly?.priceId === oldPriceId ||
        p.pricing.yearly?.priceId === oldPriceId ||
        p.pricing.one_time?.priceId === oldPriceId
      );
      const oldProductName = oldProduct?.name || 'previous plan';
      await insertNotification(
        customerUser.user_id,
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