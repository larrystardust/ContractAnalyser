import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

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
    const { userId, fullName, businessName, mobilePhoneNumber, countryCode, languagePreference } = await req.json();
    console.log('create-user-profile: Received payload:', { userId, fullName, businessName, mobilePhoneNumber, countryCode, languagePreference });

    if (!userId) {
      console.error('create-user-profile: Missing userId in payload.');
      return corsResponse({ error: 'Missing userId' }, 400);
    }

    // Fetch existing profile to preserve notification_settings if they exist
    const { data: existingProfile, error: fetchProfileError } = await supabase
      .from('profiles')
      .select('notification_settings')
      .eq('id', userId)
      .maybeSingle();

    if (fetchProfileError) {
      console.error('create-user-profile: Error fetching existing profile:', fetchProfileError);
      // Continue, but log the error
    }

    // Define default notification settings
    const defaultNotificationSettings = {
      'analysis-complete': { email: true, inApp: true },
      'high-risk-findings': { email: true, inApp: true },
      'weekly-reports': { email: false, inApp: false },
      'system-updates': { email: false, inApp: true },
    };

    // Merge existing settings with defaults, prioritizing existing
    const mergedNotificationSettings = {
      ...defaultNotificationSettings,
      ...(existingProfile?.notification_settings || {}),
    };

    // Use upsert to create or update the profile.
    // The service_role key bypasses RLS.
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: fullName || null,
          business_name: businessName || null,
          mobile_phone_number: mobilePhoneNumber || null,
          country_code: countryCode || null,
          notification_settings: mergedNotificationSettings,
          language_preference: languagePreference ?? 'en', // MODIFIED: Use nullish coalescing operator
        },
        { onConflict: 'id' } // Conflict on 'id' to update if exists
      )
      .select()
      .single();

    if (error) {
      console.error('create-user-profile: Error upserting profile:', error);
      return corsResponse({ error: error.message }, 500);
    }

    console.log('create-user-profile: Profile upserted successfully:', data);
    return corsResponse({ message: 'Profile created/updated successfully', profile: data });

  } catch (error: any) {
    console.error('create-user-profile: Unhandled error:', error);
    return corsResponse({ error: error.message }, 500);
  }
});