import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { Resend } from 'npm:resend@6.0.1';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

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
    return corsResponse({ error: getTranslatedMessage('message_method_not_allowed', 'en') }, 405);
  }

  try {
    const { email, browserLanguage } = await req.json(); // MODIFIED: Accept browserLanguage
    let userPreferredLanguage = browserLanguage || 'en'; // MODIFIED: Prioritize browserLanguage if available

    // Attempt to fetch user's language preference if profile exists
    const { data: authUser, error: authUserError } = await supabase.auth.admin.listUsers({ email: email, page: 1, perPage: 1 });
    let userId = null;
    if (!authUserError && authUser.users.length > 0) {
      userId = authUser.users[0].id;
    }

    if (userId) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('language_preference')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.warn('Error fetching profile for language preference in send-email-otp:', profileError);
      } else if (profileData?.language_preference) {
        userPreferredLanguage = profileData.language_preference; // Use profile preference if found
      }
    }
    // END MODIFIED

    if (!email) {
      return corsResponse({ error: getTranslatedMessage('message_missing_required_fields', userPreferredLanguage) }, 400);
    }

    // Generate a 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

    // Store OTP in database
    const { error: insertError } = await supabase
      .from('email_otps')
      .insert({
        email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error storing OTP:', insertError);
      return corsResponse({ error: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: 'Failed to generate OTP.' }) }, 500);
    }

    // Send OTP via email using Resend
    const { data, error: resendError } = await resend.emails.send({
      from: 'ContractAnalyser <noreply@mail.contractanalyser.com>', // IMPORTANT: Replace with your verified sender email in Resend
      to: [email],
      subject: getTranslatedMessage('email_otp_subject', userPreferredLanguage),
      html: `
        <p>${getTranslatedMessage('email_hello', userPreferredLanguage, { recipientName: email })}</p>
        <p>${getTranslatedMessage('email_otp_body_p1', userPreferredLanguage, { otpCode: otpCode })}</p>
        <p>${getTranslatedMessage('email_otp_body_p2', userPreferredLanguage)}</p>
        <p>${getTranslatedMessage('email_otp_body_p3', userPreferredLanguage)}</p>
        <p>${getTranslatedMessage('email_otp_body_p4', userPreferredLanguage)}</p>
      `,
    });

    if (resendError) {
      console.error('Error sending email via Resend:', resendError);
      return corsResponse({ error: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: 'Failed to send OTP email.' }) }, 500);
    }

    console.log(`OTP sent to ${email}:`, data);
    return corsResponse({ message: getTranslatedMessage('message_otp_sent_successfully', userPreferredLanguage) });

  } catch (error: any) {
    console.error('Error in send-email-otp Edge Function:', error);
    return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: error.message }) }, 500);
  }
});