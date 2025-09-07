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
    const { recipientEmail, invitationLink, inviterName } = await req.json();

    if (!recipientEmail || !invitationLink || !inviterName) {
      return corsResponse({ error: 'Missing required email parameters' }, 400);
    }

    console.log(`Attempting to send invitation email to ${recipientEmail} from ${inviterName}`);

    try {
      const { data, error } = await resend.emails.send({
        from: 'ContractAnalyser <noreply@mail.contractanalyser.com>',
        to: [recipientEmail],
        subject: `You're invited to ContractAnalyser by ${inviterName}!`,
        html: `
          <p>Hello,</p>
          <p>${inviterName} has invited you to join and start using their ContractAnalyser subscription!</p>
          <p>Click the link below to accept the invitation and get started:</p>
          <p><a href="${invitationLink}">Accept Invitation</a></p>
          <p>If you don't have an account yet, you will be prompted to sign up first.</p>
          <p>Thank you for using ContractAnalyser.</p>
          <p>The ContractAnalyser Team</p>
        `,
      });

      if (error) {
        console.error('Error sending email via Resend:', error);
        return corsResponse({ success: false, message: `Failed to send invitation email: ${error.message}` });
      }
      console.log('Email sent successfully via Resend:', data);
      return corsResponse({ success: true, message: 'Invitation email sent successfully.' });

    } catch (emailSendError: any) {
      console.error('Caught unexpected error during email sending:', emailSendError);
      return corsResponse({ success: false, message: `An unexpected error occurred during email sending: ${emailSendError.message}` });
    }

  } catch (error: any) {
    console.error('Error in send-invitation-email Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});