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
    const { default_theme, default_jurisdictions, global_email_reports_enabled } = await req.json();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    // Verify if the user is an admin
    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminProfileError || !adminProfile?.is_admin) {
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }

    // Update the single row of app settings
    const { data: updatedSettings, error: updateError } = await supabase
      .from('app_settings')
      .update({
        default_theme: default_theme,
        default_jurisdictions: default_jurisdictions,
        global_email_reports_enabled: global_email_reports_enabled,
      })
      .eq('id', '00000000-0000-0000-0000-000000000000') // Ensure we update the single row
      .select()
      .single();

    if (updateError) {
      console.error('Error updating app settings:', updateError);
      return corsResponse({ error: 'Failed to update application settings.' }, 500);
    }

    return corsResponse({ message: 'Application settings updated successfully', settings: updatedSettings });

  } catch (error: any) {
    console.error('Error in admin-update-app-settings Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});