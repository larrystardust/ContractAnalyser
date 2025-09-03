import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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
    const { contract_id } = await req.json();

    if (!contract_id) {
      return corsResponse({ error: 'Missing contract_id' }, 400);
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

    // Fetch the contract details, including contract_content
    const { data: contract, error: fetchContractError } = await supabase
      .from('contracts')
      .select('contract_content, user_id')
      .eq('id', contract_id)
      .single();

    if (fetchContractError) {
      console.error('Error fetching contract:', fetchContractError);
      return corsResponse({ error: 'Contract not found or failed to fetch content.' }, 404);
    }

    // Ensure the authenticated user owns this contract
    if (contract.user_id !== user.id) {
      return corsResponse({ error: 'Forbidden: You do not own this contract.' }, 403);
    }

    if (!contract.contract_content) {
      return corsResponse({ error: 'Contract content not found for re-analysis.' }, 404);
    }

    // Update contract status to 'analyzing' and reset progress
    const { error: updateStatusError } = await supabase
      .from('contracts')
      .update({ status: 'analyzing', processing_progress: 0 })
      .eq('id', contract_id);

    if (updateStatusError) {
      console.error('Error updating contract status for re-analysis:', updateStatusError);
      // Continue, but log the error
    }

    // Invoke the main contract-analyzer Edge Function
    const { data: analysisResponse, error: analysisError } = await supabase.functions.invoke('contract-analyzer', {
      body: {
        contract_id: contract_id,
        contract_text: contract.contract_content,
      },
      headers: {
        'Authorization': `Bearer ${token}`, // Pass the original user's token
      },
    });

    if (analysisError) {
      console.error('Error invoking contract-analyzer for re-analysis:', analysisError);
      return corsResponse({ error: `Failed to re-analyze contract: ${analysisError.message}` }, 500);
    }

    return corsResponse({ message: 'Re-analysis initiated successfully', analysis_response: analysisResponse });

  } catch (error: any) {
    console.error('Error in re-analyze-contract Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});