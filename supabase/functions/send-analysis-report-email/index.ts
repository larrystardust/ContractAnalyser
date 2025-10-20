import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { Resend } from 'npm:resend@6.0.1';
import { edgeTranslations, getTranslatedMessage } from '../_shared/edge_translations.ts'; // ADDED

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
    return corsResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { userId, recipientEmail, subject, message, recipientName, reportHtmlContent, reportLink, userPreferredLanguage } = await req.json(); // MODIFIED: Added userPreferredLanguage

    // The strict check is removed here as fallbacks are provided upstream in trigger-report-email
    if (!userId || !recipientEmail || !subject || !message || !userPreferredLanguage) {
      return corsResponse({ error: 'Missing essential email parameters: userId, recipientEmail, subject, message, userPreferredLanguage' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user || user.id !== userId) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token or mismatch.' }, 401);
    }

    // console.log(`Attempting to send analysis report email to ${recipientEmail}.`); // REMOVED

    // Construct the URL for the new public report viewer page
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || req.headers.get('Origin');
    // MODIFIED: Removed encodeURIComponent around reportLink
    const publicReportViewerUrl = `${appBaseUrl}/public-report-view?url=${reportLink}`;

    // --- START: Email Service Integration ---
    try {
      const { data, error } = await resend.emails.send({
        from: 'ContractAnalyser <noreply@mail.contractanalyser.com>',
        to: [recipientEmail],
        subject: subject,
        html: `
          <p>${getTranslatedMessage('email_hello', userPreferredLanguage, { recipientName: recipientName || recipientEmail })}</p>
          <p>${getTranslatedMessage('email_analysis_complete', userPreferredLanguage)}</p>
          <p><strong>${getTranslatedMessage('executive_summary', userPreferredLanguage)}</strong></p>
          <p>${message}</p>
          ${reportLink && reportLink !== 'N/A' ? `
            <p>${getTranslatedMessage('email_view_full_report', userPreferredLanguage)}</p>
            <p><a href="${publicReportViewerUrl}">${getTranslatedMessage('email_view_full_report_button', userPreferredLanguage)}</a></p>
            <hr/>
            ${reportHtmlContent}
            <hr/>
          ` : `
            <p>${getTranslatedMessage('email_report_not_available', userPreferredLanguage)}</p>
          `}
          <p>${getTranslatedMessage('email_thank_you', userPreferredLanguage)}</p>
          <p>${getTranslatedMessage('email_team', userPreferredLanguage)}</p>
        `,
      });

      if (error) {
        console.error('Error sending email via Resend:', error);
        throw new Error(`Failed to send email: ${error.message}`);
      }
      // console.log('Email sent successfully via Resend:', data); // REMOVED
    } catch (emailSendError: any) {
      console.error('Caught error during email sending:', emailSendError);
      throw emailSendError;
    }
    // --- END: Email Service Integration ---

    return corsResponse({ message: 'Email sending process initiated successfully' });

  } catch (error: any) {
    console.error('Error in send-analysis-report-email Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});