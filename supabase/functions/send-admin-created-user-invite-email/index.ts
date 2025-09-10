import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { Resend } from 'npm:resend@6.0.1';

// Initialize Supabase client with service role key for any potential DB interactions
// (though not strictly needed for this function's current purpose of sending email)
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
    const { recipientEmail, recipientName, initialPassword } = await req.json();

    console.log('send-admin-created-user-invite-email: Received request for recipient:', recipientEmail);

    if (!recipientEmail || !initialPassword) {
      console.error('send-admin-created-user-invite-email: Missing required email parameters: recipientEmail, initialPassword');
      return corsResponse({ error: 'Missing required email parameters: recipientEmail, initialPassword' }, 400);
    }

    // --- REMOVED AUTHENTICATION AND AUTHORIZATION CHECKS ---
    // This function is called by another authenticated Edge Function (admin-create-user)
    // and does not need to re-authenticate the caller or check admin privileges.
    // The token passed is the service_role key, which is not a user JWT.
    // --- END REMOVED CHECKS ---

    console.log(`send-admin-created-user-invite-email: Attempting to send email to ${recipientEmail}.`);

    try {
      const { data, error } = await resend.emails.send({
        from: 'ContractAnalyser <noreply@mail.contractanalyser.com>', // Replace with your verified sender email
        to: [recipientEmail],
        subject: `Welcome to ContractAnalyser! Your Account Details`,
        html: `
          <p>Hello ${recipientName || 'there'},</p>
          <p>An administrator has created an account for you on ContractAnalyser.</p>
          <p>You can log in using the following details:</p>
          <p><strong>Email:</strong> ${recipientEmail}</p>
          <p><strong>Password:</strong> ${initialPassword}</p>
          <p style="color: red; font-weight: bold;">
            For security reasons, we strongly recommend that you change this password immediately after your first login.
          </p>
          <p>To change your password, please visit the login page and use the "Forgot password?" link.</p>
          <p>If you have any questions, please contact your administrator.</p>
          <p>Thank you for using ContractAnalyser.</p>
          <p>The ContractAnalyser Team</p>
        `,
      });

      if (error) {
        console.error('send-admin-created-user-invite-email: Error sending email via Resend:', error);
        return corsResponse({ success: false, message: `Failed to send invitation email: ${error.message}` });
      }
      console.log('send-admin-created-user-invite-email: Email sent successfully via Resend:', data);
      return corsResponse({ success: true, message: 'Invitation email sent successfully.' });

    } catch (emailSendError: any) {
      console.error('send-admin-created-user-invite-email: Caught unexpected error during email sending:', emailSendError);
      return corsResponse({ success: false, message: `An unexpected error occurred during email sending: ${emailSendError.message}` });
    }

  } catch (error: any) {
    console.error('send-admin-created-user-invite-email: Unhandled error in Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});