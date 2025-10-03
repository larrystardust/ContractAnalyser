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
  const origin = req.headers.get('Origin'); // Get the origin from the request

  if (req.method === 'OPTIONS') {
    return corsResponse(null, 204, origin); // Pass origin to corsResponse
  }

  if (req.method !== 'POST') {
    return corsResponse({ error: getTranslatedMessage('message_method_not_allowed', 'en') }, 405, origin); // Pass origin
  }

  try {
    const { email, browserLanguage } = await req.json();
    // Prioritize browserLanguage directly for unauthenticated OTP flow
    const userPreferredLanguage = browserLanguage || 'en';

    if (!email) {
      return corsResponse({ error: getTranslatedMessage('message_missing_required_fields', userPreferredLanguage) }, 400, origin); // Pass origin
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
      return corsResponse({ error: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: 'Failed to generate OTP.' }) }, 500, origin); // Pass origin
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
      return corsResponse({ error: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: 'Failed to send OTP email.' }) }, 500, origin); // Pass origin
    }

    // console.log(`OTP sent to ${email}:`, data); // REMOVED
    return corsResponse({ message: getTranslatedMessage('message_otp_sent_successfully', userPreferredLanguage) }, 200, origin); // Pass origin

  } catch (error: any) {
    console.error('Error in send-email-otp Edge Function:', error);
    return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: error.message }) }, 500, origin); // Pass origin
  }
});