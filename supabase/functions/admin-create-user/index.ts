import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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
    const { email, password, full_name, business_name, mobile_phone_number, country_code, is_admin, send_invitation_email, initial_password, adminLanguage } = await req.json();

    console.log('admin-create-user: Received request body:', { email, password: '[REDACTED]', full_name, business_name, mobile_phone_number, country_code, is_admin, send_invitation_email, adminLanguage });

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
    console.log('admin-create-user: Admin user authenticated:', user.id);

    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminProfileError || !adminProfile?.is_admin) {
      console.error('admin-create-user: Forbidden: User is not an administrator.', adminProfileError);
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }
    console.log('admin-create-user: Admin privileges confirmed.');

    const { data: appSettings, error: appSettingsError } = await supabase
      .from('app_settings')
      .select('default_theme')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (appSettingsError) {
      console.warn('admin-create-user: Error fetching app settings for default theme:', appSettingsError);
    }
    const defaultTheme = appSettings?.default_theme || 'system';
    console.log('admin-create-user: Default theme determined:', defaultTheme);

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
    console.log('admin-create-user: User created in Supabase Auth. Full newUser object:', JSON.stringify(newUser, null, 2));
    console.log('admin-create-user: newUser.user.id:', newUser.user.id);
    console.log('admin-create-user: newUser.user.email (after createUser):', newUser.user.email);

    const { error: insertProfileError } = await supabase
      .from('profiles')
      .insert({
        id: newUser.user.id,
        full_name: full_name || null,
        business_name: business_name || null,
        mobile_phone_number: mobile_phone_number || null,
        country_code: country_code || null,
        theme_preference: defaultTheme,
        language_preference: adminLanguage,
      });

    if (insertProfileError) {
      console.error('admin-create-user: Error inserting user profile:', insertProfileError);
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return corsResponse({ error: 'Failed to create user profile.' }, 500);
    }
    console.log('admin-create-user: User profile inserted successfully.');

    if (send_invitation_email) {
      console.log('admin-create-user: send_invitation_email is true. Invoking send-admin-created-user-invite-email...');
      // Ensure recipientName is a primitive string here
      const emailRecipientName = String(full_name || newUser.user.email || 'User'); // MODIFIED: Ensure it's a string with fallback
      const { data: emailFnResponse, error: emailFnInvokeError } = await supabase.functions.invoke('send-admin-created-user-invite-email', {
        body: {
          recipientEmail: newUser.user.email,
          recipientName: emailRecipientName, // MODIFIED: Pass the ensured string
          initialPassword: initial_password,
          userPreferredLanguage: adminLanguage,
        },
      });

      if (emailFnInvokeError) {
        console.error('admin-create-user: Error invoking send-admin-created-user-invite-email Edge Function:', emailFnInvokeError);
      } else if (emailFnResponse && !emailFnResponse.success) {
        console.warn('admin-create-user: send-admin-created-user-invite-email Edge Function reported failure:', emailFnResponse.message);
      } else {
        console.log('admin-create-user: send-admin-created-user-invite-email Edge Function invoked successfully.');
      }
    } else {
      console.log('admin-create-user: send_invitation_email is false. Skipping custom invitation email.');
    }

    await logActivity(
      supabase,
      user.id,
      'ADMIN_USER_CREATED',
      `Admin ${user.email} created new user: ${email}`,
      { target_user_id: newUser.user.id, target_user_email: email }
    );
    console.log('admin-create-user: Activity logged. Returning success response.');

    return corsResponse({ message: 'User created successfully', userId: newUser.user.id });

  } catch (error: any) {
    console.error('admin-create-user: Unhandled error in Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});