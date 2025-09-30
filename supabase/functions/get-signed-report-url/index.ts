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
    const { contractId, reportFilePath } = await req.json();

    if (!contractId || !reportFilePath) {
      return corsResponse({ error: 'Missing contractId or reportFilePath' }, 400);
    }

    // Authenticate the user making the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    // Verify that the user owns the contract associated with this report
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('user_id')
      .eq('id', contractId)
      .single();

    if (contractError || contract.user_id !== user.id) {
      return corsResponse({ error: 'Forbidden: You do not have permission to access this report.' }, 403);
    }

    // Generate signed URL using the service role key (bypasses RLS)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('reports')
      .createSignedUrl(reportFilePath, 3600); // URL valid for 1 hour

    if (signedUrlError) {
      console.error('Error creating signed URL with service role:', signedUrlError);
      return corsResponse({ error: 'Failed to generate signed URL for report.' }, 500);
    }

    return corsResponse({ url: signedUrlData.signedUrl });

  } catch (error: any) {
    console.error('Error in get-signed-report-url Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});