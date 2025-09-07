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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return corsResponse({ error: 'Forbidden: User is not an administrator' }, 403);
    }

    // Fetch all contracts with their associated analysis results, findings, and user details
    const { data: contractsData, error: fetchContractsError } = await supabase
      .from('contracts')
      .select(`
        id,
        name,
        file_path,
        size,
        jurisdictions,
        status,
        processing_progress,
        created_at,
        updated_at,
        marked_for_deletion_by_admin,
        user_id,
        profiles (full_name),
        users (email), // MODIFIED: Changed from auth_users:user_id (email)
        analysis_results (
          id,
          executive_summary,
          data_protection_impact,
          compliance_score,
          jurisdiction_summaries,
          report_file_path,
          findings (
            id,
            title,
            description,
            risk_level,
            jurisdiction,
            category,
            recommendations,
            clause_reference
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (fetchContractsError) {
      console.error('Error fetching contracts:', fetchContractsError);
      return corsResponse({ error: 'Failed to fetch contracts' }, 500);
    }

    // Map the data to a more usable format for the frontend
    const formattedContracts = contractsData.map(contract => {
      const latestAnalysisResult = contract.analysis_results && contract.analysis_results.length > 0
        ? contract.analysis_results[0] // Assuming the first one is the latest or only one
        : null;

      return {
        id: contract.id,
        name: contract.name,
        file_path: contract.file_path,
        size: contract.size,
        jurisdictions: contract.jurisdictions,
        status: contract.status,
        processing_progress: contract.processing_progress,
        created_at: contract.created_at,
        updated_at: contract.updated_at,
        marked_for_deletion_by_admin: contract.marked_for_deletion_by_admin,
        user_id: contract.user_id,
        user_full_name: contract.profiles?.full_name || 'N/A',
        user_email: contract.users?.email || 'N/A', // MODIFIED: Changed from auth_users?.email
        analysisResult: latestAnalysisResult ? {
          id: latestAnalysisResult.id,
          contract_id: contract.id,
          executiveSummary: latestAnalysisResult.executive_summary,
          dataProtectionImpact: latestAnalysisResult.data_protection_impact,
          complianceScore: latestAnalysisResult.compliance_score,
          jurisdictionSummaries: latestAnalysisResult.jurisdiction_summaries,
          reportFilePath: latestAnalysisResult.report_file_path,
          findings: latestAnalysisResult.findings.map(f => ({
            id: f.id,
            analysis_result_id: latestAnalysisResult.id,
            title: f.title,
            description: f.description,
            riskLevel: f.risk_level,
            jurisdiction: f.jurisdiction,
            category: f.category,
            recommendations: f.recommendations,
            clauseReference: f.clause_reference,
          })),
        } : null,
      };
    });

    return corsResponse({ contracts: formattedContracts });

  } catch (error: any) {
    console.error('Error in admin-get-all-contracts Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});