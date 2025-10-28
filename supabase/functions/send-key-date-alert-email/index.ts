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
  if (req.method === 'OPTIONS') {
    return corsResponse(null, 204);
  }

  if (req.method !== 'POST') {
    return corsResponse({ error: getTranslatedMessage('message_method_not_allowed', 'en') }, 405);
  }

  try {
    const { recipientEmail, subject, message, userPreferredLanguage, alertType, contractName, days } = await req.json();

    if (!recipientEmail || !subject || !message || !userPreferredLanguage || !alertType || !contractName || days === undefined) {
      return corsResponse({ error: getTranslatedMessage('message_missing_required_fields', userPreferredLanguage) }, 400);
    }

    // Authenticate the request to ensure it's coming from an authorized source (e.g., a service role or another Edge Function)
    // For internal function calls, the Authorization header might be a service role key or a specific internal token.
    // For this scenario, we'll assume it's called internally by schedule-alerts, which is already authenticated.
    // No direct user authentication is needed here, but a check for a service role key or internal token could be added for robustness.

    let emailHtmlBody = '';
    if (alertType === 'renewal') {
      emailHtmlBody = `
        <p>${getTranslatedMessage('email_hello', userPreferredLanguage, { recipientName: recipientName })}</p>
        <p>${getTranslatedMessage('email_key_date_alert_body_p1', userPreferredLanguage)}</p>
        <p>${getTranslatedMessage('email_key_date_alert_body_renewal', userPreferredLanguage, { contractName: contractName, days: days })}</p>
        <p>${getTranslatedMessage('email_key_date_alert_body_p2', userPreferredLanguage)}</p>
        <p>${getTranslatedMessage('email_team', userPreferredLanguage)}</p>
      `;
    } else if (alertType === 'termination') {
      emailHtmlBody = `
        <p>${getTranslatedMessage('email_hello', userPreferredLanguage, { recipientName: recipientName })}</p>
        <p>${getTranslatedMessage('email_key_date_alert_body_p1', userPreferredLanguage)}</p>
        <p>${getTranslatedMessage('email_key_date_alert_body_termination', userPreferredLanguage, { contractName: contractName, days: days })}</p>
        <p>${getTranslatedMessage('email_key_date_alert_body_p2', userPreferredLanguage)}</p>
        <p>${getTranslatedMessage('email_team', userPreferredLanguage)}</p>
      `;
    } else {
      return corsResponse({ error: getTranslatedMessage('error_invalid_alert_type', userPreferredLanguage) }, 400);
    }

    try {
      const { data, error } = await resend.emails.send({
        from: 'ContractAnalyser <noreply@mail.contractanalyser.com>', // Replace with your verified sender email
        to: [recipientEmail],
        subject: subject,
        html: emailHtmlBody,
      });

      if (error) {
        console.error('Error sending email via Resend:', error);
        return corsResponse({ success: false, message: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: `Failed to send email: ${error.message}` }) });
      }
      return corsResponse({ success: true, message: getTranslatedMessage('message_email_sent_successfully', userPreferredLanguage) });

    } catch (emailSendError: any) {
      console.error('Caught unexpected error during email sending:', emailSendError);
      return corsResponse({ success: false, message: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: emailSendError.message }) });
    }

  } catch (error: any) {
    console.error('Error in send-key-date-alert-email Edge Function:', error);
    return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: error.message }) }, 500);
  }
});