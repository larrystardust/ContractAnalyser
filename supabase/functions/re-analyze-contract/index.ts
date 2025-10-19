import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts'; // ADDED

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

// ADDED: Cost for advanced analysis add-on
const ADVANCED_ANALYSIS_ADDON_COST = 1;

Deno.serve(async (req) => {
  // console.log('re-analyze-contract: Function started.'); // REMOVED

  if (req.method === 'OPTIONS') {
    // console.log('re-analyze-contract: OPTIONS request received.'); // REMOVED
    return corsResponse(null, 204);
  }

  if (req.method !== 'POST') {
    // console.log(`re-analyze-contract: Method not allowed: ${req.method}`); // REMOVED
    return corsResponse({ error: 'Method not allowed' }, 405);
  }

  let contractId: string;
  let token: string;
  let userId: string;
  let userEmail: string;
  let userPreferredLanguage: string = 'en'; // ADDED
  let performAdvancedAnalysis: boolean = false; // ADDED: Initialize new flag

  try {
    let requestBody;
    try {
      const rawBody = await req.text();
      // console.log('re-analyze-contract: Raw request body:', rawBody); // REMOVED
      if (rawBody) {
        requestBody = JSON.parse(rawBody);
      }
      // console.log('re-analyze-contract: Parsed requestBody:', requestBody); // REMOVED
    } catch (jsonParseError) {
      console.error('re-analyze-contract: JSON parsing error:', jsonParseError);
      return corsResponse({ error: 'Invalid JSON in request body.' }, 400);
    }

    contractId = requestBody.contract_id;
    // console.log('re-analyze-contract: Extracted contract_id:', contractId); // REMOVED

    if (!contractId) {
      // console.log('re-analyze-contract: Missing contract_id in request body.'); // REMOVED
      return corsResponse({ error: 'Missing contract_id' }, 400);
    }

    // Authenticate the user making the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      // console.log('re-analyze-contract: Authorization header missing.'); // REMOVED
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    token = authHeader.replace('Bearer ', '');
    // console.log('re-analyze-contract: Token extracted.'); // REMOVED

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('re-analyze-contract: Unauthorized: Invalid or missing user token:', userError?.message);
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }
    userId = user.id;
    userEmail = user.email!;
    
    // ADDED: Fetch user's preferred language
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('language_preference')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.warn('re-analyze-contract: Error fetching user profile for language:', profileError);
    } else if (profileData?.language_preference) {
      userPreferredLanguage = profileData.language_preference;
    }

    // Fetch the contract details, including contract_content and output_language
    // console.log(`re-analyze-contract: Fetching contract ${contractId} from database.`); // REMOVED
    const { data: contract, error: fetchContractError } = await supabase
      .from('contracts')
      .select('contract_content, user_id, jurisdictions, name, output_language') // MODIFIED: Added output_language
      .eq('id', contractId)
      .single();

    if (fetchContractError) {
      console.error('re-analyze-contract: Error fetching contract:', fetchContractError);
      return corsResponse({ error: getTranslatedMessage('error_contract_not_found', userPreferredLanguage) }, 404); // MODIFIED
    }
    // console.log('re-analyze-contract: Contract fetched successfully.'); // REMOVED

    // Ensure the authenticated user owns this contract
    if (contract.user_id !== user.id) {
      console.warn(`re-analyze-contract: Forbidden: User ${user.id} does not own contract ${contractId}.`);
      return corsResponse({ error: getTranslatedMessage('error_forbidden_contract_ownership', userPreferredLanguage) }, 403); // MODIFIED
    }
    // console.log('re-analyze-contract: User owns the contract.'); // REMOVED

    if (!contract.contract_content) {
      console.warn(`re-analyze-contract: Contract content not found for contract ${contractId}.`);
      return corsResponse({ error: getTranslatedMessage('error_contract_content_not_found', userPreferredLanguage) }, 404); // MODIFIED
    }
    // console.log('re-analyze-contract: Contract content found.'); // REMOVED

    // --- START: Authorization Logic for re-analysis ---
    // Re-analysis costs 1 credit for basic, +1 for advanced
    const BASIC_ANALYSIS_COST = 1;
    let ANALYSIS_COST = BASIC_ANALYSIS_COST;

    // ADDED: Determine if advanced analysis was performed on the original contract
    // For simplicity, we'll assume if the contract has any advanced fields populated,
    // it implies advanced analysis was performed. This is a temporary heuristic.
    // A better approach would be to store a `perform_advanced_analysis` flag in the `contracts` table.
    const { data: analysisResultData, error: fetchAnalysisResultError } = await supabase
      .from('analysis_results')
      .select('effective_date, termination_date, renewal_date, contract_type, contract_value, parties, liability_cap_summary, indemnification_clause_summary, confidentiality_obligations_summary') // MODIFIED: Select new fields
      .eq('contract_id', contractId)
      .maybeSingle();

    if (fetchAnalysisResultError) {
      console.warn('re-analyze-contract: Error fetching analysis result for advanced analysis check:', fetchAnalysisResultError);
    } else if (analysisResultData && (
      analysisResultData.effective_date || analysisResultData.termination_date || analysisResultData.renewal_date ||
      analysisResultData.contract_type || analysisResultData.contract_value || analysisResultData.parties ||
      analysisResultData.liability_cap_summary || analysisResultData.indemnification_clause_summary || analysisResultData.confidentiality_obligations_summary
    )) {
      performAdvancedAnalysis = true;
      ANALYSIS_COST += ADVANCED_ANALYSIS_ADDON_COST;
    }
    // END ADDED

    const { data: membershipData, error: membershipError } = await supabase
      .from('subscription_memberships')
      .select('subscription_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    let userSubscriptionId: string | null = null;
    if (membershipError) {
      console.error(`re-analyze-contract: Error fetching membership for user ${userId}:`, membershipError);
    } else if (membershipData) {
      userSubscriptionId = membershipData.subscription_id;
    }

    if (!userSubscriptionId) { // Only check credits if no active subscription
      const { data: customerData, error: customerError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (customerError || !customerData?.customer_id) {
        console.error(`re-analyze-contract: User ${userId} has no Stripe customer ID or error fetching:`, customerError);
        return corsResponse({ error: getTranslatedMessage('message_no_associated_payment_account', userPreferredLanguage) }, 403); // MODIFIED
      }

      const customerId = customerData.customer_id;

      const { data: unconsumedOrders, error: ordersError } = await supabase
        .from('stripe_orders')
        .select('id, credits_remaining')
        .eq('customer_id', customerId)
        .eq('payment_status', 'paid')
        .eq('status', 'completed')
        .gt('credits_remaining', 0)
        .order('created_at', { ascending: true }); // Order by creation to consume oldest first

      if (ordersError) {
        console.error('re-analyze-contract: Error fetching unconsumed orders:', ordersError);
        return corsResponse({ error: getTranslatedMessage('error_failed_to_check_available_credits', userPreferredLanguage) }, 500); // MODIFIED
      }

      let totalAvailableCredits = unconsumedOrders.reduce((sum, order) => sum + (order.credits_remaining || 0), 0);

      if (totalAvailableCredits < ANALYSIS_COST) {
        return corsResponse({ error: getTranslatedMessage('error_insufficient_credits_for_operation', userPreferredLanguage, { requiredCredits: ANALYSIS_COST, availableCredits: totalAvailableCredits }) }, 403); // MODIFIED
      }

      // Deduct credits from orders, starting with the oldest
      let remainingCost = ANALYSIS_COST;
      for (const order of unconsumedOrders) {
        if (remainingCost <= 0) break;

        const creditsInOrder = order.credits_remaining || 0;
        const deduction = Math.min(remainingCost, creditsInOrder);

        const { error: deductError } = await supabase
          .from('stripe_orders')
          .update({ credits_remaining: creditsInOrder - deduction })
          .eq('id', order.id);

        if (deductError) {
          console.error(`re-analyze-contract: Error deducting credits from order ${order.id}:`, deductError);
          throw new Error(getTranslatedMessage('error_failed_to_deduct_credits', userPreferredLanguage)); // MODIFIED
        }
        remainingCost -= deduction;
      }
    }
    // --- END: Authorization Logic for re-analysis ---

    // Update contract status to 'analyzing' and reset progress
    // console.log(`re-analyze-contract: Updating contract ${contractId} status to 'analyzing'.`); // REMOVED
    const { error: updateStatusError } = await supabase
      .from('contracts')
      .update({ status: 'analyzing', processing_progress: 0 })
      .eq('id', contractId);

    if (updateStatusError) {
      console.error('re-analyze-contract: Error updating contract status for re-analysis:', updateStatusError);
      // Continue, but log the error
    }
    // console.log('re-analyze-contract: Contract status updated.'); // REMOVED

    // ADDED: Log activity - Re-analysis Initiated
    await logActivity(
      supabase,
      userId,
      'CONTRACT_REANALYSIS_INITIATED',
      `User ${userEmail} initiated re-analysis for contract ID: ${contractId}`,
      { contract_id: contractId, perform_advanced_analysis: performAdvancedAnalysis } // MODIFIED: Log new flag
    );

    // Invoke the main contract-analyzer Edge Function
    // console.log('re-analyze-contract: Invoking contract-analyzer Edge Function.'); // REMOVED
    const { data: analysisResponse, error: analysisError } = await supabase.functions.invoke('contract-analyzer', {
      body: {
        contract_id: contractId,
        contract_text: contract.contract_content,
        source_language: 'auto', // Assume auto-detect for re-analysis
        output_language: contract.output_language || 'en', // Use contract's output language
        original_contract_name: contract.name,
        image_data: undefined, // No image data for re-analysis
        perform_ocr_flag: false, // No OCR for re-analysis
        perform_analysis: true, // Always perform analysis for re-analysis
        perform_advanced_analysis: performAdvancedAnalysis, // ADDED: Pass new flag
        credit_cost: ANALYSIS_COST, // Pass the cost for analysis
      },
      headers: {
        'Authorization': `Bearer ${token}`, // Pass the original user's token
      },
    });

    if (analysisError) {
      console.error('re-analyze-contract: Error invoking contract-analyzer for re-analysis:', analysisError);

      if (analysisError.name === 'FunctionsHttpError' && analysisError.context) {
        let errorMessage = getTranslatedMessage('error_forbidden_action', userPreferredLanguage); // MODIFIED
        try {
          const errorBody = await analysisError.context.json();
          if (errorBody && errorBody.error) {
            errorMessage = errorBody.error;
          }
        } catch (parseError) {
          console.warn('re-analyze-contract: Could not parse contract-analyzer 403 error response body:', parseError);
        }
        return corsResponse({ error: errorMessage }, 403);
      }

      return corsResponse({ error: getTranslatedMessage('error_failed_to_reanalyze_contract', userPreferredLanguage, { message: analysisError.message }) }, 500); // MODIFIED
    }
    // console.log('re-analyze-contract: contract-analyzer invoked successfully.'); // REMOVED

    // console.log('re-analyze-contract: Re-analysis initiated successfully.'); // REMOVED
    return corsResponse({ message: getTranslatedMessage('message_reanalysis_initiated_successfully', userPreferredLanguage), analysis_response: analysisResponse }); // MODIFIED

  } catch (error: any) {
    console.error('re-analyze-contract: Unhandled error in Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});