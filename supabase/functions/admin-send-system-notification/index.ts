import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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

    // Fetch all user IDs from the profiles table
    const { data: userIds, error: fetchUsersError } = await supabase
      .from('profiles')
      .select('id');

    if (fetchUsersError) {
      console.error('Error fetching user IDs for system notification:', fetchUsersError);
      return corsResponse({ error: 'Failed to fetch user list for notification.' }, 500);
    }

    const notificationsToInsert = userIds.map(profile => ({
      user_id: profile.id,
      title: title,
      message: message,
      type: 'info',
    }));

    // Insert notifications in batches if there are many users
    const { error: insertError } = await supabase.from('notifications').insert(notificationsToInsert);

    if (insertError) {
      console.error('Error inserting system notifications:', insertError);
      return corsResponse({ error: 'Failed to send system notifications.' }, 500);
    }

    // Log the admin action
    await logActivity(
      supabase,
      user.id,
      'ADMIN_SYSTEM_NOTIFICATION_SENT',
      `Admin ${user.email} sent a system notification: "${title}"`,
      { notification_title: title, notification_message: message, recipient_count: notificationsToInsert.length }
    );

    return corsResponse({ message: 'System notification sent successfully to all users.' });

  } catch (error: any) {
    console.error('Error in admin-send-system-notification Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});