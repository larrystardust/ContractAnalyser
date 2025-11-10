import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Use service role to bypass RLS for fetching artifact
);

// Helper for CORS responses
function corsResponse(body: string | object | null, status = 200, origin: string | null = null, contentType = 'application/json') {
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS', // Changed to GET
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Content-Type': contentType, // Dynamic content type
  };
  if (status === 204) {
    return new Response(null, { status, headers });
  }
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return corsResponse(null, 204, origin);
  }

  if (req.method !== 'GET') { // Changed to GET
    return corsResponse({ error: getTranslatedMessage('message_method_not_allowed', 'en') }, 405, origin);
  }

  try {
    const url = new URL(req.url);
    const artifactPath = url.searchParams.get('artifactPath');
    const outputLanguage = url.searchParams.get('lang') || 'en'; // Get language for translations

    if (!artifactPath) {
      return corsResponse({ error: getTranslatedMessage('message_missing_artifact_path', outputLanguage) }, 400, origin);
    }

    // Fetch the artifact JSON from storage using the service role key
    const { data: artifactBlob, error: downloadError } = await supabase.storage
      .from('contract_artifacts')
      .download(artifactPath);

    if (downloadError) {
      console.error('view-redlined-artifact: Error downloading artifact:', downloadError);
      return corsResponse({ error: getTranslatedMessage('error_failed_to_download_artifact', outputLanguage, { errorMessage: downloadError.message }) }, 500, origin);
    }

    if (!artifactBlob) {
      return corsResponse({ error: getTranslatedMessage('error_artifact_not_found', outputLanguage) }, 404, origin);
    }

    const artifactText = await artifactBlob.text();
    let artifactData;
    try {
      artifactData = JSON.parse(artifactText);
    } catch (parseError) {
      console.error('view-redlined-artifact: Error parsing artifact JSON:', parseError);
      return corsResponse({ error: getTranslatedMessage('error_invalid_artifact_format', outputLanguage) }, 500, origin);
    }

    const { originalClause, redlinedVersion, suggestedRevision, findingId } = artifactData;

    const embeddedCss = `
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 20px; background-color: #f9f9f9; }
      .container { max-width: 900px; margin: auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
      h1, h2, h3 { color: #0056b3; margin-bottom: 15px; }
      .section { margin-bottom: 25px; padding: 20px; border: 1px solid #eee; border-radius: 5px; background-color: #fff; }
      .section-title { font-size: 1.2em; font-weight: bold; margin-bottom: 10px; color: #333; }
      .code-block { background-color: #f0f0f0; padding: 15px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; word-break: break-word; border: 1px solid #ddd; }
      .original-text { color: #555; }
      .redlined-text { color: red; font-weight: bold; }
      .suggested-text { color: green; font-weight: bold; }
      .finding-id { font-size: 0.9em; color: #777; margin-top: 10px; }
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${outputLanguage}">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${getTranslatedMessage('redlined_clause_artifact_viewer', outputLanguage)}</title>
          <style>${embeddedCss}</style>
      </head>
      <body>
          <div class="container">
              <h1>${getTranslatedMessage('redlined_clause_artifact', outputLanguage)}</h1>
              ${findingId ? `<p class="finding-id">${getTranslatedMessage('associated_finding_id', outputLanguage)}: ${findingId}</p>` : ''}

              <div class="section">
                  <div class="section-title">${getTranslatedMessage('original_clause', outputLanguage)}</div>
                  <pre class="code-block original-text">${originalClause || getTranslatedMessage('not_available', outputLanguage)}</pre>
              </div>

              <div class="section">
                  <div class="section-title">${getTranslatedMessage('redlined_version', outputLanguage)}</div>
                  <pre class="code-block">${redlinedVersion || getTranslatedMessage('not_available', outputLanguage)}</pre>
              </div>

              <div class="section">
                  <div class="section-title">${getTranslatedMessage('suggested_revision', outputLanguage)}</div>
                  <pre class="code-block">${suggestedRevision || getTranslatedMessage('not_available', outputLanguage)}</pre>
              </div>
          </div>
      </body>
      </html>
    `;

    return corsResponse(htmlContent, 200, origin, 'text/html');

  } catch (error: any) {
    console.error('view-redlined-artifact: Unhandled error:', error);
    return corsResponse({ error: getTranslatedMessage('message_server_error', 'en', { errorMessage: error.message }) }, 500, origin);
  }
});