import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { GoogleAuth } from 'npm:google-auth-library@9.10.0';

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

  try {
    const GOOGLE_CLIENT_EMAIL = Deno.env.get('GOOGLE_CLIENT_EMAIL');
    const GOOGLE_PRIVATE_KEY = Deno.env.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n'); // Handle private key newlines

    if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      console.error("Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY environment variables.");
      return corsResponse({ error: "Missing Google Cloud credentials in environment variables." }, 500);
    }

    // ADDED: Log the environment variables to verify they are read correctly
    console.log("DEBUG: GOOGLE_CLIENT_EMAIL read:", GOOGLE_CLIENT_EMAIL);
    console.log("DEBUG: GOOGLE_PRIVATE_KEY (truncated) read:", GOOGLE_PRIVATE_KEY.substring(0, 50) + "...");
    console.log("DEBUG: GOOGLE_PRIVATE_KEY length:", GOOGLE_PRIVATE_KEY.length);
    // You can also check for the presence of newlines if you suspect an issue:
    console.log("DEBUG: GOOGLE_PRIVATE_KEY contains \\n:", GOOGLE_PRIVATE_KEY.includes('\n'));


    const auth = new GoogleAuth({
      credentials: {
        client_email: GOOGLE_CLIENT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY,
      },
      scopes: ['https://www.googleapis.com/auth/cloud-platform'], // Or 'https://www.googleapis.com/auth/cloud-vision'
    });

    let accessToken;
    try {
      accessToken = await auth.getAccessToken();
    } catch (authError: any) {
      console.error("ERROR: Failed to obtain access token from GoogleAuth library:", authError);
      console.error("ERROR DETAILS: Message:", authError.message);
      console.error("ERROR DETAILS: Stack:", authError.stack);
      return corsResponse({ error: `GoogleAuth.getAccessToken() failed: ${authError.message}` }, 500);
    }

    if (accessToken.token) {
      console.log("Successfully obtained Google Cloud access token in Edge Function!");
      console.log("Access Token (first 20 chars):", accessToken.token.substring(0, 20) + "...");
      console.log("Expires in:", accessToken.res?.data.expires_in, "seconds");
      return corsResponse({ message: "Google Cloud authentication successful!", accessToken: accessToken.token.substring(0, 20) + "...", expiresIn: accessToken.res?.data.expires_in });
    } else {
      console.error("Failed to obtain Google Cloud access token: Token is null or undefined.");
      // ADDED: Log the full accessToken object here
      console.error("DEBUG: Full accessToken object:", accessToken);
      return corsResponse({ error: "Failed to obtain Google Cloud access token." }, 500);
    }
  } catch (error: any) {
    console.error("Error during Google Cloud Auth test in Edge Function:", error);
    return corsResponse({ error: `Google Cloud Auth test failed: ${error.message}` }, 500);
  }
});