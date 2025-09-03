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
    const { userId, contractId, reportSummary, reportLink, reportHtmlContent } = await req.json();

    if (!userId || !contractId || !reportSummary || !reportLink || !reportHtmlContent) {
      return corsResponse({ error: 'Missing required parameters for triggering email.' }, 400);
    }

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
    const sendEmail = profileData?.email_reports_enabled || false; // Get preference

    if (!sendEmail) {
      console.log(`Email sending for contract ${contractId} skipped due to user preference.`);
      return corsResponse({ message: 'Email sending skipped due to user preference' });
    }

    // Invoke the actual email sending function
    const { data: emailFnData, error: emailFnError } = await supabase.functions.invoke('send-analysis-report-email', {
      body: {
        recipientEmail: recipientEmail,
        subject: `Your Contract Analysis Report for ${contractId} is Ready!`,
        message: reportSummary, // This will be the executive summary
        recipientName: userName,
        reportHtmlContent: reportHtmlContent, // Pass the full HTML content
        reportLink: reportLink, // Pass the signed URL
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