import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

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
    const { invitation_token } = await req.json();
    console.log('accept-invitation: Received invitation_token:', invitation_token);

    if (!invitation_token) {
      console.error('accept-invitation: Invitation token missing.');
      return corsResponse({ error: 'Invitation token missing' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('accept-invitation: Authorization header missing.');
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('accept-invitation: Unauthorized: Invalid or missing user token:', userError?.message);
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    const invitedUserId = user.id;
    const invitedUserEmail = user.email;
    console.log('accept-invitation: Authenticated user ID:', invitedUserId, 'Email:', invitedUserEmail);

    // 1. Fetch the membership record using the invitation_token (which is the membership ID)
    const { data: membership, error: fetchError } = await supabase
      .from('subscription_memberships')
      .select('*, invited_by') // MODIFIED: Select invited_by
      .eq('id', invitation_token)
      .maybeSingle();

    if (fetchError) {
      console.error('accept-invitation: Error fetching membership record:', fetchError);
      return corsResponse({ error: 'Failed to fetch invitation record.' }, 500);
    }
    if (!membership) {
      console.error('accept-invitation: Membership record not found for token:', invitation_token);
      return corsResponse({ error: 'Invalid or expired invitation token.' }, 404);
    }
    console.log('accept-invitation: Fetched membership:', membership);

    // 2. Check if the invitation is for this user (if user_id is already set)
    // OR if user_id is null, check if the invited_email_address matches the current user's email
    if (membership.user_id && membership.user_id !== invitedUserId) {
      console.warn('accept-invitation: Invitation is not for this account. Expected user_id:', membership.user_id, 'Actual user_id:', invitedUserId);
      return corsResponse({ error: 'This invitation is not for your account.' }, 403);
    }

    if (!membership.user_id && membership.invited_email_address && invitedUserEmail && membership.invited_email_address.toLowerCase() !== invitedUserEmail.toLowerCase()) {
      console.warn('accept-invitation: Invitation email mismatch. Expected:', membership.invited_email_address, 'Actual:', invitedUserEmail);
      return corsResponse({ error: 'This invitation is for a different email address.' }, 403);
    }

    // 3. Check if the invitation is still pending
    if (membership.status !== 'invited') {
      console.warn('accept-invitation: Invitation status is not "invited". Current status:', membership.status);
      return corsResponse({ error: 'This invitation has already been accepted or is no longer valid.' }, 400);
    }

    // MODIFIED: Fetch inviting user's business_name
    let invitingUserBusinessName: string | null = null;
    if (membership.invited_by) {
      const { data: inviterProfile, error: inviterProfileError } = await supabase
        .from('profiles')
        .select('business_name')
        .eq('id', membership.invited_by)
        .maybeSingle();

      if (inviterProfileError) {
        console.error('accept-invitation: Error fetching inviting user profile:', inviterProfileError);
      } else {
        invitingUserBusinessName = inviterProfile?.business_name || null;
        console.log('accept-invitation: Inviting user business name:', invitingUserBusinessName);
      }
    }

    // 4. Update the membership status to 'active' and set user_id if it was null
    const { error: updateError } = await supabase
      .from('subscription_memberships')
      .update({
        user_id: invitedUserId,
        status: 'active',
        accepted_at: new Date().toISOString(),
        // invited_email_address is intentionally NOT set to null here
      })
      .eq('id', invitation_token);

    if (updateError) {
      console.error('accept-invitation: Error updating membership status:', updateError);
      return corsResponse({ error: 'Failed to accept invitation.' }, 500);
    }

    // MODIFIED: Update the invited user's profile with the inviting user's business_name
    if (invitingUserBusinessName !== null) {
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ business_name: invitingUserBusinessName })
        .eq('id', invitedUserId);

      if (updateProfileError) {
        console.error('accept-invitation: Error updating invited user profile with business name:', updateProfileError);
        // Do not return error, as the core invitation acceptance is successful
      } else {
        console.log('accept-invitation: Successfully updated invited user profile with business name.');
      }
    }

    console.log('accept-invitation: Invitation accepted successfully for membership ID:', invitation_token);
    return corsResponse({ message: 'Invitation accepted successfully!' });

  } catch (error: any) {
    console.error(`accept-invitation: Unhandled error in Edge Function: ${error.message}`, error);
    return corsResponse({ error: error.message }, 500);
  }
});