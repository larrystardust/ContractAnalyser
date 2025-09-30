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

    // Fetch audit logs, joining with auth.users and profiles for user details
    const { data: auditLogs, error: fetchError } = await supabase
      .from('audit_logs')
      .select(`
        id,
        event_type,
        description,
        metadata,
        created_at,
        user_id,
        users (
          email,
          profiles (full_name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100); // Limit to 100 for now, can add pagination later

    if (fetchError) {
      console.error('Error fetching audit logs:', fetchError);
      return corsResponse({ error: 'Failed to fetch audit logs.' }, 500);
    }

    // Format the data for easier consumption on the frontend
    const formattedLogs = auditLogs.map(log => ({
      id: log.id,
      event_type: log.event_type,
      description: log.description,
      metadata: log.metadata,
      created_at: log.created_at,
      user_id: log.user_id,
      user_email: log.users?.email || 'N/A',
      user_full_name: log.users?.profiles?.full_name || 'N/A',
    }));

    return corsResponse({ audit_logs: formattedLogs });

  } catch (error: any) {
    console.error('Error in admin-get-audit-logs Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});