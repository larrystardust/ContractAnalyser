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
    const { recipientEmail, recipientName, initialPassword } = await req.json(); // REMOVED: passwordResetLink

    if (!recipientEmail || !initialPassword) { // MODIFIED: Removed passwordResetLink from check
      return corsResponse({ error: 'Missing required email parameters: recipientEmail, initialPassword' }, 400);
    }

    // Authenticate the request to ensure it's coming from an authorized source (e.g., an admin user)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    // Verify if the user is an admin (assuming 'is_admin' column in 'profiles' table)
    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (adminProfileError || !adminProfile?.is_admin) {
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }

    console.log(`Attempting to send admin-created user invitation email to ${recipientEmail}.`);

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
    console.error('Error in send-admin-created-user-invite-email Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});