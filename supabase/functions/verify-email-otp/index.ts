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
    const { email, otp_code } = await req.json();

    if (!email || !otp_code) {
      return corsResponse({ error: 'Email and OTP code are required.' }, 400);
    }

    // Find the OTP in the database
    const { data: otpRecord, error: fetchError } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otp_code)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching OTP record:', fetchError);
      return corsResponse({ error: 'Verification failed due to a server error.' }, 500);
    }

    if (!otpRecord) {
      return corsResponse({ error: 'Invalid OTP or OTP already used.' }, 400);
    }

    // Check if OTP has expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      // Mark as used even if expired to prevent re-use attempts
      await supabase.from('email_otps').update({ is_used: true }).eq('id', otpRecord.id);
      return corsResponse({ error: 'OTP has expired.' }, 400);
    }

    // Mark OTP as used
    const { error: updateError } = await supabase
      .from('email_otps')
      .update({ is_used: true })
      .eq('id', otpRecord.id);

    if (updateError) {
      console.error('Error marking OTP as used:', updateError);
      return corsResponse({ error: 'Verification failed due to a server error.' }, 500);
    }

    return corsResponse({ message: 'Email verified successfully!' });

  } catch (error: any) {
    console.error('Error in verify-email-otp Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});