import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { insertNotification } from '../_shared/notification_utils.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';

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

  try {
    console.log('schedule-alerts: Starting scheduled alerts check...');

    // Fetch all users with their notification preferences for key dates
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, language_preference, renewal_notification_days_before, termination_notification_days_before, notification_settings');

    if (profilesError) {
      console.error('schedule-alerts: Error fetching profiles:', profilesError);
      return corsResponse({ error: 'Failed to fetch user profiles for alerts.' }, 500);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    for (const profile of profiles) {
      const userId = profile.id;
      const userPreferredLanguage = profile.language_preference || 'en';
      const renewalDays = profile.renewal_notification_days_before || 0;
      const terminationDays = profile.termination_notification_days_before || 0;
      const notificationSettings = profile.notification_settings as Record<string, { email: boolean; inApp: boolean }> || {};

      // Check if renewal alerts are enabled for this user
      const renewalAlertsEnabled = notificationSettings['renewal-alerts']?.inApp || notificationSettings['renewal-alerts']?.email;
      // Check if termination alerts are enabled for this user
      const terminationAlertsEnabled = notificationSettings['termination-alerts']?.inApp || notificationSettings['termination-alerts']?.email;

      if (!renewalAlertsEnabled && !terminationAlertsEnabled) {
        // console.log(`schedule-alerts: User ${userId} has no key date alerts enabled. Skipping.`);
        continue;
      }

      // Fetch contracts for this user that have analysis results with key dates
      const { data: contracts, error: contractsError } = await supabase
        .from('contracts')
        .select(`
          id,
          name,
          translated_name,
          analysis_results (
            effective_date,
            termination_date,
            renewal_date
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'completed'); // Only check completed contracts

      if (contractsError) {
        console.error(`schedule-alerts: Error fetching contracts for user ${userId}:`, contractsError);
        continue;
      }

      for (const contract of contracts) {
        const contractName = contract.translated_name || contract.name;
        const analysisResult = contract.analysis_results?.[0]; // Assuming one analysis result per contract

        if (!analysisResult) continue;

        // --- Check for Renewal Alerts ---
        if (renewalAlertsEnabled && analysisResult.renewal_date) {
          const renewalDate = new Date(analysisResult.renewal_date);
          renewalDate.setHours(0, 0, 0, 0);
          const diffTime = renewalDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === renewalDays) {
            const notificationMessage = getTranslatedMessage('notification_message_contract_renewal_alert', userPreferredLanguage, { contractName: contractName, days: renewalDays });
            await insertNotification(
              userId,
              'notification_title_contract_renewal_alert',
              notificationMessage,
              'info'
            );
            console.log(`schedule-alerts: Sent renewal alert for contract ${contract.id} to user ${userId}.`);
          }
        }

        // --- Check for Termination Alerts ---
        if (terminationAlertsEnabled && analysisResult.termination_date) {
          const terminationDate = new Date(analysisResult.termination_date);
          terminationDate.setHours(0, 0, 0, 0);
          const diffTime = terminationDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === terminationDays) {
            const notificationMessage = getTranslatedMessage('notification_message_contract_termination_alert', userPreferredLanguage, { contractName: contractName, days: terminationDays });
            await insertNotification(
              userId,
              'notification_title_contract_termination_alert',
              notificationMessage,
              'warning'
            );
            console.log(`schedule-alerts: Sent termination alert for contract ${contract.id} to user ${userId}.`);
          }
        }
      }
    }

    console.log('schedule-alerts: Finished scheduled alerts check.');
    return corsResponse({ message: 'Scheduled alerts check completed.' });

  } catch (error: any) {
    console.error('schedule-alerts: Unhandled error in Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});