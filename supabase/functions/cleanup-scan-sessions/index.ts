import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Helper for CORS responses (though not strictly needed for a scheduled function, good practice)
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

  const cronSecret = req.headers.get('X-Cron-Secret');
  const expectedSecret = Deno.env.get('CRON_SECRET_KEY');

  if (!cronSecret || cronSecret !== expectedSecret) {
    console.warn('cleanup-scan-sessions: Unauthorized access attempt - Invalid or missing X-Cron-Secret.');
    return corsResponse({ error: 'Unauthorized: Invalid or missing secret' }, 401);
  }

  try {
    console.log('cleanup-scan-sessions: Starting scheduled cleanup of expired scan sessions...');

    const now = new Date();

    // 1. Find expired scan sessions
    const { data: expiredSessions, error: fetchError } = await supabase
      .from('scan_sessions')
      .select('id, user_id')
      .lt('expires_at', now.toISOString())
      .eq('status', 'active');

    if (fetchError) {
      console.error('cleanup-scan-sessions: Error fetching expired sessions:', fetchError);
      return corsResponse({ error: 'Failed to fetch expired sessions.' }, 500);
    }

    if (!expiredSessions || expiredSessions.length === 0) {
      console.log('cleanup-scan-sessions: No expired scan sessions found.');
      return corsResponse({ message: 'No expired scan sessions to clean up.' });
    }

    console.log(`cleanup-scan-sessions: Found ${expiredSessions.length} expired sessions.`);

    const cleanupResults = await Promise.all(expiredSessions.map(async (session) => {
      try {
        // 2. Delete temporary images from Storage for this session
        const { data: listData, error: listError } = await supabase.storage
          .from('temp_scans')
          .list(`${session.user_id}/${session.id}`, {
            limit: 100, // Adjust limit as needed
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
          });

        if (listError) {
          console.error(`cleanup-scan-sessions: Error listing temp images for session ${session.id}:`, listError);
          // Continue, but log the error
        } else if (listData && listData.length > 0) {
          const filesToRemove = listData.map(file => `${session.user_id}/${session.id}/${file.name}`);
          const { error: removeError } = await supabase.storage
            .from('temp_scans')
            .remove(filesToRemove);

          if (removeError) {
            console.error(`cleanup-scan-sessions: Error deleting temp images for session ${session.id}:`, removeError);
          } else {
            console.log(`cleanup-scan-sessions: Successfully deleted ${filesToRemove.length} temp images for session ${session.id}.`);
          }
        }

        // 3. Update the session status to 'expired'
        const { error: updateError } = await supabase
          .from('scan_sessions')
          .update({ status: 'expired' })
          .eq('id', session.id);

        if (updateError) {
          console.error(`cleanup-scan-sessions: Error updating status for session ${session.id}:`, updateError);
          return { id: session.id, status: 'failed', reason: updateError.message };
        } else {
          console.log(`cleanup-scan-sessions: Successfully expired session ${session.id}.`);
          await logActivity(
            supabase,
            session.user_id,
            'SCAN_SESSION_EXPIRED',
            `Scan session ${session.id} expired and was cleaned up.`,
            { scan_session_id: session.id }
          );
          return { id: session.id, status: 'success' };
        }
      } catch (innerError: any) {
        console.error(`cleanup-scan-sessions: Unexpected error processing session ${session.id}:`, innerError);
        return { id: session.id, status: 'failed', reason: innerError.message };
      }
    }));

    const successfulCleanups = cleanupResults.filter(r => r.status === 'success').length;
    const failedCleanups = cleanupResults.filter(r => r.status === 'failed').length;

    console.log(`cleanup-scan-sessions: Finished cleanup. Successful: ${successfulCleanups}, Failed: ${failedCleanups}`);

    return corsResponse({
      message: `Deletion process completed. ${successfulCleanups} sessions cleaned up, ${failedCleanups} failed.`,
      results: cleanupResults,
    });

  } catch (error: any) {
    console.error('cleanup-scan-sessions: Unhandled error in Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});