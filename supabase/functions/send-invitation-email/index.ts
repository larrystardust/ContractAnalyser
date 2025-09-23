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
    const { recipientEmail, invitationLink, inviterName, userPreferredLanguage } = await req.json();

    if (!recipientEmail || !invitationLink || !inviterName) {
      return corsResponse({ error: getTranslatedMessage('message_missing_required_fields', 'en') }, 400);
    }

    console.log(`Attempting to send invitation email to ${recipientEmail} from ${inviterName}`);

    // Translate subject and body
    const subject = getTranslatedMessage('email_subject_invitation', userPreferredLanguage, { inviterName: inviterName });
    const htmlBody = `
          <p>${getTranslatedMessage('email_hello', userPreferredLanguage, { recipientName: recipientEmail })}</p>
          <p>${getTranslatedMessage('email_invitation_body_p1', userPreferredLanguage, { inviterName: inviterName })}</p>
          <p>${getTranslatedMessage('email_invitation_body_p2', userPreferredLanguage)}</p>
          <p><a href="${invitationLink}">${getTranslatedMessage('email_accept_invitation_button', userPreferredLanguage)}</a></p>
          <p>${getTranslatedMessage('email_invitation_body_p3', userPreferredLanguage)}</p>
          <p>${getTranslatedMessage('email_invitation_body_p4', userPreferredLanguage)}</p>
          <p>${getTranslatedMessage('email_invitation_body_p5', userPreferredLanguage)}</p>
        `;

    try {
      const { data, error } = await resend.emails.send({
        from: 'ContractAnalyser <noreply@mail.contractanalyser.com>',
        to: [recipientEmail],
        subject: subject,
        html: htmlBody,
      });

      if (error) {
        console.error('Error sending email via Resend:', error);
        return corsResponse({ success: false, message: getTranslatedMessage('message_invitation_sent_email_error', userPreferredLanguage, { errorMessage: error.message }) });
      }
      console.log('Email sent successfully via Resend:', data);
      return corsResponse({ success: true, message: getTranslatedMessage('message_invitation_sent_successfully', userPreferredLanguage) });

    } catch (emailSendError: any) {
      console.error('Caught unexpected error during email sending:', emailSendError);
      return corsResponse({ success: false, message: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: emailSendError.message }) });
    }

  } catch (error: any) {
    console.error('Error in send-invitation-email Edge Function:', error);
    return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: error.message }) }, 500);
  }
});