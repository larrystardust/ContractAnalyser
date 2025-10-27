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
    const { recipientEmail, recipientName, weeklyReportSummary, userPreferredLanguage } = await req.json();

    if (!recipientEmail || !weeklyReportSummary || !userPreferredLanguage) {
      return corsResponse({ error: getTranslatedMessage('message_missing_required_fields', userPreferredLanguage) }, 400);
    }

    // No direct user authentication needed here, as it's invoked internally by schedule-alerts.

    const subject = getTranslatedMessage('email_subject_weekly_report', userPreferredLanguage);
    const htmlBody = `
      <p>${getTranslatedMessage('email_hello', userPreferredLanguage, { recipientName: recipientName || recipientEmail })}</p>
      <p>${getTranslatedMessage('email_weekly_report_body_p1', userPreferredLanguage)}</p>
      <p>${weeklyReportSummary}</p>
      <p>${getTranslatedMessage('email_weekly_report_body_p2', userPreferredLanguage)}</p>
      <p>${getTranslatedMessage('email_team', userPreferredLanguage)}</p>
    `;

    try {
      const { data, error } = await resend.emails.send({
        from: 'ContractAnalyser <noreply@mail.contractanalyser.com>', // Replace with your verified sender email
        to: [recipientEmail],
        subject: subject,
        html: htmlBody,
      });

      if (error) {
        console.error('Error sending weekly report email via Resend:', error);
        return corsResponse({ success: false, message: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: `Failed to send email: ${error.message}` }) });
      }
      return corsResponse({ success: true, message: getTranslatedMessage('message_email_sent_successfully', userPreferredLanguage) });

    } catch (emailSendError: any) {
      console.error('Caught unexpected error during weekly report email sending:', emailSendError);
      return corsResponse({ success: false, message: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: emailSendError.message }) });
    }

  } catch (error: any) {
    console.error('Error in send-weekly-report-email Edge Function:', error);
    return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: error.message }) }, 500);
  }
});