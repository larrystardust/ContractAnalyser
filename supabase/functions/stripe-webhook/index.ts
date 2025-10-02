import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { stripeProducts } from '../_shared/stripe_products_data.ts';
import { insertNotification } from '../_shared/notification_utils.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts'; // MODIFIED: Import getTranslatedMessage

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

  // ADDED: Fetch user's preferred language
  let userPreferredLanguage = 'en'; // Default to English
  let userId: string | null = null;

  const { data: customerUser, error: customerUserError } = await supabase.from('stripe_customers').select('user_id').eq('customer_id', customerId).maybeSingle();
  if (customerUserError) {
    console.error('Stripe Webhook: Error fetching user_id from stripe_customers:', customerUserError);
  } else if (customerUser) {
    userId = customerUser.user_id;
    const { data: profileData, error: profileError } = await supabase.from('profiles').select('language_preference').eq('id', userId).maybeSingle();
    if (profileError) {
      console.error('Stripe Webhook: Error fetching user profile for language:', profileError);
    } else if (profileData?.language_preference) {
      userPreferredLanguage = profileData.language_preference;
    }
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
        console.log('Stripe Webhook: Price ID is null or undefined for one-time payment. Cannot insert order.');

        if (!priceId) {
          console.error('Stripe Webhook: Price ID is null or undefined for one-time payment. Cannot insert order.');
          return;
        }

        // ADDED: Extract credits from session metadata
        const creditsFromMetadata = parseInt(session.metadata?.credits || '0', 10);
        console.log('Stripe Webhook: Extracted creditsFromMetadata:', creditsFromMetadata);

        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent as string,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status: session.payment_status,
          status: 'completed',
          credits_remaining: creditsFromMetadata,
          price_id: priceId,
        });

        if (orderError) {
          console.error('Stripe Webhook: Error inserting order into stripe_orders table:', orderError);
          return;
        }
        console.log('Stripe Webhook: Order successfully inserted into stripe_orders table.');

        if (userId) { // Only send notification if userId was successfully retrieved
          const singleUseProduct = stripeProducts.find(p => p.pricing.one_time?.priceId === priceId);
          const productNameKey = singleUseProduct?.name || 'product_name_single_use'; // Use key
          // MODIFIED: Translate productNameKey before passing it to the message template
          const translatedProductName = getTranslatedMessage(productNameKey, userPreferredLanguage);
          const notificationMessage = getTranslatedMessage('payment_successful_message', userPreferredLanguage, { productName: translatedProductName });
          await insertNotification(
            userId,
            'notification_title_payment_successful',
            notificationMessage,
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
    // MODIFIED: Pass event.type to syncCustomerFromStripe
    await syncCustomerFromStripe(customerId, userId, userPreferredLanguage, event.type);
  } else {
    console.log(`Unhandled event type: ${event.type}`);
  }
}

// MODIFIED: Added eventType parameter
async function syncCustomerFromStripe(customerId: string, userId: string | null, userPreferredLanguage: string, eventType: string) {
  try {
    // 1. Fetch the current state of the subscription from our DB *before* any updates
    const { data: oldSubscriptionDb, error: oldSubError } = await supabase
      .from('stripe_subscriptions')
      .select('status, price_id, subscription_id')
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
    if (!userId) { // If userId was not found earlier, try to fetch it now
      const { data: fetchedCustomerUser, error: fetchedCustomerUserError } = await supabase
        .from('stripe_customers')
        .select('user_id')
        .eq('customer_id', customerId)
        .single();

      if (fetchedCustomerUserError || !fetchedCustomerUser) {
        console.error(`Could not find user_id for customer ${customerId}:`, fetchedCustomerUserError);
        return; // Cannot proceed without user_id
      }
      userId = fetchedCustomerUser.user_id;
    }


    const oldDbSubscriptionId = oldSubscriptionDb?.subscription_id;
    const newStripeSubscriptionId = stripeSubscription.id;

    console.log(`DEBUG: userId: ${userId}, oldDbSubscriptionId: ${oldDbSubscriptionId}, newStripeSubscriptionId: ${newStripeSubscriptionId}`);

    // --- START OF CRITICAL FIX ---
    // Step 1: If the subscription ID is changing, explicitly nullify ALL contracts referencing the OLD subscription ID.
    // This ensures the foreign key constraint is released before the stripe_subscriptions table is updated.
    if (oldDbSubscriptionId && oldDbSubscriptionId !== newStripeSubscriptionId) {
      console.log(`Subscription ID changed from ${oldDbSubscriptionId} to ${newStripeSubscriptionId}.`);
      console.log(`Attempting to nullify contracts referencing old subscription ID: ${oldDbSubscriptionId}...`);

      // First, find all contract IDs that reference the old subscription ID
      const { data: contractsToNullify, error: fetchContractsToNullifyError } = await supabase
        .from('contracts')
        .select('id')
        .eq('subscription_id', oldDbSubscriptionId);

      if (fetchContractsToNullifyError) {
        console.error('Error fetching contracts to nullify:', fetchContractsToNullifyError);
        throw new Error('Failed to fetch contracts for nullification.');
      }

      if (contractsToNullify && contractsToNullify.length > 0) {
        const contractIds = contractsToNullify.map(c => c.id);
        console.log(`Found ${contractIds.length} contracts to nullify: ${contractIds.join(', ')}`);

        // Now, update these specific contracts to set their subscription_id to NULL
        const { count: nullifiedCount, error: nullifyContractsError } = await supabase
          .from('contracts')
          .update({ subscription_id: null })
          .in('id', contractIds)
          .select('*', { count: 'exact' });

        if (nullifyContractsError) {
          console.error('Error nullifying contracts\' subscription_id:', nullifyContractsError);
          throw new Error('Failed to nullify contracts for subscription ID change.');
        }
        console.log(`Contracts' old subscription_id successfully nullified. Affected rows: ${nullifiedCount}`);
      } else {
        console.log(`No contracts found referencing old subscription ID: ${oldDbSubscriptionId}.`);
      }
    }

    // Step 2: UPSERT the stripe_subscriptions table with the new subscription data.
    // This operation should now succeed because any conflicting foreign key references have been removed.
    const { data: newSubscriptionDb, error: subUpsertError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: stripeSubscription.customer as string,
        subscription_id: stripeSubscription.id,
        price_id: priceId,
        current_period_start: stripeSubscription.current_period_start,
        current_period_end: stripeSubscription.current_period_end,
        ...(stripeSubscription.default_payment_method && typeof stripeSubscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: stripeSubscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: stripeSubscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: stripeSubscription.status,
        max_users: maxUsers,
        max_files: maxFiles,
      },
      {
        onConflict: 'customer_id',
      },
    ).select().single();

    if (subUpsertError) {
      console.error('Error upserting subscription:', subUpsertError);
      throw new Error('Failed to update subscription status in database');
    }
    console.log('stripe_subscriptions table successfully upserted with new subscription ID.');

    // Step 3: Re-link contracts to the new subscription ID
    // This is necessary for contracts that were just nullified.
    if (oldDbSubscriptionId && oldDbSubscriptionId !== newStripeSubscriptionId) {
      console.log(`Re-linking contracts to new subscription ID: ${newStripeSubscriptionId}...`);
      const { error: relinkContractsError } = await supabase
        .from('contracts')
        .update({ subscription_id: newStripeSubscriptionId })
        .eq('user_id', userId)
        .is('subscription_id', null);

      if (relinkContractsError) {
        console.error('Error re-linking contracts to new subscription ID:', relinkContractsError);
        throw new Error('Failed to re-link contracts to new subscription ID.');
      }
      console.log('Contracts successfully re-linked to new subscription ID.');
    }
    // --- END OF CRITICAL FIX ---

    // Upsert the subscription_memberships entry for the owner
    const { error: membershipUpsertError } = await supabase
      .from('subscription_memberships')
      .upsert(
        {
          user_id: userId,
          subscription_id: stripeSubscription.id,
          role: 'owner',
          status: stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing' ? 'active' : 'inactive',
          accepted_at: new Date().toISOString(),
        },
        { onConflict: ['user_id', 'subscription_id'] }
      );

    if (membershipUpsertError) {
      console.error('Error upserting subscription_memberships for owner:', membershipUpsertError);
      // Do not throw, just log the error.
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
    const productNameKey = currentProduct?.name || 'product_name_single_use'; // Use key
    // MODIFIED: Translate productNameKey before passing it to the message template
    const translatedProductName = getTranslatedMessage(productNameKey, userPreferredLanguage);

    // MODIFIED: Translate oldProductNameKey before passing it to the message template
    const oldProduct = stripeProducts.find(p =>
        p.pricing.monthly?.priceId === oldPriceId ||
        p.pricing.yearly?.priceId === oldPriceId ||
        p.pricing.one_time?.priceId === oldPriceId
    );
    const oldProductNameKey = oldProduct?.name || 'previous_plan'; // Use key
    const translatedOldProductName = getTranslatedMessage(oldProductNameKey, userPreferredLanguage);


    // Only send notification if there was a meaningful change in status or price
    if (oldStatus !== newStatus || oldPriceId !== newPriceId) {
        if (newStatus === 'active' || newStatus === 'trialing') {
            // MODIFIED: Add condition to check eventType for 'customer.subscription.created'
            if (eventType === 'customer.subscription.created' && oldStatus !== 'active' && oldStatus !== 'trialing') {
                // This is the initial activation notification
                const notificationMessage = getTranslatedMessage('subscription_active_message', userPreferredLanguage, { productName: translatedProductName });
                await insertNotification(
                    userId,
                    'notification_title_subscription_active',
                    notificationMessage,
                    'success'
                );
            } else if (oldPriceId !== newPriceId) {
                // This is a plan change (upgrade/downgrade)
                const notificationMessage = getTranslatedMessage('subscription_plan_changed_message', userPreferredLanguage, { oldPlan: translatedOldProductName, newPlan: translatedProductName });
                await insertNotification(
                    userId,
                    'notification_title_subscription_plan_changed',
                    notificationMessage,
                    'info'
                );
            }
        } else if (newStatus === 'canceled' || newStatus === 'unpaid' || newStatus === 'past_due') {
            let notificationMessage: string;
            if (newStatus === 'canceled' && stripeSubscription.cancel_at_period_end) {
                const endDate = new Date(stripeSubscription.current_period_end * 1000).toLocaleDateString();
                notificationMessage = getTranslatedMessage('subscription_canceled_at_period_end_message', userPreferredLanguage, { productName: translatedProductName, endDate: endDate });
            } else {
                notificationMessage = getTranslatedMessage('subscription_alert_message', userPreferredLanguage, { productName: translatedProductName, status: newStatus });
            }
            await insertNotification(
                userId,
                'notification_title_subscription_alert',
                notificationMessage,
                'warning'
            );
        }
    }
    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}