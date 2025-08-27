import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { Resend } from 'npm:resend@6.0.1';

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
    return corsResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return corsResponse({ error: 'Email is required.' }, 400);
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
      return corsResponse({ error: 'Failed to generate OTP.' }, 500);
    }

    // Send OTP via email using Resend
    const { data, error: resendError } = await resend.emails.send({
      from: 'ContractAnalyser <noreply@mail.contractanalyser.com>', // IMPORTANT: Replace with your verified sender email in Resend
      to: [email],
      subject: 'Your ContractAnalyser OTP',
      html: `
        <p>Hello,</p>
        <p>Your One-Time Password (OTP) for ContractAnalyser is: <strong>${otpCode}</strong></p>
        <p>This code is valid for 5 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>The ContractAnalyser Team</p>
      `,
    });

    if (resendError) {
      console.error('Error sending email via Resend:', resendError);
      return corsResponse({ error: 'Failed to send OTP email.' }, 500);
    }

    console.log(`OTP sent to ${email}:`, data);
    return corsResponse({ message: 'OTP sent successfully!' });

  } catch (error: any) {
    console.error('Error in send-email-otp Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});