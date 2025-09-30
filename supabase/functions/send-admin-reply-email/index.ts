import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { Resend } from 'npm:resend@6.0.1'; // Corrected Resend version to 6.0.1
import { logActivity } from '../_shared/logActivity.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const resend = new Resend(Deno.env.get('RESEND_API_KEY')); // Initialize Resend

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
    const { recipientEmail, subject, message, recipientName, adminName, replyType, entityId } = await req.json();

    if (!recipientEmail || !subject || !message || !replyType || !entityId) {
      return corsResponse({ error: getTranslatedMessage('message_missing_required_fields', 'en') }, 400);
    }

    // Authenticate the request to ensure it's coming from an authorized source (e.g., an admin user)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: getTranslatedMessage('message_unauthorized', 'en') }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: getTranslatedMessage('message_unauthorized', 'en') }, 401);
    }

    // Verify if the user is an admin (assuming 'is_admin' column in 'profiles' table)
    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (adminProfileError || !adminProfile?.is_admin) {
      return corsResponse({ error: getTranslatedMessage('message_forbidden', 'en') }, 403);
    }

    // ADDED: Fetch recipient's preferred language
    let recipientPreferredLanguage = 'en'; // Default to English
    const { data: authUser, error: authUserError } = await supabase.auth.admin.listUsers({ email: recipientEmail, page: 1, perPage: 1 });
    let recipientUserId = null;
    if (!authUserError && authUser.users.length > 0) {
      recipientUserId = authUser.users[0].id;
    }

    if (recipientUserId) {
      const { data: recipientProfileData, error: recipientProfileError } = await supabase
        .from('profiles')
        .select('language_preference')
        .eq('id', recipientUserId)
        .maybeSingle();

      if (recipientProfileError) {
        console.warn('Error fetching recipient profile for language:', recipientProfileError);
      } else if (recipientProfileData?.language_preference) {
        recipientPreferredLanguage = recipientProfileData.language_preference;
      }
    }
    // END ADDED

    console.log(`Attempting to send admin reply email to ${recipientEmail} from ${adminName || user.email}.`);

    // --- START: Email Service Integration (Resend Example) ---
    try {
      const { data, error } = await resend.emails.send({
        from: 'ContractAnalyser <noreply@mail.contractanalyser.com>', // Replace with your verified sender email
        to: [recipientEmail],
        subject: getTranslatedMessage('email_admin_reply_subject', recipientPreferredLanguage, { subject: subject }),
        html: `
          <p>${getTranslatedMessage('email_admin_reply_body_p1', recipientPreferredLanguage, { recipientName: recipientName || recipientEmail })}</p>
          <p>${getTranslatedMessage('email_admin_reply_body_p2', recipientPreferredLanguage)}</p>
          <hr/>
          <p>${getTranslatedMessage('email_admin_reply_body_p3', recipientPreferredLanguage, { message: message })}</p>
          <hr/>
          <p>${getTranslatedMessage('email_admin_reply_body_p4', recipientPreferredLanguage, { adminName: adminName || 'The Support Team' })}</p>
          <p>${getTranslatedMessage('email_invitation_body_p5', recipientPreferredLanguage)}</p>
        `,
      });

      if (error) {
        console.error('Error sending email via Resend:', error);
        // Do not throw error here, allow database insertion to proceed
      } else {
        console.log('Email sent successfully via Resend:', data);
      }
    } catch (emailSendError: any) {
      console.error('Caught error during email sending:', emailSendError);
      // Continue processing to save the reply in the database
    }
    // --- END: Email Service Integration ---

    // Store the reply in the database
    let insertError;
    if (replyType === 'inquiry') {
      const { error } = await supabase.from('inquiry_replies').insert({
        inquiry_id: entityId,
        admin_user_id: user.id,
        reply_message: message,
      });
      insertError = error;

      // ADDED: Log activity
      await logActivity(
        supabase,
        user.id,
        'ADMIN_REPLIED_TO_INQUIRY',
        `Admin ${adminName || user.email} replied to inquiry ID: ${entityId} (Recipient: ${recipientEmail})`,
        { inquiry_id: entityId, recipient_email: recipientEmail }
      );

    } else if (replyType === 'support_ticket') {
      const { error } = await supabase.from('support_ticket_replies').insert({
        ticket_id: entityId,
        admin_user_id: user.id,
        reply_message: message,
      });
      insertError = error;

      // ADDED: Log activity
      await logActivity(
        supabase,
        user.id,
        'ADMIN_REPLIED_TO_SUPPORT_TICKET',
        `Admin ${adminName || user.email} replied to support ticket ID: ${entityId} (Recipient: ${recipientEmail})`,
        { ticket_id: entityId, recipient_email: recipientEmail }
      );
    }

    if (insertError) {
      console.error('Error inserting reply into database:', insertError);
      return corsResponse({ error: getTranslatedMessage('message_server_error', recipientPreferredLanguage, { errorMessage: 'Failed to save reply in database.' }) }, 500);
    }

    return corsResponse({ message: getTranslatedMessage('message_invitation_sent_successfully', recipientPreferredLanguage) });

  } catch (error: any) {
    console.error('Error in send-admin-reply-email Edge Function:', error);
    return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: error.message }) }, 500);
  }
});