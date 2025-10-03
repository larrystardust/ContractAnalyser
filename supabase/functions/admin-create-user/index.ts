import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';
import { stripeProducts } from '../_shared/stripe_products_data.ts'; // ADDED: Import stripeProducts
import { insertNotification } from '../_shared/notification_utils.ts'; // ADDED: Import insertNotification
import { getTranslatedMessage } from '../_shared/edge_translations.ts'; // ADDED: Import getTranslatedMessage

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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
    return corsResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const {
      email,
      password,
      full_name,
      business_name,
      mobile_phone_number,
      country_code,
      is_admin, // ADDED
      default_jurisdictions, // ADDED
      price_id, // ADDED
      role, // ADDED
      send_invitation_email,
      initial_password,
      adminLanguage
    } = await req.json();

    // console.log('admin-create-user: Received request body:', { email, password: '[REDACTED]', full_name, business_name, mobile_phone_number, country_code, is_admin, default_jurisdictions, price_id, role, send_invitation_email, adminLanguage }); // REMOVED

    if (!email || !password) {
      console.error('admin-create-user: Missing email or password in request.');
      return corsResponse({ error: 'Email and password are required.' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('admin-create-user: Authorization header missing.');
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token', details: userError?.message }, 401);
    }
    // console.log('admin-create-user: Admin user authenticated:', user.id); // REMOVED

    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminProfileError || !adminProfile?.is_admin) {
      console.error('admin-create-user: Forbidden: User is not an administrator.', adminProfileError);
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }
    // console.log('admin-create-user: Admin privileges confirmed.'); // REMOVED

    const { data: appSettings, error: appSettingsError } = await supabase
      .from('app_settings')
      .select('default_theme')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (appSettingsError) {
      console.warn('admin-create-user: Error fetching app settings for default theme:', appSettingsError);
    }
    const defaultTheme = appSettings?.default_theme || 'system';
    // console.log('admin-create-user: Default theme determined:', defaultTheme); // REMOVED

    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || null,
        business_name: business_name || null,
        mobile_phone_number: mobile_phone_number || null,
        country_code: country_code || null,
      }
    });

    if (createUserError) {
      console.error('admin-create-user: Error creating user in auth:', createUserError);
      return corsResponse({ error: createUserError.message }, 500);
    }
    // console.log('admin-create-user: User created in Supabase Auth. Full newUser object:', JSON.stringify(newUser, null, 2)); // REMOVED
    // console.log('admin-create-user: newUser.user.id:', newUser.user.id); // REMOVED
    // console.log('admin-create-user: newUser.user.email (after createUser):', newUser.user.email); // REMOVED

    const { error: insertProfileError } = await supabase
      .from('profiles')
      .insert({
        id: newUser.user.id,
        full_name: full_name || null,
        business_name: business_name || null,
        mobile_phone_number: mobile_phone_number || null,
        country_code: country_code || null,
        is_admin: is_admin, // ADDED: Persist is_admin
        default_jurisdictions: default_jurisdictions, // ADDED: Persist default_jurisdictions
        theme_preference: defaultTheme,
        language_preference: null, // MODIFIED: Set language_preference to null
      });

    if (insertProfileError) {
      console.error('admin-create-user: Error inserting user profile:', insertProfileError);
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return corsResponse({ error: 'Failed to create user profile.' }, 500);
    }
    // console.log('admin-create-user: User profile inserted successfully.'); // REMOVED

    // --- START: Subscription Assignment Logic ---
    if (price_id && role) {
      // console.log(`admin-create-user: Assigning subscription with price_id: ${price_id} and role: ${role}`); // REMOVED

      // 1. Get or Create Stripe Customer for the new user
      let customerId: string | null = null;
      const { data: existingCustomer, error: customerFetchError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', newUser.user.id)
        .maybeSingle();

      if (customerFetchError) {
        console.error('admin-create-user: Error fetching existing customer for new user:', customerFetchError);
        // Continue, but log the error.
      }

      if (existingCustomer) {
        customerId = existingCustomer.customer_id;
        // console.log('admin-create-user: Found existing customerId for new user:', customerId); // REMOVED
      } else {
        // console.log('admin-create-user: No existing customer for new user, creating new one.'); // REMOVED
        const Stripe = (await import('npm:stripe@17.7.0')).default;
        const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
        const stripe = new Stripe(stripeSecret, {
          appInfo: {
            name: 'Bolt Integration',
            version: '1.0.0',
          },
        });

        const newStripeCustomer = await stripe.customers.create({
          email: newUser.user.email,
          metadata: { userId: newUser.user.id },
        });
        customerId = newStripeCustomer.id;

        const { error: insertCustomerError } = await supabase.from('stripe_customers').insert({
          user_id: newUser.user.id,
          customer_id: customerId,
        });
        if (insertCustomerError) {
          console.error('admin-create-user: Error inserting new Stripe customer for new user:', insertCustomerError);
          // Continue, but log the error.
        }
        // console.log('admin-create-user: Created new customerId for new user:', customerId); // REMOVED
      }

      if (customerId) {
        const selectedProduct = stripeProducts.find(p =>
          p.pricing.monthly?.priceId === price_id ||
          p.pricing.yearly?.priceId === price_id ||
          p.pricing.one_time?.priceId === price_id
        );

        if (!selectedProduct || selectedProduct.mode !== 'admin_assigned') {
          console.warn('admin-create-user: Attempted to assign a non-admin_assigned product or product not found:', price_id);
          // Continue without assigning subscription, but log.
        } else {
          const adminAssignedSubscriptionId = `admin_assigned_${newUser.user.id}_${Date.now()}`;
          const maxUsers = selectedProduct.max_users ?? null;
          const maxFiles = selectedProduct.maxFiles ?? null;

          // Upsert directly into stripe_subscriptions table
          const { error: upsertSubError } = await supabase
            .from('stripe_subscriptions')
            .upsert({
              customer_id: customerId,
              subscription_id: adminAssignedSubscriptionId,
              price_id: price_id,
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(new Date('2099-12-31').getTime() / 1000),
              cancel_at_period_end: false,
              payment_method_brand: 'Admin',
              payment_method_last4: 'Free',
              status: 'active',
              max_users: maxUsers,
              max_files: maxFiles,
            }, { onConflict: 'customer_id' });

          if (upsertSubError) {
            console.error('admin-create-user: Error upserting admin-assigned subscription for new user:', upsertSubError);
            // Continue, but log the error.
          } else {
            // console.log('admin-create-user: Admin-assigned subscription upserted successfully.'); // REMOVED

            // Upsert membership for the new user
            const { error: membershipUpsertError } = await supabase
              .from('subscription_memberships')
              .upsert(
                {
                  user_id: newUser.user.id,
                  subscription_id: adminAssignedSubscriptionId,
                  role: role,
                  status: 'active',
                  accepted_at: new Date().toISOString(),
                  invited_email_address: newUser.user.email,
                },
                { onConflict: ['user_id', 'subscription_id'] }
              );

            if (membershipUpsertError) {
              console.error('admin-create-user: Error upserting membership for new user:', membershipUpsertError);
              // Continue, but log the error.
            } else {
              // console.log('admin-create-user: Membership upserted successfully for new user.'); // REMOVED
              const translatedProductName = getTranslatedMessage(selectedProduct.name, adminLanguage);
              await insertNotification(
                newUser.user.id,
                getTranslatedMessage('notification_title_plan_assigned', adminLanguage),
                getTranslatedMessage('notification_message_admin_assigned_plan', adminLanguage, { productName: translatedProductName }),
                'success'
              );
              await logActivity(
                supabase,
                user.id,
                'ADMIN_SUBSCRIPTION_ASSIGNED_FREE',
                `Admin ${user.email} assigned free plan (${selectedProduct.name}) to new user: ${newUser.user.email}`,
                { target_user_id: newUser.user.id, target_user_email: newUser.user.email, price_id: price_id, subscription_id: adminAssignedSubscriptionId, role: role }
              );
            }
          }
        }
      }
    }
    // --- END: Subscription Assignment Logic ---

    if (send_invitation_email) {
      // console.log('admin-create-user: send_invitation_email is true. Invoking send-admin-created-user-invite-email...'); // REMOVED
      const emailRecipientName = String(full_name || newUser.user.email || 'User');
      const { data: emailFnResponse, error: emailFnInvokeError } = await supabase.functions.invoke('send-admin-created-user-invite-email', {
        body: {
          recipientEmail: newUser.user.email,
          recipientName: emailRecipientName,
          initialPassword: initial_password,
          userPreferredLanguage: adminLanguage,
        },
      });

      if (emailFnInvokeError) {
        console.error('admin-create-user: Error invoking send-admin-created-user-invite-email Edge Function:', emailFnInvokeError);
      } else if (emailFnResponse && !emailFnResponse.success) {
        console.warn('admin-create-user: send-admin-created-user-invite-email Edge Function reported failure:', emailFnResponse.message);
      } else {
        // console.log('admin-create-user: send-admin-created-user-invite-email Edge Function invoked successfully.'); // REMOVED
      }
    } else {
      // console.log('admin-create-user: send_invitation_email is false. Skipping custom invitation email.'); // REMOVED
    }

    await logActivity(
      supabase,
      user.id,
      'ADMIN_USER_CREATED',
      `Admin ${user.email} created new user: ${email}`,
      { target_user_id: newUser.user.id, target_user_email: email }
    );
    // console.log('admin-create-user: Activity logged. Returning success response.'); // REMOVED

    return corsResponse({ message: 'User created successfully', userId: newUser.user.id });

  } catch (error: any) {
    console.error('admin-create-user: Unhandled error in Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});