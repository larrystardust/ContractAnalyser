import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Helper for CORS responses
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
    const { userId, fullName, businessName, mobilePhoneNumber, countryCode } = await req.json(); // MODIFIED: Added businessName
    console.log('create-user-profile: Received payload:', { userId, fullName, businessName, mobilePhoneNumber, countryCode }); // ADDED LOG

    if (!userId) {
      console.error('create-user-profile: Missing userId in payload.'); // ADDED LOG
      return corsResponse({ error: 'Missing userId' }, 400);
    }

    // Use upsert to create or update the profile.
    // The service_role key bypasses RLS.
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          full_name: fullName || null, // Use provided data or null
          business_name: businessName || null, // ADDED: Include business_name
          mobile_phone_number: mobilePhoneNumber || null, // Use provided data or null
          country_code: countryCode || null, // Use provided data or null
          // Other columns will use their default values if not provided here
        },
        { onConflict: 'id' } // Conflict on 'id' to update if exists
      )
      .select()
      .single();

    if (error) {
      console.error('create-user-profile: Error upserting profile:', error); // MODIFIED LOG
      return corsResponse({ error: error.message }, 500);
    }

    console.log('create-user-profile: Profile upserted successfully:', data); // ADDED LOG
    return corsResponse({ message: 'Profile created/updated successfully', profile: data });

  } catch (error: any) {
    console.error('create-user-profile: Unhandled error:', error); // MODIFIED LOG
    return corsResponse({ error: error.message }, 500);
  }
});