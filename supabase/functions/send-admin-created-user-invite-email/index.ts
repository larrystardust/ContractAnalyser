import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { Resend } from 'npm:resend@6.0.1';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';

// Initialize Supabase client with service role key for any potential DB interactions
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
    const { recipientEmail, recipientName, initialPassword, userPreferredLanguage } = await req.json(); // ADDED userPreferredLanguage

    console.log('send-admin-created-user-invite-email: Received request for recipient:', recipientEmail);

    if (!recipientEmail || !initialPassword || !userPreferredLanguage) { // ADDED userPreferredLanguage to check
      console.error('send-admin-created-user-invite-email: Missing required email parameters: recipientEmail, initialPassword, userPreferredLanguage');
      return corsResponse({ error: getTranslatedMessage('message_missing_required_fields', 'en') }, 400);
    }

    // REMOVED: Logic to fetch recipient's preferred language, as it's now passed from admin-create-user

    console.log(`send-admin-created-user-invite-email: Attempting to send email to ${recipientEmail} in language ${userPreferredLanguage}.`);

    // Get APP_BASE_URL from environment variables
    const appBaseUrl = Deno.env.get('APP_BASE_URL');
    const loginPageUrl = `${appBaseUrl}/login`; // Construct the login page URL

    try {
      const { data, error } = await resend.emails.send({
        from: 'ContractAnalyser <noreply@mail.contractanalyser.com>', // Replace with your verified sender email
        to: [recipientEmail],
        subject: getTranslatedMessage('email_admin_created_user_subject', userPreferredLanguage),
        html: `
          <p>${getTranslatedMessage('email_admin_created_user_body_p1', userPreferredLanguage, { recipientName: recipientName || recipientEmail })}</p>
          <p>${getTranslatedMessage('email_admin_created_user_body_p2', userPreferredLanguage)}</p>
          <p>${getTranslatedMessage('email_admin_created_user_body_p3', userPreferredLanguage)}</p>
          <p>${getTranslatedMessage('email_admin_created_user_body_p4', userPreferredLanguage, { recipientEmail: recipientEmail })}</p>
          <p>${getTranslatedMessage('email_admin_created_user_body_p5', userPreferredLanguage, { initialPassword: initialPassword })}</p>
          <p style="color: red; font-weight: bold;">
            ${getTranslatedMessage('email_admin_created_user_body_p6', userPreferredLanguage)}
          </p>
          <p>To login and change your password, please visit <a href="${loginPageUrl}">the login page</a> and go to "Settings" and then "Security" and enter a new password.</p>
          <p>If you have any questions, please contact support on our "Help" page.</p>
          <p>${getTranslatedMessage('email_thank_you', userPreferredLanguage)}</p>
          <p>${getTranslatedMessage('email_team', userPreferredLanguage)}</p>
        `,
      });

      if (error) {
        console.error('send-admin-created-user-invite-email: Error sending email via Resend:', error);
        return corsResponse({ success: false, message: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: `Failed to send invitation email: ${error.message}` }) });
      }
      console.log('send-admin-created-user-invite-email: Email sent successfully via Resend:', data);
      return corsResponse({ success: true, message: getTranslatedMessage('message_invitation_sent_successfully', userPreferredLanguage) });

    } catch (emailSendError: any) {
      console.error('send-admin-created-user-invite-email: Caught unexpected error during email sending:', emailSendError);
      return corsResponse({ success: false, message: getTranslatedMessage('message_server_error', 'en', { errorMessage: emailSendError.message }) });
    }

  } catch (error: any) {
    console.error('send-admin-created-user-invite-email: Unhandled error in Edge Function:', error);
    return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: error.message }) }, 500);
  }
});