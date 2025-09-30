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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }

    // 1. Fetch all support tickets
    const { data: ticketsData, error: fetchTicketsError } = await supabase
      .from('support_tickets')
      .select('*') // Select all columns from support_tickets
      .order('created_at', { ascending: false });

    if (fetchTicketsError) {
      console.error('Error fetching support tickets:', fetchTicketsError);
      return corsResponse({ error: 'Failed to fetch support tickets' }, 500);
    }

    // 2. Extract unique user_ids from tickets
    const userIds = [...new Set(ticketsData.map(ticket => ticket.user_id))];

    // 3. Fetch profiles for these user_ids
    const { data: profilesData, error: fetchProfilesError } = await supabase
      .from('profiles')
      .select('id, full_name') // Select only necessary profile fields
      .in('id', userIds);

    if (fetchProfilesError) {
      console.error('Error fetching profiles:', fetchProfilesError);
      return corsResponse({ error: 'Failed to fetch associated profiles' }, 500);
    }

    const profilesMap = new Map(profilesData.map(p => [p.id, p]));

    // 4. Fetch auth.users data for these user_ids to get emails
    const { data: authUsersData, error: fetchAuthUsersError } = await supabase.auth.admin.listUsers();

    if (fetchAuthUsersError) {
      console.error('Error fetching auth users:', fetchAuthUsersError);
      return corsResponse({ error: 'Failed to fetch authentication users' }, 500);
    }

    const authUsersMap = new Map(authUsersData.users.map(u => [u.id, u]));

    // 5. Combine data
    const combinedTickets = ticketsData.map(ticket => {
      const profile = profilesMap.get(ticket.user_id);
      const authUser = authUsersMap.get(ticket.user_id);
      return {
        ...ticket,
        profiles: { // Nest the profile and email data under 'profiles' key as expected by frontend
          email: authUser?.email || null,
          full_name: profile?.full_name || null,
        }
      };
    });

    return corsResponse({ tickets: combinedTickets });

  } catch (error: any) {
    console.error('Error in admin-get-support-tickets Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});