import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';
import { insertNotification } from '../_shared/notification_utils.ts';

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
    const { userId, isVerified } = await req.json();

    if (!userId || typeof isVerified !== 'boolean') {
      return corsResponse({ error: 'Missing userId or isVerified status' }, 400);
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

    // Update the is_email_verified_by_admin flag in the profiles table
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ is_email_verified_by_admin: isVerified })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating is_email_verified_by_admin:', updateError);
      return corsResponse({ error: 'Failed to update user email verification status.' }, 500);
    }

    // Fetch target user's email for logging and notification
    const { data: targetUserAuth, error: targetUserAuthError } = await supabase.auth.admin.getUserById(userId);
    const targetUserEmail = targetUserAuth?.user?.email || 'Unknown';

    // Log activity
    await logActivity(
      supabase,
      user.id,
      isVerified ? 'ADMIN_EMAIL_VERIFIED' : 'ADMIN_EMAIL_UNVERIFIED',
      `Admin ${user.email} ${isVerified ? 'verified' : 'unverified'} email for user: ${targetUserEmail}`,
      { target_user_id: userId, target_user_email: targetUserEmail, is_verified: isVerified }
    );

    // Send notification to the user
    await insertNotification(
      userId,
      isVerified ? 'Email Verified!' : 'Email Unverified',
      isVerified ? 'Your email address has been verified by an administrator. You now have full access.' : 'Your email address has been unverified by an administrator. Please contact support.',
      isVerified ? 'success' : 'warning'
    );

    return corsResponse({ message: 'User email verification status updated successfully', profile: updatedProfile });

  } catch (error: any) {
    console.error('Error in admin-verify-user-email Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});