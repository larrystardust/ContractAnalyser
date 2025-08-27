import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { Resend } from 'npm:resend@6.0.1'; // Corrected Resend version to 6.0.1

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
    const { recipientEmail, subject, message, recipientName, adminName, replyType, entityId } = await req.json();

    if (!recipientEmail || !subject || !message || !replyType || !entityId) {
      return corsResponse({ error: 'Missing required parameters: recipientEmail, subject, message, replyType, entityId' }, 400);
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

    console.log(`Attempting to send admin reply email to ${recipientEmail} from ${adminName || user.email}.`);

    // --- START: Email Service Integration (Resend Example) ---
    try {
      const { data, error } = await resend.emails.send({
        from: 'ContractAnalyser <noreply@mail.contractanalyser.com>', // Replace with your verified sender email
        to: [recipientEmail],
        subject: `Re: ${subject}`,
        html: `
          <p>Hello ${recipientName || 'there'},</p>
          <p>Thank you for contacting us. Here is a reply from our support team:</p>
          <hr/>
          <p>${message}</p>
          <hr/>
          <p>Best regards,</p>
          <p>${adminName || 'The Support Team'}</p>
          <p>ContractAnalyser</p>
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
    } else if (replyType === 'support_ticket') {
      const { error } = await supabase.from('support_ticket_replies').insert({
        ticket_id: entityId,
        admin_user_id: user.id,
        reply_message: message,
      });
      insertError = error;
    }

    if (insertError) {
      console.error('Error inserting reply into database:', insertError);
      return corsResponse({ error: 'Failed to save reply in database.' }, 500);
    }

    return corsResponse({ message: 'Admin reply sent and saved successfully!' });

  } catch (error: any) {
    console.error('Error in send-admin-reply-email Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});