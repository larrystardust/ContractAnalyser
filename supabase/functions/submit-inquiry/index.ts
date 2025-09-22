import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Helper for CORS responses
function corsResponse(body: string | object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*', // IMPORTANT: Adjust this in production to your frontend domain (e.g., 'https://your-app.netlify.app') for security
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
    return corsResponse({ error: getTranslatedMessage('message_method_not_allowed', 'en') }, 405);
  }

  try {
    const { first_name, last_name, email, subject, message, recaptcha_token } = await req.json();
    // For unauthenticated flows, we default to English as we don't have user's preference
    const userPreferredLanguage = 'en'; // ADDED: Default to English for unauthenticated flow

    if (!first_name || !last_name || !email || !subject || !message || !recaptcha_token) {
      return corsResponse({ error: getTranslatedMessage('message_missing_required_fields', userPreferredLanguage) }, 400);
    }

    // Verify reCAPTCHA token with Google's API
    const recaptchaSecretKey = Deno.env.get('RECAPTCHA_SECRET_KEY');
    if (!recaptchaSecretKey) {
      console.error('RECAPTCHA_SECRET_KEY is not set in environment variables.');
      return corsResponse({ error: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: 'reCAPTCHA secret key missing.' }) }, 500);
    }

    const recaptchaVerificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecretKey}&response=${recaptcha_token}`;
    const recaptchaResponse = await fetch(recaptchaVerificationUrl, { method: 'POST' });
    const recaptchaData = await recaptchaResponse.json();

    if (!recaptchaData.success) {
      console.warn('reCAPTCHA verification failed:', recaptchaData['error-codes']);
      return corsResponse({ error: getTranslatedMessage('message_recaptcha_failed', userPreferredLanguage) }, 403);
    }

    // reCAPTCHA passed, now insert inquiry into database
    const { data, error: insertError } = await supabase
      .from('inquiries')
      .insert({
        first_name,
        last_name,
        email,
        subject,
        message,
        recaptcha_token: recaptcha_token, // Storing the token is optional, but can be useful for auditing
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting inquiry:', insertError);
      return corsResponse({ error: getTranslatedMessage('message_server_error', userPreferredLanguage, { errorMessage: insertError.message || 'Failed to submit inquiry to database.' }) }, 500);
    }

    // ADDED: Log activity
    await logActivity(
      supabase,
      null, // No authenticated user for public inquiry
      'INQUIRY_SUBMITTED',
      `New inquiry submitted by ${first_name} ${last_name} (${email}) - Subject: ${subject}`,
      { inquiry_id: data.id, email: email, subject: subject }
    );

    return corsResponse({ message: getTranslatedMessage('message_inquiry_submitted_successfully', userPreferredLanguage), inquiry: data });

  } catch (error: any) {
    console.error('Error in submit-inquiry Edge Function:', error);
    return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: error.message }) }, 500);
  }
});