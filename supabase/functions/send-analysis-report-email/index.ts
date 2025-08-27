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
    const { userId, contractId, recipientEmail, reportSummary, reportLink, userName, sendEmail } = await req.json(); // MODIFIED: Added sendEmail

    if (!userId || !contractId || !recipientEmail || !reportSummary || !reportLink || typeof sendEmail !== 'boolean') { // MODIFIED: Added sendEmail check
      return corsResponse({ error: 'Missing required email parameters' }, 400);
    }

    if (!sendEmail) { // ADDED: Check if email sending is explicitly disabled
      console.log(`Email sending for contract ${contractId} skipped due to user preference.`);
      return corsResponse({ message: 'Email sending skipped due to user preference' });
    }

    console.log(`Attempting to send analysis report email to ${recipientEmail} for contract ${contractId}`);

    // --- START: Email Service Integration ---
    try {
      const { data, error } = await resend.emails.send({
        from: 'ContractAnalyser <noreply@mail.contractanalyser.com>', // IMPORTANT: Replace with your verified sender email in Resend
        to: [recipientEmail],
        subject: `Your Contract Analysis Report for ${contractId} is Ready!`,
        html: `
          <p>Hello ${userName || 'User'},</p>
          <p>Your legal contract analysis for <strong>${contractId}</strong> is complete!</p>
          <p><strong>Executive Summary:</strong></p>
          <p>${reportSummary}</p>
          <p>You can view the full report and detailed findings here:</p>
          <p><a href="${reportLink}">View Full Report</a></p>
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