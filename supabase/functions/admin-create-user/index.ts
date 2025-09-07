import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

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
    const { email, password, full_name, business_name, mobile_phone_number, country_code, is_admin, email_confirm } = await req.json();

    if (!email || !password) {
      return corsResponse({ error: 'Email and password are required.' }, 400);
    }

    // Authenticate the request to ensure it's coming from an authorized source (e.g., an admin user)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    // Verify if the user is an admin (assuming 'is_admin' column in 'profiles' table)
    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminProfileError || !adminProfile?.is_admin) {
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }

    // Fetch global app settings to get default theme
    const { data: appSettings, error: appSettingsError } = await supabase
      .from('app_settings')
      .select('default_theme')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (appSettingsError) {
      console.error('Error fetching app settings for default theme:', appSettingsError);
      // Continue with default 'system' theme if fetching fails
    }
    const defaultTheme = appSettings?.default_theme || 'system'; // Fallback to 'system'

    // Create the user in Supabase Auth
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: email_confirm ?? true, // Default to true, admin can override
    });

    if (createUserError) {
      console.error('Error creating user in auth:', createUserError);
      return corsResponse({ error: createUserError.message }, 500);
    }

    // Insert profile data for the new user
    const { error: insertProfileError } = await supabase
      .from('profiles')
      .insert({
        id: newUser.user.id,
        full_name: full_name || null,
        business_name: business_name || null,
        mobile_phone_number: mobile_phone_number || null,
        country_code: country_code || null,
        theme_preference: defaultTheme, // Use the fetched default theme
      });

    if (insertProfileError) {
      console.error('Error inserting user profile:', insertProfileError);
      // Optionally, delete the user from auth if profile creation fails
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return corsResponse({ error: 'Failed to create user profile.' }, 500);
    }

    return corsResponse({ message: 'User created successfully', userId: newUser.user.id });

  } catch (error: any) {
    console.error('Error in admin-create-user Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});