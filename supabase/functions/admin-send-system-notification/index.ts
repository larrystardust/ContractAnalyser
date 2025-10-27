import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts'; // ADDED

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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
    const { title, message } = await req.json();

    if (!title || !message) {
      return corsResponse({ error: 'Notification title and message are required.' }, 400);
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

    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminProfileError || !adminProfile?.is_admin) {
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }

    // Fetch all user IDs, emails, full names, and notification settings from the profiles table
    const { data: usersData, error: fetchUsersError } = await supabase
      .from('profiles')
      .select('id, full_name, email, language_preference, notification_settings'); // MODIFIED: Select email, full_name, language_preference, notification_settings

    if (fetchUsersError) {
      console.error('Error fetching user IDs for system notification:', fetchUsersError);
      return corsResponse({ error: 'Failed to fetch user list for notification.' }, 500);
    }

    const notificationsToInsert = [];
    for (const userData of usersData) {
      const userId = userData.id;
      const userEmail = userData.email;
      const userName = userData.full_name || userEmail;
      const userPreferredLanguage = userData.language_preference || 'en';
      const notificationSettings = userData.notification_settings as Record<string, { email: boolean; inApp: boolean }> || {};

      // Always insert in-app notification
      notificationsToInsert.push({
        user_id: userId,
        title: title,
        message: message,
        type: 'info',
      });

      // Check if email notification for system updates is enabled
      const systemUpdatesEmailEnabled = notificationSettings['system-updates']?.email;

      if (systemUpdatesEmailEnabled && userEmail) {
        const emailSubject = getTranslatedMessage('email_subject_system_update', userPreferredLanguage, { title: title });
        const emailHtmlBody = `
          <p>${getTranslatedMessage('email_hello', userPreferredLanguage, { recipientName: userName })}</p>
          <p>${getTranslatedMessage('email_system_update_body_p1', userPreferredLanguage, { title: title })}</p>
          <p>${message}</p>
          <p>${getTranslatedMessage('email_system_update_body_p2', userPreferredLanguage)}</p>
          <p>${getTranslatedMessage('email_team', userPreferredLanguage)}</p>
        `;

        await supabase.functions.invoke('send-generic-notification-email', {
          body: {
            recipientEmail: userEmail,
            recipientName: userName,
            subject: emailSubject,
            htmlBody: emailHtmlBody,
            userPreferredLanguage: userPreferredLanguage,
          },
        });
        console.log(`admin-send-system-notification: Sent email system update to user ${userId}.`);
      }
    }

    // Insert all in-app notifications
    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabase.from('notifications').insert(notificationsToInsert);

      if (insertError) {
        console.error('Error inserting system notifications:', insertError);
        return corsResponse({ error: 'Failed to send system notifications.' }, 500);
      }
    }

    // Log the admin action
    await logActivity(
      supabase,
      user.id,
      'ADMIN_SYSTEM_NOTIFICATION_SENT',
      `Admin ${user.email} sent a system notification: "${title}"`,
      { notification_title: title, notification_message: message, recipient_count: usersData.length }
    );

    return corsResponse({ message: 'System notification sent successfully to all users.' });

  } catch (error: any) {
    console.error('Error in admin-send-system-notification Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});