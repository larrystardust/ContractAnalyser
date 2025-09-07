import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts'; // ADDED

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
    const { invited_email, role } = await req.json();
    console.log('invite-user: Received invitation request for email:', invited_email);
    console.log('invite-user: DEBUG - Received invited_email from request body:', invited_email);


    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('invite-user: Authorization header missing.');
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('invite-user: Unauthorized - Invalid or missing user token:', userError?.message);
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    const invitingUserId = user.id;
    const invitingUserEmail = user.email;
    console.log('invite-user: Inviting user ID:', invitingUserId);
    console.log('invite-user: Inviting user email:', invitingUserEmail);

    // RE-INTRODUCED: Self-invitation check to prevent overwriting owner's record
    if (invitingUserEmail && invited_email.toLowerCase() === invitingUserEmail.toLowerCase()) {
      console.warn('invite-user: Attempted self-invitation. This is not allowed as it would overwrite the owner\'s membership record.');
      return corsResponse({ error: 'You cannot invite yourself to your own subscription. Your account is already associated as the owner.' }, 400);
    }

    // 1. Get the inviting user's active subscription and their role
    const { data: inviterMembership, error: inviterError } = await supabase
      .from('subscription_memberships')
      .select('subscription_id, role, status')
      .eq('user_id', invitingUserId)
      .eq('status', 'active')
      .maybeSingle();

    if (inviterError || !inviterMembership || inviterMembership.role !== 'owner') {
      console.error('invite-user: Inviter not authorized or not owner:', inviterError?.message || 'Not owner');
      return corsResponse({ error: 'Only active subscription owners can invite users.' }, 403);
    }

    const subscriptionId = inviterMembership.subscription_id;
    console.log('invite-user: Inviter subscription ID:', subscriptionId);

    // 2. Get the max_users for this subscription
    const { data: subscriptionDetails, error: subDetailsError } = await supabase
      .from('stripe_subscriptions')
      .select('max_users')
      .eq('subscription_id', subscriptionId)
      .maybeSingle();

    if (subDetailsError || !subscriptionDetails) {
      console.error('invite-user: Could not retrieve subscription details:', subDetailsError?.message);
      return corsResponse({ error: 'Could not retrieve subscription details.' }, 500);
    }

    const maxUsers = subscriptionDetails.max_users;
    console.log('invite-user: Max users for subscription:', maxUsers);

    // 3. Find the invited user's ID (if they already exist in auth.users)
    // NEW LOG: Log the result of listUsers
    const { data: { users: existingAuthUsers }, error: listUsersError } = await supabase.auth.admin.listUsers({
      email: invited_email,
      page: 1,
      perPage: 1
    });
    console.log('invite-user: DEBUG - Result of supabase.auth.admin.listUsers for invited_email:', existingAuthUsers);


    let invitedUserId = null;
    // Only set invitedUserId if a user is found AND their email matches the invited_email
    // This guards against cases where listUsers might return a user with a different email (e.g., due to internal Supabase issues or aliases)
    if (existingAuthUsers && existingAuthUsers.length > 0 && existingAuthUsers[0].email?.toLowerCase() === invited_email.toLowerCase()) {
      invitedUserId = existingAuthUsers[0].id;
    }
    console.log('invite-user: Existing invited user ID (from auth.users):', invitedUserId);
    // NEW LOG: Confirm the final invitedUserId value
    console.log('invite-user: DEBUG - Final invitedUserId determined:', invitedUserId);


    if (listUsersError) {
      console.error('invite-user: Error fetching invited user by email from auth.users:', listUsersError);
      return corsResponse({ error: 'Error checking invited user existence.' }, 500);
    }

    let finalMessage = 'Invitation sent successfully!';
    let membershipRecordId: string;

    // Check if the invited email corresponds to an existing user
    if (invitedUserId) {
      console.log('invite-user: Invited email belongs to an existing user. Checking their membership status...');
      const { data: existingMembership, error: existingMembershipError } = await supabase
        .from('subscription_memberships')
        .select('*')
        .eq('user_id', invitedUserId)
        .eq('subscription_id', subscriptionId)
        .maybeSingle();

      if (existingMembershipError) {
        console.error('invite-user: Error checking existing membership for invited user:', existingMembershipError);
        return corsResponse({ error: 'Failed to check invited user\'s membership status.' }, 500);
      }

      if (existingMembership && existingMembership.status === 'active') {
        // User is already an active member of this specific subscription.
        // Return success without re-inviting or sending redundant email.
        console.log('invite-user: Invited user is already an active member of this subscription. No action needed.');
        return corsResponse({ message: 'This user is already an active member of your subscription.' });
      }

      // User exists but is not an active member of this specific subscription (or has a different status).
      // Proceed to check limits and upsert/insert their membership for this subscription.
      console.log('invite-user: User exists but is not an active member of this subscription. Checking limits and upserting...');
      const { count: currentMembersCount, error: countError } = await supabase
        .from('subscription_memberships')
        .select('id', { count: 'exact' })
        .eq('subscription_id', subscriptionId)
        .in('status', ['active', 'invited']);

      if (countError) {
        console.error('invite-user: Could not count current members for limit check:', countError);
        return corsResponse({ error: 'Could not count current members.' }, 500);
      }
      console.log('invite-user: Current members count:', currentMembersCount);

      if (maxUsers !== 999999 && currentMembersCount && currentMembersCount >= maxUsers) {
        console.warn('invite-user: Subscription limit reached. Max users:', maxUsers);
        return corsResponse({ error: `Subscription limit reached. Max users: ${maxUsers}` }, 403);
      }

      // Upsert the membership record for the existing user
      const { data: upsertedMembership, error: upsertMembershipError } = await supabase
        .from('subscription_memberships')
        .upsert({
          subscription_id: subscriptionId,
          user_id: invitedUserId, // Link to the existing user's ID
          role: role || 'member',
          status: 'invited', // Set status to invited, they still need to accept
          invited_by: invitingUserId,
          invited_email_address: invited_email, // Store invited email for existing users too, for consistency
        }, { onConflict: ['subscription_id', 'user_id'] }) // Update if a record for this user/subscription already exists
        .select()
        .single();

      if (upsertMembershipError) {
        console.error('invite-user: Error upserting membership for existing user:', upsertMembershipError);
        return corsResponse({ error: 'Failed to create invitation for existing user.' }, 500);
      }
      console.log('invite-user: Upserted membership for existing user:', upsertedMembership.id);
      membershipRecordId = upsertedMembership.id;
    } else {
      // User does NOT exist in auth.users (invitedUserId is null). This is the "pre-registration" case.
      console.log('invite-user: Invited user does NOT exist in auth.users. Proceeding to check limits and insert new membership with user_id: null...');
      const { count: currentMembersCount, error: countError } = await supabase
        .from('subscription_memberships')
        .select('id', { count: 'exact' })
        .eq('subscription_id', subscriptionId)
        .in('status', ['active', 'invited']);

      if (countError) {
        console.error('invite-user: Could not count current members for limit check (unregistered user path):', countError);
        return corsResponse({ error: 'Could not count current members.' }, 500);
      }
      console.log('invite-user: Current members count (unregistered user path):', currentMembersCount);

      if (maxUsers !== 999999 && currentMembersCount && currentMembersCount >= maxUsers) {
        console.warn('invite-user: Subscription limit reached for unregistered user. Max users:', maxUsers);
        return corsResponse({ error: `Subscription limit reached. Max users: ${maxUsers}` }, 403);
      }

      // Insert a new membership record with user_id as null and store invited_email_address
      console.log('invite-user: Attempting to insert new membership with user_id: null...');
      const { data: newMembership, error: insertMembershipError } = await supabase
        .from('subscription_memberships')
        .insert({
          subscription_id: subscriptionId,
          user_id: null, // User does not exist yet, so user_id is null
          role: role || 'member',
          status: 'invited',
          invited_by: invitingUserId,
          invited_email_address: invited_email, // Store the invited email
        })
        .select()
        .single();

      if (insertMembershipError) {
        console.error('invite-user: Error inserting new membership for unregistered user:', insertMembershipError);
        return corsResponse({ error: 'Failed to create invitation for unregistered user.' }, 500);
      }
      console.log('invite-user: Successfully inserted new membership for unregistered user:', newMembership.id);
      membershipRecordId = newMembership.id;
    }

    // Generate invitation link using the determined membershipRecordId
    const invitationToken = membershipRecordId;
    const acceptInvitationUrl = `${Deno.env.get('APP_BASE_URL')}/accept-invitation?token=${invitationToken}`;
    console.log('invite-user: Generated invitation URL:', acceptInvitationUrl);

    // Invoke email sending function
    const { data: emailFnResponse, error: emailFnInvokeError } = await supabase.functions.invoke('send-invitation-email', {
      body: {
        recipientEmail: invited_email,
        invitationLink: acceptInvitationUrl,
        inviterName: user.email,
      },
    });

    // Check for email sending errors and modify finalMessage if needed
    if (emailFnInvokeError) {
      console.error('invite-user: Error invoking send-invitation-email Edge Function:', emailFnInvokeError);
      finalMessage = `Invitation sent, but there was an error sending the email: ${emailFnInvokeError.message}`;
    } else if (emailFnResponse && !emailFnResponse.success) {
      console.warn('invite-user: send-invitation-email Edge Function reported failure:', emailFnResponse.message);
      finalMessage = `Invitation sent, but the email could not be delivered: ${emailFnResponse.message}`;
    } else {
      console.log('invite-user: send-invitation-email Edge Function invoked successfully.');
    }

    // ADDED: Log activity
    await logActivity(
      supabase,
      invitingUserId,
      'SUBSCRIPTION_INVITATION_SENT',
      `User ${invitingUserEmail} sent invitation to ${invited_email} for subscription ${subscriptionId}.`,
      { invited_email: invited_email, subscription_id: subscriptionId, membership_id: membershipRecordId }
    );

    return corsResponse({ message: finalMessage, invitation_link: acceptInvitationUrl });

  } catch (error: any) {
    console.error(`invite-user: Unhandled error in Edge Function: ${error.message}`, error);
    return corsResponse({ error: error.message }, 500);
  }
});