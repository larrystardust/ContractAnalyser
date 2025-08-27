import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// Initialize Supabase client with service role key for elevated privileges
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Helper for CORS responses (though not strictly needed for a scheduled function, good practice)
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

  console.log('Starting delete-old-files Edge Function...');

  try {
    // Calculate the date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    console.log(`Looking for single-use contracts created before: ${thirtyDaysAgoISO} or any contracts marked for deletion by admin.`);

    // 1. Query for contracts to be deleted
    // This query combines two conditions:
    // a) Single-use contracts older than 30 days (subscription_id is NULL)
    // b) Any contract explicitly marked for deletion by an admin (marked_for_deletion_by_admin is TRUE)
    const { data: contractsToDelete, error: fetchError } = await supabase
      .from('contracts')
      .select('id, file_path')
      .or(`and(created_at.lt.${thirtyDaysAgoISO},subscription_id.is.null),marked_for_deletion_by_admin.eq.true`);

    if (fetchError) {
      console.error('Error fetching contracts for deletion:', fetchError);
      return corsResponse({ error: 'Failed to fetch contracts for deletion' }, 500);
    }

    if (!contractsToDelete || contractsToDelete.length === 0) {
      console.log('No contracts found for automatic deletion or marked for admin deletion.');
      return corsResponse({ message: 'No contracts to delete.' });
    }

    console.log(`Found ${contractsToDelete.length} contracts to delete.`);

    const deletionResults = await Promise.all(contractsToDelete.map(async (contract) => {
      try {
        // 2. Delete file from Supabase Storage
        if (contract.file_path) {
          const { error: storageError } = await supabase.storage
            .from('contracts')
            .remove([contract.file_path]);

          if (storageError) {
            console.error(`Error deleting file ${contract.file_path} from storage:`, storageError);
            // Don't throw, try to delete the DB record anyway
          } else {
            console.log(`Successfully deleted file: ${contract.file_path}`);
          }
        }

        // 3. Delete contract record from 'contracts' table
        // This should cascade delete analysis_results and findings due to foreign key constraints
        const { error: dbError } = await supabase
          .from('contracts')
          .delete()
          .eq('id', contract.id);

        if (dbError) {
          console.error(`Error deleting contract record ${contract.id} from database:`, dbError);
          return { id: contract.id, status: 'failed', reason: dbError.message };
        } else {
          console.log(`Successfully deleted contract record: ${contract.id}`);
          return { id: contract.id, status: 'success' };
        }
      } catch (innerError: any) {
        console.error(`Unexpected error processing contract ${contract.id}:`, innerError);
        return { id: contract.id, status: 'failed', reason: innerError.message };
      }
    }));

    const successfulDeletions = deletionResults.filter(r => r.status === 'success').length;
    const failedDeletions = deletionResults.filter(r => r.status === 'failed').length;

    console.log(`Finished deleting old files. Successful: ${successfulDeletions}, Failed: ${failedDeletions}`);

    return corsResponse({
      message: `Deletion process completed. ${successfulDeletions} contracts deleted, ${failedDeletions} failed.`,
      results: deletionResults,
    });

  } catch (error: any) {
    console.error('Unhandled error in delete-old-files Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});