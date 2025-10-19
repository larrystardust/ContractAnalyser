import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { edgeTranslations, getTranslatedMessage } from '../_shared/edge_translations.ts';

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

// Helper function to get a safe risk level string
function getSafeRiskLevel(riskLevel: string | undefined): string {
  if (typeof riskLevel === 'string' && ['high', 'medium', 'low', 'none'].includes(riskLevel)) {
    return riskLevel;
  }
  return 'none'; // Default to 'none' if undefined or invalid
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(null, 204);
  }

  if (req.method !== 'POST') {
    return corsResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    let requestBody: any = {};
    let rawBody = '';

    try {
      rawBody = await req.text();
      // console.log('generate-analysis-report: Raw request body received:', rawBody); // REMOVED
      if (rawBody) {
        requestBody = JSON.parse(rawBody);
      }
      // console.log('generate-analysis-report: Parsed requestBody:', requestBody); // REMOVED
    } catch (e) {
      console.error('generate-analysis-report: Error parsing request body as JSON:', e);
      return corsResponse({ error: 'Invalid JSON in request body.' }, 400);
    }

    const { contractId, contractName: bodyContractName, analysisResult: bodyAnalysisResult, outputLanguage } = requestBody;
    // console.log('generate-analysis-report: Extracted contractId:', contractId); // REMOVED

    if (!contractId) {
      return corsResponse({ error: 'Missing contractId' }, 400);
    }

    // Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    
    if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
      return corsResponse({ error: 'Invalid or empty authentication token' }, 401);
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    let finalContractName = bodyContractName;
    let finalAnalysisResult = bodyAnalysisResult;

    // If analysisResult is not provided or is incomplete, fetch it from the database
    if (!finalAnalysisResult || !finalAnalysisResult.executive_summary || !finalAnalysisResult.findings) {
      // console.log(`Fetching analysis results for contractId: ${contractId} from database.`); // REMOVED
      const { data: contractData, error: contractFetchError } = await supabase
        .from('contracts')
        .select(`
          name,
          analysis_results (
            executive_summary,
            data_protection_impact,
            compliance_score,
            jurisdiction_summaries,
            effective_date,
            termination_date,
            renewal_date,
            contract_type,
            contract_value,
            parties,
            liability_cap_summary,
            indemnification_clause_summary,
            confidentiality_obligations_summary,
            findings (*)
          )
        `)
        .eq('id', contractId)
        .eq('user_id', user.id) // Ensure user owns the contract
        .maybeSingle();

      if (contractFetchError) {
        console.error('Error fetching contract and analysis results from DB:', contractFetchError);
        return corsResponse({ error: 'Failed to fetch contract analysis data from database.' }, 500);
      }
      if (!contractData || !contractData.analysis_results || contractData.analysis_results.length === 0) {
        return corsResponse({ error: 'Contract analysis results not found in database.' }, 404);
      }

      finalContractName = contractData.name;
      finalAnalysisResult = contractData.analysis_results; // Assuming one analysis result per contract
    }

    // CRITICAL FIX: Ensure all advanced analysis fields are strings (or translated 'Not specified')
    // This ensures they are always rendered if advanced analysis was performed.
    const notSpecifiedTranslated = getTranslatedMessage('not_specified', outputLanguage);

    const effectiveDate = finalAnalysisResult.effective_date || notSpecifiedTranslated;
    const terminationDate = finalAnalysisResult.termination_date || notSpecifiedTranslated;
    const renewalDate = finalAnalysisResult.renewal_date || notSpecifiedTranslated;
    const contractType = finalAnalysisResult.contract_type || notSpecifiedTranslated;
    const contractValue = finalAnalysisResult.contract_value || notSpecifiedTranslated;
    const parties = (finalAnalysisResult.parties && finalAnalysisResult.parties.length > 0) ? finalAnalysisResult.parties.join(', ') : notSpecifiedTranslated;
    const liabilityCapSummary = finalAnalysisResult.liability_cap_summary || notSpecifiedTranslated;
    const indemnificationClauseSummary = finalAnalysisResult.indemnification_clause_summary || notSpecifiedTranslated;
    const confidentialityObligationsSummary = finalAnalysisResult.confidentiality_obligations_summary || notSpecifiedTranslated;


    // Embedded CSS content from public/report.css
    const embeddedCss = `
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 20px; }
      h1, h2, h3, h4 { color: #0056b3; }
      .container { max-width: 900px; margin: auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
      .section { margin-bottom: 20px; padding: 15px; border: 1px solid #eee; border-radius: 5px; }
      .summary-box { background: #e6f7ff; border-left: 5px solid #007bff; padding: 15px; margin-bottom: 20px; }
      .score-box { text-align: center; padding: 10px; border-radius: 5px; font-weight: bold; color: white; }
      .score-high { background-color: #dc3545; }
      .score-medium { background-color: #ffc107; }
      .score-low { background-color: #17a2b8; }
      .score-none { background-color: #28a745; }
      .finding { border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px; }
      .finding-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
      .finding-title { font-weight: bold; color: #333; }
      .risk-badge { padding: 3px 8px; border-radius: 12px; font-size: 0.8em; color: white; }
      .risk-high { background-color: #dc3545; }
      .risk-medium { background-color: #ffc107; }
      .risk-low { background-color: #17a2b8; }
      .risk-none { background-color: #28a745; }
      ul { list-style-type: disc; margin-left: 20px; }
      ol { list-style-type: decimal; margin-left: 20px; }
      .footer { text-align: center; margin-top: 30px; font-size: 0.9em; color: #777; }
      .jurisdiction-summary { border: 1px solid #cce5ff; background-color: #e0f2ff; padding: 15px; margin-bottom: 10px; border-radius: 5px; }
      .jurisdiction-summary h4 { margin-top: 0; color: #0056b3; }
    `;

    // Generate HTML report content
    let htmlContent = `
      <!DOCTYPE html>
      <html lang="${outputLanguage}">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${getTranslatedMessage('report_title', outputLanguage)} - ${finalContractName}</title>
          <style>${embeddedCss}</style>
      </head>
      <body>
          <div class="container">
              <h1>${getTranslatedMessage('report_title', outputLanguage)}</h1>
              <p><strong>${getTranslatedMessage('contract_name', outputLanguage)}</strong> ${finalContractName}</p>
              <p><strong>${getTranslatedMessage('analysis_date', outputLanguage)}</strong> ${new Date().toLocaleDateString()}</p>

              <div class="section summary-box">
                  <h2>${getTranslatedMessage('executive_summary', outputLanguage)}</h2>
                  <p>${finalAnalysisResult.executive_summary}</p>
              </div>

              <div class="section">
                  <h2>${getTranslatedMessage('overall_compliance_score', outputLanguage)}</h2>
                  <div class="score-box ${finalAnalysisResult.compliance_score >= 80 ? 'score-none' : finalAnalysisResult.compliance_score >= 60 ? 'score-low' : finalAnalysisResult.compliance_score >= 40 ? 'score-medium' : 'score-high'}">
                      ${finalAnalysisResult.compliance_score}%
                  </div>
                  <p>${getTranslatedMessage('score_description', outputLanguage)}</p>
              </div>

              ${finalAnalysisResult.data_protection_impact ? `
              <div class="section">
                  <h2>${getTranslatedMessage('data_protection_impact', outputLanguage)}</h2>
                  <p>${finalAnalysisResult.data_protection_impact}</p>
              </div>
              ` : ''}

              <div class="section">
                  <h2>${getTranslatedMessage('advanced_analysis_details', outputLanguage)}</h2>
                  <p><strong>${getTranslatedMessage('effective_date', outputLanguage)}:</strong> ${effectiveDate}</p>
                  <p><strong>${getTranslatedMessage('termination_date', outputLanguage)}:</strong> ${terminationDate}</p>
                  <p><strong>${getTranslatedMessage('renewal_date', outputLanguage)}:</strong> ${renewalDate}</p>
                  <p><strong>${getTranslatedMessage('contract_type', outputLanguage)}:</strong> ${contractType}</p>
                  <p><strong>${getTranslatedMessage('contract_value', outputLanguage)}:</strong> ${contractValue}</p>
                  <p><strong>${getTranslatedMessage('parties', outputLanguage)}:</strong> ${parties}</p>
                  <p><strong>${getTranslatedMessage('liability_cap_summary', outputLanguage)}:</strong> ${liabilityCapSummary}</p>
                  <p><strong>${getTranslatedMessage('indemnification_clause_summary', outputLanguage)}:</strong> ${indemnificationClauseSummary}</p>
                  <p><strong>${getTranslatedMessage('confidentiality_obligations_summary', outputLanguage)}:</strong> ${confidentialityObligationsSummary}</p>
              </div>

              <div class="section">
                  <h2>${getTranslatedMessage('jurisdiction_summaries', outputLanguage)}</h2>
                  ${Object.keys(finalAnalysisResult.jurisdiction_summaries).length > 0 ?
                      Object.entries(finalAnalysisResult.jurisdiction_summaries).map(([key, summary]: [string, any]) => `
                          <div class="jurisdiction-summary">
                              <h4>${getTranslatedMessage('jurisdiction_' + summary.jurisdiction.toLowerCase().replace(/\s/g, '_'), outputLanguage)}</h4>
                              ${summary.applicableLaws && summary.applicableLaws.length > 0 ? `
                                  <strong>${getTranslatedMessage('applicable_laws', outputLanguage)}</strong>
                                  <ul>
                                      ${summary.applicableLaws.map((law: string) => `<li>${law}</li>`).join('')}
                                  </ul>
                              ` : ''}
                              ${summary.keyFindings && summary.keyFindings.length > 0 ? `
                                  <strong>${getTranslatedMessage('key_findings', outputLanguage)}</strong>
                                  <ul>
                                      ${summary.keyFindings.map((finding: string) => `<li>${finding}</li>`).join('')}
                                  </ul>
                              ` : ''}
                              <strong>${getTranslatedMessage('risk_level_label', outputLanguage)}</strong> <span class="risk-badge risk-${getSafeRiskLevel(summary.riskLevel)}">${getTranslatedMessage(`risk_${getSafeRiskLevel(summary.riskLevel)}`, outputLanguage)}</span>
                          </div>
                      `).join('')
                  : `<p>${getTranslatedMessage('no_jurisdiction_summaries', outputLanguage)}</p>`}
              </div>

              <div class="section">
                  <h2>${getTranslatedMessage('detailed_findings', outputLanguage)}</h2>
                  ${finalAnalysisResult.findings && finalAnalysisResult.findings.length > 0 ?
                      finalAnalysisResult.findings.map((finding: any) => {
                          const currentRiskLevel = finding.risk_level || finding.riskLevel;
                          return `
                          <div class="finding">
                              <div class="finding-header">
                                  <span class="finding-title">${finding.title}</span>
                                  ${currentRiskLevel && getSafeRiskLevel(currentRiskLevel) !== 'none' ? `
                                      <span class="risk-badge risk-${getSafeRiskLevel(currentRiskLevel)}">${getTranslatedMessage(`risk_${getSafeRiskLevel(currentRiskLevel)}`, outputLanguage)}</span>
                                  ` : ''}
                              </div>
                              <p><strong>${getTranslatedMessage('jurisdiction_label', outputLanguage)}</strong> ${getTranslatedMessage('jurisdiction_' + finding.jurisdiction.toLowerCase().replace(/\s/g, '_'), outputLanguage)}</p>
                              <p><strong>${getTranslatedMessage('category_label', outputLanguage)}</strong> ${getTranslatedMessage('category_' + finding.category.toLowerCase().replace(/-/g, '_'), outputLanguage)}</p>
                              ${finding.clause_reference ? `<p><strong>${getTranslatedMessage('clause_reference_label', outputLanguage)}</strong> ${finding.clause_reference}</p>` : ''}
                              <p>${finding.description}</p>
                              ${finding.recommendations && finding.recommendations.length > 0 ? `
                                  <strong>${getTranslatedMessage('recommendations_label', outputLanguage)}</strong>
                                  <ul>
                                      ${finding.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
                                  </ul>
                              ` : ''}
                          </div>
                          `;
                      }).join('')
                  : `<p>${getTranslatedMessage('no_detailed_findings', outputLanguage)}</p>`}
              </div>

              <div class="footer">
                  <p>${getTranslatedMessage('footer_copyright', outputLanguage, { year: new Date().getFullYear() })}</p>
                  <p>${getTranslatedMessage('footer_disclaimer', outputLanguage)}</p>
              </div>
          </div>
      </body>
      </html>
    `;

    // Upload HTML to Supabase Storage
    const fileName = `report-${contractId}-${Date.now()}.html`;
    const filePath = fileName; 

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reports')
      .upload(filePath, htmlContent, {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading report to storage:', uploadError);
      return corsResponse({ error: 'Failed to generate and store report.' }, 500);
    }

    // Get signed URL for the uploaded report
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('reports')
      .createSignedUrl(filePath, 3600);

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      return corsResponse({ error: 'Failed to get downloadable link for report.' }, 500);
    }

    return corsResponse({ url: signedUrlData.signedUrl, filePath: filePath, htmlContent: htmlContent });
  } catch (error: any) {
    console.error('Error in generate-analysis-report Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});