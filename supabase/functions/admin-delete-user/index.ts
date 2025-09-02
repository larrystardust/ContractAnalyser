import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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
    const { userId } = await req.json();

    if (!userId) {
      return corsResponse({ error: 'Missing userId' }, 400);
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

    // Prevent an admin from deleting themselves
    if (userId === user.id) {
      return corsResponse({ error: 'Admins cannot delete their own account.' }, 403);
    }

    // --- START: Delete associated files from storage ---
    // Fetch all contracts and their analysis results for the user being deleted
    const { data: contractsToDelete, error: fetchContractsError } = await supabase
      .from('contracts')
      .select(`
        id,
        file_path,
        analysis_results (
          report_file_path
        )
      `)
      .eq('user_id', userId);

    if (fetchContractsError) {
      console.error(`Error fetching contracts for user ${userId} for deletion:`, fetchContractsError);
      // Continue, but log the error.
    } else if (contractsToDelete && contractsToDelete.length > 0) {
      const contractFilePaths: string[] = [];
      const reportFilePaths: string[] = [];

      contractsToDelete.forEach(contract => {
        if (contract.file_path) {
          contractFilePaths.push(contract.file_path);
        }
        if (contract.analysis_results && contract.analysis_results.length > 0 && contract.analysis_results[0].report_file_path) {
          reportFilePaths.push(contract.analysis_results[0].report_file_path);
        }
      });

      // Delete original contract files
      if (contractFilePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('contracts')
          .remove(contractFilePaths);

        if (storageError) {
          console.error(`Error deleting contract files for user ${userId}:`, storageError);
        } else {
          console.log(`Successfully deleted ${contractFilePaths.length} contract files for user ${userId}.`);
        }
      }

      // Delete report files
      if (reportFilePaths.length > 0) {
        const { error: reportStorageError } = await supabase.storage
          .from('reports')
          .remove(reportFilePaths);

        if (reportStorageError) {
          console.error(`Error deleting report files for user ${userId}:`, reportStorageError);
        } else {
          console.log(`Successfully deleted ${reportFilePaths.length} report files for user ${userId}.`);
        }
      }
    }
    // --- END: Delete associated files from storage ---

    // Delete the user from auth.users, which should cascade to profiles and contracts table
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return corsResponse({ error: 'Failed to delete user' }, 500);
    }

    return corsResponse({ message: 'User deleted successfully' });

  } catch (error: any) {
    console.error('Error in admin-delete-user Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});