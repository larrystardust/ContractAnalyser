import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts'; // ADDED

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
  let userId: string; // ADDED
  let userEmail: string; // ADDED

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
    userId = user.id; // ADDED
    userEmail = user.email!; // ADDED
    // console.log('re-analyze-contract: User authenticated:', user.id); // REMOVED

    // Fetch the contract details, including contract_content
    // console.log(`re-analyze-contract: Fetching contract ${contractId} from database.`); // REMOVED
    const { data: contract, error: fetchContractError } = await supabase
      .from('contracts')
      .select('contract_content, user_id')
      .eq('id', contractId)
      .single();

    if (fetchContractError) {
      console.error('re-analyze-contract: Error fetching contract:', fetchContractError);
      return corsResponse({ error: 'Contract not found or failed to fetch content.' }, 404);
    }
    // console.log('re-analyze-contract: Contract fetched successfully.'); // REMOVED

    // Ensure the authenticated user owns this contract
    if (contract.user_id !== user.id) {
      console.warn(`re-analyze-contract: Forbidden: User ${user.id} does not own contract ${contractId}.`);
      return corsResponse({ error: 'Forbidden: You do not own this contract.' }, 403);
    }
    // console.log('re-analyze-contract: User owns the contract.'); // REMOVED

    if (!contract.contract_content) {
      console.warn(`re-analyze-contract: Contract content not found for contract ${contractId}.`);
      return corsResponse({ error: 'Contract content not found for re-analysis.' }, 404);
    }
    // console.log('re-analyze-contract: Contract content found.'); // REMOVED

    // --- START: Authorization Logic for re-analysis ---
    // Check for active subscription
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

    let consumedOrderId: number | null = null;
    if (!userSubscriptionId) {
      // If no active subscription, check for single-use credits
      const { data: customerData, error: customerError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (customerError || !customerData?.customer_id) {
        console.error(`re-analyze-contract: User ${userId} has no Stripe customer ID or error fetching:`, customerError);
        return corsResponse({ error: 'No associated payment account found. Please ensure you have purchased a plan.' }, 403);
      }

      const customerId = customerData.customer_id;

      // MODIFIED: Check for credits_remaining > 0 instead of is_consumed = false
      const { data: unconsumedOrders, error: ordersError } = await supabase
        .from('stripe_orders')
        .select('id, credits_remaining')
        .eq('customer_id', customerId)
        .eq('payment_status', 'paid')
        .eq('status', 'completed')
        .gt('credits_remaining', 0) // MODIFIED: Check for credits_remaining > 0
        .limit(1);

      if (ordersError) {
        console.error('re-analyze-contract: Error fetching unconsumed orders:', ordersError);
        return corsResponse({ error: 'Failed to check available credits.' }, 500);
      }

      if (!unconsumedOrders || unconsumedOrders.length === 0) {
        return corsResponse({ error: 'No active subscription or available single-use credits. Please purchase a plan to re-analyze contracts.' }, 403);
      } else {
        consumedOrderId = unconsumedOrders.id;
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
      { contract_id: contractId }
    );

    // Invoke the main contract-analyzer Edge Function
    // console.log('re-analyze-contract: Invoking contract-analyzer Edge Function.'); // REMOVED
    const { data: analysisResponse, error: analysisError } = await supabase.functions.invoke('contract-analyzer', {
      body: {
        contract_id: contractId,
        contract_text: contract.contract_content,
      },
      headers: {
        'Authorization': `Bearer ${token}`, // Pass the original user's token
      },
    });

    if (analysisError) {
      console.error('re-analyze-contract: Error invoking contract-analyzer for re-analysis:', analysisError);

      // Check if the error is a FunctionsHttpError with a 403 status
      if (analysisError.name === 'FunctionsHttpError' && analysisError.context && analysisError.context.status === 403) {
        let errorMessage = 'Forbidden: You do not have permission to perform this action.';
        try {
          // Attempt to read the response body for a more specific message
          const errorBody = await analysisError.context.json();
          if (errorBody && errorBody.error) {
            errorMessage = errorBody.error;
          }
        } catch (parseError) {
          console.warn('re-analyze-contract: Could not parse contract-analyzer 403 error response body:', parseError);
        }
        return corsResponse({ error: errorMessage }, 403); // Propagate the 403 with specific message
      }

      return corsResponse({ error: `Failed to re-analyze contract: ${analysisError.message}` }, 500);
    }
    // console.log('re-analyze-contract: contract-analyzer invoked successfully.'); // REMOVED

    // MODIFIED: Decrement credits_remaining for single-use orders after successful re-analysis
    if (consumedOrderId !== null) {
      const { data: orderData, error: fetchOrderError } = await supabase
        .from('stripe_orders')
        .select('credits_remaining')
        .eq('id', consumedOrderId)
        .single();

      if (fetchOrderError) {
        console.error(`re-analyze-contract: Error fetching order ${consumedOrderId} for decrement:`, fetchOrderError);
      } else if (orderData) {
        const { error: decrementError } = await supabase
          .from('stripe_orders')
          .update({ credits_remaining: orderData.credits_remaining - 1 })
          .eq('id', consumedOrderId);

        if (decrementError) {
          console.error(`re-analyze-contract: Error decrementing credits_remaining for order ${consumedOrderId}:`, decrementError);
        } else {
          // console.log(`re-analyze-contract: Successfully decremented credits_remaining for order ${consumedOrderId}.`); // REMOVED
        }
      }
    }

    // console.log('re-analyze-contract: Re-analysis initiated successfully.'); // REMOVED
    return corsResponse({ message: 'Re-analysis initiated successfully', analysis_response: analysisResponse });

  } catch (error: any) {
    console.error('re-analyze-contract: Unhandled error in Edge Function:', error);
    return corsResponse({ error: error.message }, 500);
  }
});