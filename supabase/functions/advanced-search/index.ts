import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(null, 204);
  }

  if (req.method !== 'POST') {
    return corsResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const {
      searchTerm,
      contractTypeFilter,
      partiesFilter,
      effectiveDateStart,
      effectiveDateEnd,
      terminationDateStart,
      terminationDateEnd,
      renewalDateStart,
      renewalDateEnd,
      liabilityCapFilter,
      indemnificationFilter,
      confidentialityFilter,
    } = await req.json();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }

    let query = supabase
      .from('contracts')
      .select(`
        *,
        analysis_results (
          *,
          findings(*),
          effective_date,
          termination_date,
          renewal_date,
          contract_type,
          contract_value,
          parties,
          liability_cap_summary,
          indemnification_clause_summary,
          confidentiality_obligations_summary
        )
      `)
      .eq('user_id', user.id);

    // Apply basic search term filter
    if (searchTerm) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      query = query.or(`name.ilike.%${lowercasedSearchTerm}%,translated_name.ilike.%${lowercasedSearchTerm}%`);
    }

    // Apply advanced filters on analysis_results
    // Note: This assumes a single analysis_result per contract or filters on the first one.
    // For more complex scenarios, you might need to join and filter differently.
    if (contractTypeFilter) {
      query = query.filter('analysis_results.contract_type', 'ilike', `%${contractTypeFilter}%`);
    }
    if (partiesFilter) {
      query = query.filter('analysis_results.parties', 'cs', `{${partiesFilter}}`); // 'cs' for contains string in array
    }
    if (effectiveDateStart) {
      query = query.gte('analysis_results.effective_date', effectiveDateStart);
    }
    if (effectiveDateEnd) {
      query = query.lte('analysis_results.effective_date', effectiveDateEnd);
    }
    if (terminationDateStart) {
      query = query.gte('analysis_results.termination_date', terminationDateStart);
    }
    if (terminationDateEnd) {
      query = query.lte('analysis_results.termination_date', terminationDateEnd);
    }
    if (renewalDateStart) {
      query = query.gte('analysis_results.renewal_date', renewalDateStart);
    }
    if (renewalDateEnd) {
      query = query.lte('analysis_results.renewal_date', renewalDateEnd);
    }
    if (liabilityCapFilter) {
      query = query.filter('analysis_results.liability_cap_summary', 'ilike', `%${liabilityCapFilter}%`);
    }
    if (indemnificationFilter) {
      query = query.filter('analysis_results.indemnification_clause_summary', 'ilike', `%${indemnificationFilter}%`);
    }
    if (confidentialityFilter) {
      query = query.filter('analysis_results.confidentiality_obligations_summary', 'ilike', `%${confidentialityFilter}%`);
    }

    const { data: contracts, error: fetchError } = await query.order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching contracts with advanced filters:', fetchError);
      return corsResponse({ error: 'Failed to fetch contracts with advanced filters.' }, 500);
    }

    // Map the data to a more usable format for the frontend, similar to ContractContext
    const formattedContracts = contracts.map((dbContract: any) => {
      const sortedAnalysisResults = dbContract.analysis_results
        ? [...dbContract.analysis_results].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        : [];
      
      const analysisResultData = sortedAnalysisResults.length > 0
        ? sortedAnalysisResults[0]
        : undefined;

      return {
        id: dbContract.id,
        user_id: dbContract.user_id,
        name: dbContract.name,
        translated_name: dbContract.translated_name,
        file_path: dbContract.file_path,
        original_file_type: dbContract.original_file_type,
        size: dbContract.size,
        jurisdictions: dbContract.jurisdictions,
        status: dbContract.status,
        processing_progress: dbContract.processing_progress,
        created_at: dbContract.created_at,
        updated_at: dbContract.updated_at,
        subscription_id: dbContract.subscription_id,
        contract_content: dbContract.contract_content,
        output_language: dbContract.output_language,
        analysisResult: analysisResultData ? {
          id: analysisResultData.id,
          contract_id: analysisResultData.contract_id,
          executiveSummary: analysisResultData.executive_summary,
          dataProtectionImpact: analysisResultData.data_protection_impact,
          complianceScore: analysisResultData.compliance_score,
          created_at: analysisResultData.created_at,
          updated_at: analysisResultData.updated_at,
          findings: (analysisResultData.findings || []).map((dbFinding: any) => ({
            id: dbFinding.id,
            analysis_result_id: dbFinding.analysis_result_id,
            title: dbFinding.title,
            description: dbFinding.description,
            riskLevel: dbFinding.risk_level,
            jurisdiction: dbFinding.jurisdiction,
            category: dbFinding.category,
            recommendations: dbFinding.recommendations,
            clauseReference: dbFinding.clause_reference,
          })),
          jurisdictionSummaries: analysisResultData.jurisdiction_summaries || {},
          reportFilePath: analysisResultData.report_file_path,
          effectiveDate: analysisResultData.effective_date,
          terminationDate: analysisResultData.termination_date,
          renewalDate: analysisResultData.renewal_date,
          contractType: analysisResultData.contract_type,
          contractValue: analysisResultData.contract_value,
          parties: analysisResultData.parties,
          liabilityCapSummary: analysisResultData.liability_cap_summary,
          indemnificationClauseSummary: analysisResultData.indemnification_clause_summary,
          confidentialityObligationsSummary: analysisResultData.confidentiality_obligations_summary,
        } : undefined,
      };
    });

    return corsResponse({ contracts: formattedContracts });

  } catch (error: any) {
    console.error('Error in advanced-search Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});