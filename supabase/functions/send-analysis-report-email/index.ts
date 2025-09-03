import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { Resend } from 'npm:resend@6.0.1'; // Import Resend

// Initialize Supabase client with service role key for elevated privileges
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const resend = new Resend(Deno.env.get('RESEND_API_KEY')); // Initialize Resend

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
    // MODIFIED: Accept reportHtmlContent and reportLink
    const { recipientEmail, subject, message, recipientName, reportHtmlContent, reportLink } = await req.json();

    if (!recipientEmail || !subject || !message || !reportHtmlContent || !reportLink) {
      return corsResponse({ error: 'Missing required email parameters: recipientEmail, subject, message, reportHtmlContent, reportLink' }, 400);
    }

    // Authenticate the request to ensure it's coming from an authorized source
    // This function is now called internally by trigger-report-email, which handles auth.
    // We still keep this check for robustness if it were ever called directly.
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

    // --- START: Email Service Integration ---
    try {
      const { data, error } = await resend.emails.send({
        from: 'ContractAnalyser <noreply@mail.contractanalyser.com>', // IMPORTANT: Replace with your verified sender email in Resend
        to: [recipientEmail],
        subject: subject, // Use the subject passed from trigger-report-email
        html: `
          <p>Hello ${recipientName || 'User'},</p>
          <p>Your legal contract analysis is complete!</p>
          <p><strong>Executive Summary:</strong></p>
          <p>${message}</p>
          <p>You can view the full report and detailed findings directly below, or click the link to view it in your browser:</p>
          <p><a href="${reportLink}">View Full Report in Browser</a></p>
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
      throw emailSendError; // Re-throw to indicate failure in email sending
    }
    // --- END: Email Service Integration ---

    return corsResponse({ message: 'Email sending process initiated successfully' });

  } catch (error: any) {
    console.error('Error in send-analysis-report-email Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});