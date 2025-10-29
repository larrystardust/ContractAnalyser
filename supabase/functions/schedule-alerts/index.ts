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

  const cronSecret = req.headers.get('X-Cron-Secret');
  const expectedSecret = Deno.env.get('CRON_SECRET_KEY');

  if (!cronSecret || cronSecret !== expectedSecret) {
    console.warn('schedule-alerts: Unauthorized access attempt - Invalid or missing X-Cron-Secret.');
    return corsResponse({ error: 'Unauthorized: Invalid or missing secret' }, 401);
  }

  try {
    console.log('schedule-alerts: Starting scheduled alerts check...');

    // Fetch all users with their notification preferences for key dates and weekly reports
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, language_preference, renewal_notification_days_before, termination_notification_days_before, notification_settings, users(email)');

    if (profilesError) {
      console.error('schedule-alerts: Error fetching profiles:', profilesError);
      return corsResponse({ error: 'Failed to fetch user profiles for alerts.' }, 500);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    // Determine if it's Monday (or your chosen day for weekly reports)
    const isMonday = today.getDay() === 1; // Monday is 1, Sunday is 0

    for (const profile of profiles) {
      const userId = profile.id;
      const userEmail = profile.users?.email;
      const userName = profile.full_name || userEmail;
      const userPreferredLanguage = profile.language_preference || 'en';
      const notificationSettings = profile.notification_settings as Record<string, { email: boolean; inApp: boolean }> || {};

      // Extract notification days from profile
      const renewalDaysBefore = profile.renewal_notification_days_before ?? 30; // Default to 30 days
      const terminationDaysBefore = profile.termination_notification_days_before ?? 30; // Default to 30 days

      // Check if renewal alerts are enabled for this user
      const renewalAlertsEnabledInApp = notificationSettings['renewal-alerts']?.inApp;
      const renewalAlertsEnabledEmail = notificationSettings['renewal-alerts']?.email;
      // Check if termination alerts are enabled for this user
      const terminationAlertsEnabledInApp = notificationSettings['termination-alerts']?.inApp;
      const terminationAlertsEnabledEmail = notificationSettings['termination-alerts']?.email;
      // Check if weekly reports email is enabled
      const weeklyReportsEnabledEmail = notificationSettings['weekly-reports']?.email;

      // --- Key Date Alerts (Renewal & Termination) ---
      if (renewalAlertsEnabledInApp || renewalAlertsEnabledEmail || terminationAlertsEnabledInApp || terminationAlertsEnabledEmail) {
        const { data: contracts, error: contractsError } = await supabase
          .from('contracts')
          .select(`
            id,
            name,
            translated_name,
            analysis_results (
              compliance_score,
              findings (risk_level),
              effective_date,
              termination_date,
              renewal_date
            )
          `)
          .eq('user_id', userId)
          .eq('status', 'completed');

        if (contractsError) {
          console.error(`schedule-alerts: Error fetching contracts for user ${userId}:`, contractsError);
          continue;
        }

        for (const contract of contracts) {
          const contractName = contract.translated_name || contract.name;
          const analysisResult = contract.analysis_results?.[0];

          if (!analysisResult) continue;

          // Check for Renewal Alerts
          if (analysisResult.renewal_date) {
            const renewalDate = new Date(analysisResult.renewal_date);
            renewalDate.setHours(0, 0, 0, 0);
            const diffTime = renewalDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === renewalDaysBefore) { // MODIFIED: Use renewalDaysBefore
              const notificationMessage = getTranslatedMessage('notification_message_contract_renewal_alert', userPreferredLanguage, { contractName: contractName, days: renewalDaysBefore });
              
              if (renewalAlertsEnabledInApp) {
                await insertNotification(
                  userId,
                  'notification_title_contract_renewal_alert',
                  notificationMessage,
                  'info'
                );
                console.log(`schedule-alerts: Sent in-app renewal alert for contract ${contract.id} to user ${userId}.`);
              }

              if (renewalAlertsEnabledEmail && userEmail) {
                const emailSubject = getTranslatedMessage('email_subject_renewal_alert', userPreferredLanguage, { contractName: contractName, days: renewalDaysBefore });
                const { data: emailFnData, error: emailFnInvokeError } = await supabase.functions.invoke('send-key-date-alert-email', {
                  body: {
                    recipientEmail: userEmail,
                    subject: emailSubject,
                    message: notificationMessage,
                    userPreferredLanguage: userPreferredLanguage,
                    alertType: 'renewal',
                    contractName: contractName,
                    days: renewalDaysBefore,
                  },
                });
                if (emailFnInvokeError) {
                  console.error(`schedule-alerts: Error invoking send-key-date-alert-email for renewal alert to ${userEmail}:`, emailFnInvokeError);
                } else {
                  console.log(`schedule-alerts: Invoked send-key-date-alert-email for renewal alert to ${userEmail}. Response:`, emailFnData);
                }
                console.log(`schedule-alerts: Sent email renewal alert for contract ${contract.id} to user ${userId}.`);
              }
            }
          }

          // Check for Termination Alerts
          if (analysisResult.termination_date) {
            const terminationDate = new Date(analysisResult.termination_date);
            terminationDate.setHours(0, 0, 0, 0);
            const diffTime = terminationDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === terminationDaysBefore) { // MODIFIED: Use terminationDaysBefore
              const notificationMessage = getTranslatedMessage('notification_message_contract_termination_alert', userPreferredLanguage, { contractName: contractName, days: terminationDaysBefore });
              
              if (terminationAlertsEnabledInApp) {
                await insertNotification(
                  userId,
                  'notification_title_contract_termination_alert',
                  notificationMessage,
                  'warning'
                );
                console.log(`schedule-alerts: Sent in-app termination alert for contract ${contract.id} to user ${userId}.`);
              }

              if (terminationAlertsEnabledEmail && userEmail) {
                const emailSubject = getTranslatedMessage('email_subject_termination_alert', userPreferredLanguage, { contractName: contractName, days: terminationDaysBefore });
                const { data: emailFnData, error: emailFnInvokeError } = await supabase.functions.invoke('send-key-date-alert-email', {
                  body: {
                    recipientEmail: userEmail,
                    subject: emailSubject,
                    message: notificationMessage,
                    userPreferredLanguage: userPreferredLanguage,
                    alertType: 'termination',
                    contractName: contractName,
                    days: terminationDaysBefore,
                  },
                });
                if (emailFnInvokeError) {
                  console.error(`schedule-alerts: Error invoking send-key-date-alert-email for termination alert to ${userEmail}:`, emailFnInvokeError);
                } else {
                  console.log(`schedule-alerts: Invoked send-key-date-alert-email for termination alert to ${userEmail}. Response:`, emailFnData);
                }
                console.log(`schedule-alerts: Sent email termination alert for contract ${contract.id} to user ${userId}.`);
              }
            }
          }
        }
      }

      // --- Weekly Reports Email ---
      if (isMonday && weeklyReportsEnabledEmail && userEmail) {
        console.log(`schedule-alerts: Generating weekly report for user ${userId}.`);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);

        const { data: weeklyContracts, error: weeklyContractsError } = await supabase
          .from('contracts')
          .select(`
            id,
            name,
            translated_name,
            status,
            analysis_results (
              compliance_score,
              findings (risk_level)
            )
          `)
          .eq('user_id', userId)
          .gte('created_at', sevenDaysAgo.toISOString())
          .lte('created_at', today.toISOString());

        if (weeklyContractsError) {
          console.error(`schedule-alerts: Error fetching weekly contracts for user ${userId}:`, weeklyContractsError);
          continue;
        }

        let newContractsCount = 0;
        let completedAnalysesCount = 0;
        let highRiskFindingsCount = 0;
        let mediumRiskFindingsCount = 0;

        weeklyContracts.forEach(contract => {
          newContractsCount++;
          if (contract.status === 'completed' && contract.analysis_results && contract.analysis_results.length > 0) {
            completedAnalysesCount++;
            contract.analysis_results[0].findings.forEach(finding => {
              if (finding.risk_level === 'high') highRiskFindingsCount++;
              if (finding.risk_level === 'medium') mediumRiskFindingsCount++;
            });
          }
        });

        const weeklyReportSummary = getTranslatedMessage('email_weekly_report_summary_content', userPreferredLanguage, {
          newContracts: newContractsCount,
          completedAnalyses: completedAnalysesCount,
          highRiskFindings: highRiskFindingsCount,
          mediumRiskFindings: mediumRiskFindingsCount,
        });

        await supabase.functions.invoke('send-weekly-report-email', {
          body: {
            recipientEmail: userEmail,
            recipientName: userName,
            weeklyReportSummary: weeklyReportSummary,
            userPreferredLanguage: userPreferredLanguage,
          },
        });
        console.log(`schedule-alerts: Sent weekly report email to user ${userId}.`);
      }
    }

    console.log('schedule-alerts: Finished scheduled alerts check.');
    return corsResponse({ message: 'Scheduled alerts check completed.' });

  } catch (error: any) {
    console.error('schedule-alerts: Unhandled error in Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});