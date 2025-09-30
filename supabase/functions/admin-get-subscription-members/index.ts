import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info', // Corrected header
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
    const { subscriptionId } = await req.json();

    if (!subscriptionId) {
      return corsResponse({ error: 'Missing subscriptionId' }, 400);
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

    // Check if the user is an admin OR the owner of the requested subscription
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle(); // Use maybeSingle as profile might not exist for new users

    if (profileError) {
      console.error('Error fetching user profile for authorization:', profileError);
      return corsResponse({ error: 'Failed to verify user permissions.' }, 500);
    }

    let isAuthorized = profile?.is_admin;

    if (!isAuthorized) {
      // If not an admin, check if they are the owner of this specific subscription
      const { data: ownerMembership, error: ownerMembershipError } = await supabase
        .from('subscription_memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('subscription_id', subscriptionId)
        .eq('status', 'active')
        .maybeSingle();

      if (ownerMembershipError) {
        console.error('Error fetching owner membership for authorization:', ownerMembershipError);
        return corsResponse({ error: 'Failed to verify user permissions.' }, 500);
      }

      isAuthorized = ownerMembership?.role === 'owner';
    }

    if (!isAuthorized) {
      return corsResponse({ error: 'Forbidden: User is not an administrator or the owner of this subscription.' }, 403);
    }

    // 1. Fetch all subscription memberships for the given subscriptionId
    const { data: membershipsData, error: membershipsError } = await supabase
      .from('subscription_memberships')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: true });

    if (membershipsError) {
      console.error('Error fetching subscription memberships:', membershipsError);
      return corsResponse({ error: 'Failed to fetch subscription memberships.' }, 500);
    }

    if (!membershipsData || membershipsData.length === 0) {
      return corsResponse({ members: [] });
    }

    // 2. Extract unique user IDs from memberships
    const userIds = [...new Set(membershipsData.map(m => m.user_id).filter(Boolean))]; // Filter out null user_ids

    // 3. Fetch profiles for these user_ids (for full_name)
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      // Continue without profiles if there's an error, but log it
    }
    const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);

    // 4. Fetch auth.users data for these user_ids (for email) using admin client
    // Note: admin.listUsers() fetches all users, then filter by userIds
    const { data: authUsersData, error: authUsersError } = await supabase.auth.admin.listUsers();

    if (authUsersError) {
      console.error('Error fetching auth users:', authUsersError);
      // Continue without emails if there's an error, but log it
    }
    const authUsersMap = new Map(authUsersData?.users.map(u => [u.id, u.email]) || []);

    // 5. Combine all data
    const combinedMembers = membershipsData.map(membership => {
      const email = authUsersMap.get(membership.user_id);
      const full_name = profilesMap.get(membership.user_id);
      return {
        ...membership,
        email: email || null,
        full_name: full_name || null,
      };
    });

    return corsResponse({ members: combinedMembers });

  } catch (error: any) {
    console.error('Error in admin-get-subscription-members Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});