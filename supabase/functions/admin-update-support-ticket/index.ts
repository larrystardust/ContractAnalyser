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
    // Read the raw request body as text first
    const rawBody = await req.text();
    
    // Check if the body is empty
    if (!rawBody || rawBody.trim() === '') {
      return corsResponse({ error: 'Request body is empty' }, 400);
    }
    
    // Parse the JSON
    let requestData;
    try {
      requestData = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return corsResponse({ error: 'Invalid JSON in request body' }, 400);
    }
    
    const { ticket_id, status, priority } = requestData;

    if (!ticket_id || (!status && !priority)) {
      return corsResponse({ error: 'Missing ticket_id or update fields (status, priority)' }, 400);
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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }

    const updates: { status?: string; priority?: string; updated_at: string } = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (priority) updates.priority = priority;

    // Update the support ticket using the service role key to bypass RLS
    const { data: updatedTicket, error: updateError } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', ticket_id)
      .select()
      .single(); // .single() will return an error if no row is found or updated

    if (updateError) {
      console.error('Error updating support ticket:', updateError);
      // Check if the error is due to no rows being found (e.g., ticket_id not existing)
      if (updateError.code === 'PGRST116') { // Supabase error code for "no rows found"
        return corsResponse({ error: 'Support ticket not found or no changes were made.' }, 404);
      }
      return corsResponse({ error: `Failed to update support ticket: ${updateError.message}` }, 500);
    }

    return corsResponse({ message: 'Support ticket updated successfully', ticket: updatedTicket });

  } catch (error: any) {
    console.error('Error in admin-update-support-ticket Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});