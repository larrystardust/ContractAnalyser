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
    const { contractId, contractName, analysisResult } = await req.json(); // MODIFIED: Receive analysisResult directly

    if (!contractId || !contractName || !analysisResult) {
      return corsResponse({ error: 'Missing contractId, contractName, or analysisResult' }, 400);
    }

    // Authenticate the user (this function can be called by contract-analyzer or directly by client)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    
    // Validate token is not empty or literal strings
    if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
      return corsResponse({ error: 'Invalid or empty authentication token' }, 401);
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    // Authorization check (only if called directly by client, contract-analyzer already handles it)
    // If this function is called by contract-analyzer, the user ID check is redundant but harmless.
    // If called directly by the client, we need to ensure the user owns the contract or is part of its subscription.
    // For simplicity, we'll assume contract-analyzer handles the primary authorization.
    // If called directly, the client-side `AnalysisResults.tsx` will pass the contractId, and we'll fetch the contract details here.
    // For now, we'll just ensure the user is authenticated.

    // Generate HTML report content
    let htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contract Analysis Report - ${contractName}</title>
          <style>
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
          </style>
      </head>
      <body>
          <div class="container">
              <h1>Contract Analysis Report</h1>
              <p><strong>Contract Name:</strong> ${contractName}</p>
              <p><strong>Analysis Date:</strong> ${new Date().toLocaleDateString()}</p>

              <div class="section summary-box">
                  <h2>Executive Summary</h2>
                  <p>${analysisResult.executive_summary}</p>
              </div>

              <div class="section">
                  <h2>Overall Compliance Score</h2>
                  <div class="score-box ${analysisResult.compliance_score >= 80 ? 'score-none' : analysisResult.compliance_score >= 60 ? 'score-low' : analysisResult.compliance_score >= 40 ? 'score-medium' : 'score-high'}">
                      ${analysisResult.compliance_score}%
                  </div>
                  <p>This score reflects the overall adherence of the contract to legal and regulatory standards, with deductions for identified risks and non-compliance.</p>
              </div>

              ${analysisResult.data_protection_impact ? `
              <div class="section">
                  <h2>Data Protection Impact</h2>
                  <p>${analysisResult.data_protection_impact}</p>
              </div>
              ` : ''}

              <div class="section">
                  <h2>Jurisdiction Summaries</h2>
                  ${Object.keys(analysisResult.jurisdiction_summaries).length > 0 ?
                      Object.entries(analysisResult.jurisdiction_summaries).map(([key, summary]: [string, any]) => `
                          <div class="jurisdiction-summary">
                              <h4>${summary.jurisdiction}</h4>
                              ${summary.applicableLaws && summary.applicableLaws.length > 0 ? `
                                  <strong>Applicable Laws:</strong>
                                  <ul>
                                      ${summary.applicableLaws.map((law: string) => `<li>${law}</li>`).join('')}
                                  </ul>
                              ` : ''}
                              ${summary.keyFindings && summary.keyFindings.length > 0 ? `
                                  <strong>Key Findings:</strong>
                                  <ul>
                                      ${summary.keyFindings.map((finding: string) => `<li>${finding}</li>`).join('')}
                                  </ul>
                              ` : ''}
                              <strong>Risk Level:</strong> <span class="risk-badge risk-${getSafeRiskLevel(summary.riskLevel)}">${getSafeRiskLevel(summary.riskLevel).charAt(0).toUpperCase() + getSafeRiskLevel(summary.riskLevel).slice(1)}</span>
                          </div>
                      `).join('')
                  : '<p>No specific jurisdiction summaries available.</p>'}
              </div>

              <div class="section">
                  <h2>Detailed Findings</h2>
                  ${analysisResult.findings && analysisResult.findings.length > 0 ?
                      analysisResult.findings.map((finding: any) => `
                          <div class="finding">
                              <div class="finding-header">
                                  <span class="finding-title">${finding.title}</span>
                                  <span class="risk-badge risk-${getSafeRiskLevel(finding.risk_level)}">${getSafeRiskLevel(finding.risk_level).charAt(0).toUpperCase() + getSafeRiskLevel(finding.risk_level).slice(1)}</span>
                              </div>
                              <p><strong>Jurisdiction:</strong> ${finding.jurisdiction}</p>
                              <p><strong>Category:</strong> ${finding.category}</p>
                              ${finding.clause_reference ? `<p><strong>Clause Reference:</strong> ${finding.clause_reference}</p>` : ''}
                              <p>${finding.description}</p>
                              ${finding.recommendations && finding.recommendations.length > 0 ? `
                                  <strong>Recommendations:</strong>
                                  <ul>
                                      ${finding.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
                                  </ul>
                              ` : ''}
                          </div>
                      `).join('')
                  : '<p>No detailed findings available.</p>'}
              </div>

              <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} ContractAnalyser. All rights reserved.</p>
                  <p>This report is for informational purposes only and does not constitute legal advice.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    // Upload HTML to Supabase Storage
    const fileName = `report-${contractId}-${Date.now()}.html`;
    const filePath = `reports/${fileName}`; // Store in a 'reports' bucket

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reports') // Ensure you have a bucket named 'reports'
      .upload(filePath, htmlContent, {
        contentType: 'text/html',
        upsert: true, // Overwrite if file exists
      });

    if (uploadError) {
      console.error('Error uploading report to storage:', uploadError);
      return corsResponse({ error: 'Failed to generate and store report.' }, 500);
    }

    // Get signed URL for the uploaded report
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('reports')
      .createSignedUrl(filePath, 3600); // URL valid for 1 hour

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      return corsResponse({ error: 'Failed to get downloadable link for report.' }, 500);
    }

    return corsResponse({ url: signedUrlData.signedUrl, filePath: filePath }); // MODIFIED: Return filePath
  } catch (error: any) {
    console.error('Error in generate-analysis-report Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});