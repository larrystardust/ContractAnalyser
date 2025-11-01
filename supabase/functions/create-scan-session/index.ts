import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';

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
    return corsResponse({ error: getTranslatedMessage('message_method_not_allowed', 'en') }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: getTranslatedMessage('message_unauthorized', 'en') }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: getTranslatedMessage('message_unauthorized', 'en') }, 401);
    }

    const userId = user.id;
    const userEmail = user.email;

    // Set session to expire in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const { data: sessionData, error: insertError } = await supabase
      .from('scan_sessions')
      .insert({
        user_id: userId,
        expires_at: expiresAt.toISOString(),
        status: 'active',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('create-scan-session: Error inserting scan session:', insertError);
      return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: 'Failed to create scan session.' }) }, 500);
    }

    await logActivity(
      supabase,
      userId,
      'SCAN_SESSION_CREATED',
      `User ${userEmail} created scan session: ${sessionData.id}`,
      { scan_session_id: sessionData.id }
    );

    return corsResponse({ scanSessionId: sessionData.id });

  } catch (error: any) {
    console.error('create-scan-session: Unhandled error:', error);
    return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: error.message }) }, 500);
  }
});