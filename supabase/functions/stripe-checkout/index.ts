import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { getTranslatedMessage } from '../_shared/edge_translations.ts'; // ADDED

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
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
  };

  if (status === 204) {
    return new Response(null, { status, headers });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  let userPreferredLanguage = 'en'; // Default language

  try {
    if (req.method === 'OPTIONS') {
      return corsResponse({}, 204);
    }

    if (req.method !== 'POST') {
      return corsResponse({ error: getTranslatedMessage('message_method_not_allowed', userPreferredLanguage) }, 405); // MODIFIED
    }

    const { price_id, success_url, cancel_url, mode, locale } = await req.json();
    userPreferredLanguage = locale || 'en'; // MODIFIED: Set userPreferredLanguage from locale

    const error = validateParameters(
      { price_id, success_url, cancel_url, mode },
      {
        cancel_url: 'string',
        price_id: 'string',
        success_url: 'string',
        mode: { values: ['payment', 'subscription'] },
      },
      userPreferredLanguage // MODIFIED: Pass userPreferredLanguage
    );

    if (error) {
      return corsResponse({ error }, 400);
    }

    const authHeader = req.headers.get('Authorization')!;
    if (!authHeader) { // MODIFIED: Add check for missing authHeader
      return corsResponse({ error: getTranslatedMessage('message_authorization_header_missing', userPreferredLanguage) }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser(token);

    if (getUserError) {
      return corsResponse({ error: getTranslatedMessage('message_failed_to_authenticate_user', userPreferredLanguage) }, 401); // MODIFIED
    }

    if (!user) {
      return corsResponse({ error: getTranslatedMessage('message_user_not_found', userPreferredLanguage) }, 404); // MODIFIED
    }

    const { data: customer, error: getCustomerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (getCustomerError) {
      console.error('Failed to fetch customer information from the database', getCustomerError);

      return corsResponse({ error: getTranslatedMessage('message_failed_to_fetch_customer_information', userPreferredLanguage) }, 500); // MODIFIED
    }

    let customerId;

    if (!customer || !customer.customer_id) {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });

      console.log(`Created new Stripe customer ${newCustomer.id} for user ${user.id}`);

      const { error: createCustomerError } = await supabase.from('stripe_customers').insert({
        user_id: user.id,
        customer_id: newCustomer.id,
      });

      if (createCustomerError) {
        console.error('Failed to save customer information in the database', createCustomerError);

        try {
          await stripe.customers.del(newCustomer.id);
          await supabase.from('stripe_subscriptions').delete().eq('customer_id', newCustomer.id);
        } catch (deleteError) {
          console.error('Failed to clean up after customer mapping error:', deleteError);
        }

        return corsResponse({ error: getTranslatedMessage('message_failed_to_create_customer_mapping', userPreferredLanguage) }, 500); // MODIFIED
      }

      if (mode === 'subscription') {
        const { error: createSubscriptionError } = await supabase.from('stripe_subscriptions').insert({
          customer_id: newCustomer.id,
          status: 'not_started',
        });

        if (createSubscriptionError) {
          console.error('Failed to save subscription in the database', createSubscriptionError);

          try {
            await stripe.customers.del(newCustomer.id);
          } catch (deleteError) {
            console.error('Failed to delete Stripe customer after subscription creation error:', deleteError);
          }

          return corsResponse({ error: getTranslatedMessage('message_unable_to_save_subscription_db', userPreferredLanguage) }, 500); // MODIFIED
        }
      }

      customerId = newCustomer.id;

      console.log(`Successfully set up new customer ${customerId} with subscription record`);
    } else {
      customerId = customer.customer_id;

      if (mode === 'subscription') {
        const { data: subscription, error: getSubscriptionError } = await supabase
          .from('stripe_subscriptions')
          .select('status')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (getSubscriptionError) {
          console.error('Failed to fetch subscription information from the database', getSubscriptionError);

          return corsResponse({ error: getTranslatedMessage('message_failed_to_fetch_subscription_information', userPreferredLanguage) }, 500); // MODIFIED
        }

        if (!subscription) {
          const { error: createSubscriptionError } = await supabase.from('stripe_subscriptions').insert({
            customer_id: customerId,
            status: 'not_started',
          });

          if (createSubscriptionError) {
            console.error('Failed to create subscription record for existing customer', createSubscriptionError);

            return corsResponse({ error: getTranslatedMessage('message_failed_to_create_subscription_record', userPreferredLanguage) }, 500); // MODIFIED
          }
        }
      }
    }

    // ADDED: Fetch credits from stripe_product_metadata for one-time payments
    let credits = null;
    if (mode === 'payment') {
      const { data: productMetadata, error: metadataError } = await supabase
        .from('stripe_product_metadata')
        .select('credits')
        .eq('price_id', price_id)
        .maybeSingle();

      if (metadataError) {
        console.error('Error fetching product metadata for credits:', metadataError);
        // Continue without credits, but log the error
      } else if (productMetadata?.credits) {
        credits = productMetadata.credits;
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      mode,
      success_url,
      cancel_url,
      locale: locale, // ADDED: Pass locale to Stripe Checkout
      // ADDED: Pass credits as metadata for one-time payments
      metadata: mode === 'payment' && credits !== null ? { credits: credits.toString() } : undefined,
    });

    console.log(`Created checkout session ${session.id} for customer ${customerId}`);

    return corsResponse({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error(`Checkout error: ${error.message}`);
    return corsResponse({ error: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: error.message }) }, 500); // MODIFIED
  }
});

type ExpectedType = 'string' | { values: string[] };
type Expectations<T> = { [K in keyof T]: ExpectedType };

// MODIFIED: Added userPreferredLanguage parameter
function validateParameters<T extends Record<string, any>>(values: T, expected: Expectations<T>, userPreferredLanguage: string): string | undefined {
  for (const parameter in values) {
    const expectation = expected[parameter];
    const value = values[parameter];

    if (expectation === 'string') {
      if (value == null) {
        return getTranslatedMessage('message_missing_required_parameter', userPreferredLanguage, { parameter: parameter }); // MODIFIED
      }
      if (typeof value !== 'string') {
        return getTranslatedMessage('message_invalid_parameter_type', userPreferredLanguage, { parameter: parameter, value: JSON.stringify(value) }); // MODIFIED
      }
    } else {
      if (!expectation.values.includes(value)) {
        return getTranslatedMessage('message_invalid_parameter_value', userPreferredLanguage, { parameter: parameter, values: expectation.values.join(', ') }); // MODIFIED
      }
    }
  }

  return undefined;
}