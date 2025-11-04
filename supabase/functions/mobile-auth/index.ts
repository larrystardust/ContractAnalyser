import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import * as jose from 'npm:jose@5.2.3';
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
    console.log('mobile-auth: Edge Function invoked.'); // ADDED: Log to confirm invocation
    const { auth_token, redirect_to_url } = await req.json(); // MODIFIED: Receive redirect_to_url

    if (!auth_token || !redirect_to_url) { // MODIFIED: Check for redirect_to_url
      return corsResponse({ error: getTranslatedMessage('message_missing_auth_token_or_redirect_url', 'en') }, 400); // MODIFIED
    }

    const jwtSecret = new TextEncoder().encode(Deno.env.get('JWT_SECRET'));
    let payload;
    try {
      const { payload: verifiedPayload } = await jose.jwtVerify(auth_token, jwtSecret);
      payload = verifiedPayload;
    } catch (jwtError) {
      console.error('mobile-auth: JWT verification failed:', jwtError);
      return corsResponse({ error: getTranslatedMessage('message_invalid_or_expired_auth_token', 'en') }, 401);
    }

    const userId = payload.user_id as string;
    const scanSessionId = payload.scan_session_id as string;

    if (!userId || !scanSessionId) {
      return corsResponse({ error: getTranslatedMessage('message_invalid_token_payload', 'en') }, 400);
    }

    // Verify the scan session is still active and belongs to the user
    const { data: scanSession, error: fetchSessionError } = await supabase
      .from('scan_sessions')
      .select('id, user_id, expires_at, status')
      .eq('id', scanSessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchSessionError || !scanSession || scanSession.status !== 'active' || new Date(scanSession.expires_at) < new Date()) {
      console.error('mobile-auth: Scan session invalid or expired:', fetchSessionError?.message || 'Session not found/active/expired');
      return corsResponse({ error: getTranslatedMessage('message_scan_session_invalid_or_expired', 'en') }, 401);
    }

    // Get user email from admin client
    const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userId);
    if (getUserError || !userData?.user?.email) {
      console.error('mobile-auth: Failed to get user email:', getUserError);
      return corsResponse({ error: getTranslatedMessage('message_failed_to_get_user_email', 'en') }, 500);
    }
    const userEmail = userData.user.email;

    // MODIFIED: The redirectTo URL for Supabase is now simply the app's base URL.
    // All other context is handled client-side via localStorage and the App.tsx component.
    const { data: { properties }, error: generateLinkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      redirectTo: redirect_to_url, // This will be the app's base URL (e.g., https://contractanalyser.com/)
    });

    if (generateLinkError || !properties?.action_link) {
      console.error('mobile-auth: Failed to generate magic link:', generateLinkError);
      return corsResponse({ error: getTranslatedMessage('message_failed_to_generate_sign_in_token', 'en') }, 500);
    }

    // Return the action_link (magic link URL) to the mobile client
    const redirectToUrl = properties.action_link;

    return corsResponse({ redirectToUrl: redirectToUrl });

  } catch (error: any) {
    console.error('mobile-auth: Unhandled error:', error);
    return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: error.message }) }, 500);
  }
});