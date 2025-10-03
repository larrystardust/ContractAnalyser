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
    const { contractId } = await req.json();

    if (!contractId) {
      return corsResponse({ error: 'Missing contractId' }, 400);
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

    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (adminProfileError || !adminProfile?.is_admin) {
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }

    // Fetch contract details to get file_path and report_file_path
    const { data: contractData, error: fetchContractError } = await supabase
      .from('contracts')
      .select(`
        file_path,
        analysis_results (
          report_file_path
        )
      `)
      .eq('id', contractId)
      .maybeSingle();

    if (fetchContractError) {
      console.error('Error fetching contract for deletion:', fetchContractError);
      // Continue, but log the error.
    }

    const originalContractFilePath = contractData?.file_path;
    const reportFilePath = contractData?.analysis_results && contractData.analysis_results.length > 0
      ? contractData.analysis_results.report_file_path
      : null;

    // Delete original contract file from Supabase Storage
    if (originalContractFilePath) {
      const { error: storageError } = await supabase.storage
        .from('contracts')
        .remove([originalContractFilePath]);

      if (storageError) {
        console.error(`Error deleting original contract file ${originalContractFilePath} from storage:`, storageError);
      } else {
        // console.log(`Successfully deleted original contract file: ${originalContractFilePath}`); // REMOVED
      }
    }

    // Delete report file from Supabase Storage if it exists
    if (reportFilePath) {
      const { error: reportStorageError } = await supabase.storage
        .from('reports')
        .remove([reportFilePath]);

      if (reportStorageError) {
        console.error(`Error deleting report file ${reportFilePath} from storage:`, reportStorageError);
      } else {
        // console.log(`Successfully deleted report file: ${reportFilePath}`); // REMOVED
      }
    }

    // Delete the contract record from 'contracts' table
    // This should cascade delete analysis_results and findings due to foreign key constraints
    const { error: dbError } = await supabase
      .from('contracts')
      .delete()
      .eq('id', contractId);

    if (dbError) {
      console.error('Error deleting contract record from database:', dbError);
      return corsResponse({ error: 'Failed to delete contract record.' }, 500);
    }

    return corsResponse({ message: 'Contract and associated data deleted successfully' });

  } catch (error: any) {
    console.error('Error in admin-delete-contract Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});