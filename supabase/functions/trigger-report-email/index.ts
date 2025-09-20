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
    const { userId, contractId, reportSummary, reportLink, reportHtmlContent, userPreferredLanguage } = await req.json();

    // Authenticate the request to ensure it's coming from an authorized source
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user || user.id !== userId) { // Ensure the request is for the correct user
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token or mismatch.' }, 401);
    }

    // Fetch global app settings to check global email reports enabled status
    const { data: appSettings, error: appSettingsError } = await supabase
      .from('app_settings')
      .select('global_email_reports_enabled')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (appSettingsError) {
      console.error('Error fetching app settings for global email reports:', appSettingsError);
      // Continue, but log the error. Assume enabled if fetching fails.
    }

    const globalEmailReportsEnabled = appSettings?.global_email_reports_enabled ?? true; // Default to true

    if (!globalEmailReportsEnabled) {
      console.log(`Email sending for contract ${contractId} skipped because global email reports are disabled.`);
      return corsResponse({ message: 'Email sending skipped due to global settings' });
    }

    // Fetch user's email, full name, and email report preference
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email_reports_enabled')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error(`Error fetching profile for user ${userId}:`, profileError);
      return corsResponse({ error: 'Failed to fetch user profile for email preferences.' }, 500);
    }

    const recipientEmail = user.email; // Get email from auth.user
    const userName = profileData?.full_name || user.email; // Fallback to email if no full name
    const sendEmail = profileData?.email_reports_enabled || false; // Get individual user preference

    if (!sendEmail) {
      console.log(`Email sending for contract ${contractId} skipped due to user preference.`);
      return corsResponse({ message: 'Email sending skipped due to user preference' });
    }

    // Prepare parameters for send-analysis-report-email and log them
    const emailSubject = `Your Contract Analysis Report for ${contractId} is Ready!`;
    const emailMessage = reportSummary; // This is the executive summary

    console.log('trigger-report-email: Parameters for send-analysis-report-email:');
    console.log(`  userId: ${userId}`);
    console.log(`  recipientEmail: ${recipientEmail}`);
    console.log(`  subject: ${emailSubject}`);
    console.log(`  message: ${emailMessage ? 'Present' : 'MISSING'}`); // Check presence
    console.log(`  recipientName: ${userName}`);
    console.log(`  reportHtmlContent: ${reportHtmlContent ? 'Present' : 'MISSING'}`); // Check presence
    console.log(`  reportLink: ${reportLink ? 'Present' : 'MISSING'}`); // Check presence
    console.log(`  userPreferredLanguage: ${userPreferredLanguage ? 'Present' : 'MISSING'}`); // Check presence

    // Invoke the actual email sending function
    const { data: emailFnData, error: emailFnError } = await supabase.functions.invoke('send-analysis-report-email', {
      body: {
        userId: userId,
        recipientEmail: recipientEmail,
        subject: emailSubject,
        message: emailMessage,
        recipientName: userName,
        reportHtmlContent: reportHtmlContent || 'Report content not available.', // Provide fallback
        reportLink: reportLink || 'N/A', // Provide fallback
        userPreferredLanguage: userPreferredLanguage,
      },
      headers: {
        'Authorization': `Bearer ${token}`, // Pass the current user's token
      },
    });

    if (emailFnError) {
      console.error('Error invoking send-analysis-report-email Edge Function:', emailFnError);
      return corsResponse({ error: `Failed to send email: ${emailFnError.message}` }, 500);
    } else {
      console.log('send-analysis-report-email Edge Function invoked successfully:', emailFnData);
      return corsResponse({ message: 'Email sending process initiated successfully' });
    }

  } catch (error: any) {
    console.error('Error in trigger-report-email Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});