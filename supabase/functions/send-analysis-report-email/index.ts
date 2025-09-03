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
    const { recipientEmail, subject, message, recipientName, reportHtmlContent, reportLink } = await req.json();

    if (!recipientEmail || !subject || !message || !reportHtmlContent || !reportLink) {
      return corsResponse({ error: 'Missing required email parameters: recipientEmail, subject, message, reportHtmlContent, reportLink' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    console.log(`Attempting to send analysis report email to ${recipientEmail}.`);

    // Construct the URL for the new public report viewer page
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || req.headers.get('Origin');
    const publicReportViewerUrl = `${appBaseUrl}/public-report-view?url=${encodeURIComponent(reportLink)}`; // MODIFIED: Link to new public page

    // --- START: Email Service Integration ---
    try {
      const { data, error } = await resend.emails.send({
        from: 'ContractAnalyser <noreply@mail.contractanalyser.com>',
        to: [recipientEmail],
        subject: subject,
        html: `
          <p>Hello ${recipientName || 'User'},</p>
          <p>Your legal contract analysis is complete!</p>
          <p><strong>Executive Summary:</strong></p>
          <p>${message}</p>
          <p>You can view the full report and detailed findings directly below, or click the link to view it in your browser:</p>
          <p><a href="${publicReportViewerUrl}">View Full Report in Browser</a></p> <!-- MODIFIED: Use the new public viewer URL -->
          <hr/>
          ${reportHtmlContent}
          <hr/>
          <p>Thank you for using ContractAnalyser.</p>
          <p>The ContractAnalyser Team</p>
        `,
      });

      if (error) {
        console.error('Error sending email via Resend:', error);
        throw new Error(`Failed to send email: ${error.message}`);
      }
      console.log('Email sent successfully via Resend:', data);
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