import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';

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

// Cost for advanced analysis add-on
const ADVANCED_ANALYSIS_ADDON_COST = 1;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(null, 204);
  }

  if (req.method !== 'POST') {
    return corsResponse({ error: 'Method not allowed' }, 405);
  }

  let contractId: string;
  let token: string;
  let userId: string;
  let userEmail: string;
  let userPreferredLanguage: string = 'en';
  let performAdvancedAnalysis: boolean = false;

  try {
    let requestBody;
    try {
      const rawBody = await req.text();
      if (rawBody) {
        requestBody = JSON.parse(rawBody);
      }
    } catch (jsonParseError) {
      console.error('re-analyze-contract: JSON parsing error:', jsonParseError);
      return corsResponse({ error: 'Invalid JSON in request body.' }, 400);
    }

    contractId = requestBody.contract_id;

    if (!contractId) {
      return corsResponse({ error: 'Missing contract_id' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('re-analyze-contract: Unauthorized: Invalid or missing user token:', userError?.message);
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }
    userId = user.id;
    userEmail = user.email!;
    
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

    const { data: contract, error: fetchContractError } = await supabase
      .from('contracts')
      .select('contract_content, user_id, jurisdictions, name, output_language')
      .eq('id', contractId)
      .single();

    if (fetchContractError) {
      console.error('re-analyze-contract: Error fetching contract:', fetchContractError);
      return corsResponse({ error: getTranslatedMessage('error_contract_not_found', userPreferredLanguage) }, 404);
    }

    if (contract.user_id !== user.id) {
      console.warn(`re-analyze-contract: Forbidden: User ${user.id} does not own contract ${contractId}.`);
      return corsResponse({ error: getTranslatedMessage('error_forbidden_contract_ownership', userPreferredLanguage) }, 403);
    }

    if (!contract.contract_content) {
      console.warn(`re-analyze-contract: Contract content not found for contract ${contractId}.`);
      return corsResponse({ error: getTranslatedMessage('error_contract_content_not_found', userPreferredLanguage) }, 404);
    }

    const BASIC_ANALYSIS_COST = 1;
    let ANALYSIS_COST = BASIC_ANALYSIS_COST;

    const { data: analysisResultData, error: fetchAnalysisResultError } = await supabase
      .from('analysis_results')
      .select('performed_advanced_analysis')
      .eq('contract_id', contractId)
      .maybeSingle();

    if (fetchAnalysisResultError) {
      console.warn('re-analyze-contract: Error fetching analysis result for advanced analysis check:', fetchAnalysisResultError);
    } else if (analysisResultData?.performed_advanced_analysis) {
      performAdvancedAnalysis = true;
      ANALYSIS_COST += ADVANCED_ANALYSIS_ADDON_COST;
    }

    const { data: membershipData, error: membershipError } = await supabase
      .from('subscription_memberships')
      .select('subscription_id, stripe_subscriptions(tier)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    let userSubscriptionId: string | null = null;
    let userSubscriptionTier: number | null = null;
    if (membershipError) {
      console.error(`re-analyze-contract: Error fetching membership for user ${userId}:`, membershipError);
    } else if (membershipData) {
      userSubscriptionId = membershipData.subscription_id;
      userSubscriptionTier = membershipData.stripe_subscriptions?.tier || null;
    } else {
      const { data: customerData, error: customerError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!customerError && customerData?.customer_id) {
        const { data: directSubData, error: directSubError } = await supabase
          .from('stripe_subscriptions')
          .select('subscription_id, tier')
          .eq('customer_id', customerData.customer_id)
          .eq('status', 'active')
          .maybeSingle();

        if (!directSubError && directSubData) {
          userSubscriptionId = directSubData.subscription_id;
          userSubscriptionTier = directSubData.tier || null;
        }
      }
    }

    if (!userSubscriptionId || (userSubscriptionTier !== null && userSubscriptionTier < 4)) {
      const { data: customerData, error: customerError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (customerError || !customerData?.customer_id) {
        console.error(`re-analyze-contract: User ${userId} has no Stripe customer ID or error fetching:`, customerError);
        return corsResponse({ error: getTranslatedMessage('message_no_associated_payment_account', userPreferredLanguage) }, 403);
      }

      const customerId = customerData.customer_id;

      const { data: unconsumedOrders, error: ordersError } = await supabase
        .from('stripe_orders')
        .select('id, credits_remaining')
        .eq('customer_id', customerId)
        .eq('payment_status', 'paid')
        .eq('status', 'completed')
        .gt('credits_remaining', 0)
        .order('created_at', { ascending: true });

      if (ordersError) {
        console.error('re-analyze-contract: Error fetching unconsumed orders:', ordersError);
        return corsResponse({ error: getTranslatedMessage('error_failed_to_check_available_credits', userPreferredLanguage) }, 500);
      }

      let totalAvailableCredits = unconsumedOrders.reduce((sum, order) => sum + (order.credits_remaining || 0), 0);

      if (totalAvailableCredits < ANALYSIS_COST) {
        return corsResponse({ error: getTranslatedMessage('error_insufficient_credits_for_operation', userPreferredLanguage, { requiredCredits: ANALYSIS_COST, availableCredits: totalAvailableCredits }) }, 403);
      }

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
          throw new Error(getTranslatedMessage('error_failed_to_deduct_credits', userPreferredLanguage));
        }
        remainingCost -= deduction;
      }
    }

    const { error: updateStatusError } = await supabase
      .from('contracts')
      .update({ status: 'analyzing', processing_progress: 0 })
      .eq('id', contractId);

    if (updateStatusError) {
      console.error('re-analyze-contract: Error updating contract status for re-analysis:', updateStatusError);
    }

    await logActivity(
      supabase,
      userId,
      'CONTRACT_REANALYSIS_INITIATED',
      `User ${userEmail} initiated re-analysis for contract ID: ${contractId}`,
      { contract_id: contractId, perform_advanced_analysis: performAdvancedAnalysis, user_tier: userSubscriptionTier }
    );

    const { data: analysisResponse, error: analysisError } = await supabase.functions.invoke('contract-analyzer', {
      body: {
        contract_id: contractId,
        contract_text: contract.contract_content,
        source_language: 'auto',
        output_language: contract.output_language || 'en',
        original_contract_name: contract.name,
        image_data: undefined,
        perform_ocr_flag: false,
        perform_analysis: true,
        perform_advanced_analysis: performAdvancedAnalysis,
        credit_cost: ANALYSIS_COST,
      },
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (analysisError) {
      console.error('re-analyze-contract: Error invoking contract-analyzer for re-analysis:', analysisError);

      if (analysisError.name === 'FunctionsHttpError' && analysisError.context) {
        let errorMessage = getTranslatedMessage('error_forbidden_action', userPreferredLanguage);
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

      return corsResponse({ error: getTranslatedMessage('error_failed_to_reanalyze_contract', userPreferredLanguage, { message: analysisError.message }) }, 500);
    }

    return corsResponse({ message: getTranslatedMessage('message_reanalysis_initiated_successfully', userPreferredLanguage), analysis_response: analysisResponse });

  } catch (error: any) {
    console.error('re-analyze-contract: Unhandled error in Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});