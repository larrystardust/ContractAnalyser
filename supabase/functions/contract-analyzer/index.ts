import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import OpenAI from 'npm:openai@4.53.0'; // Use the correct version

// Initialize Supabase client with service role key for elevated privileges
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')!,
});

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

  let contractId: string;
  let contractText: string;
  let userId: string;
  let userEmail: string;
  let userName: string | null = null;
  let userSubscriptionId: string | null = null;
  let userNotificationSettings: Record<string, { email: boolean; inApp: boolean }> = {};
  let token: string; // Moved token declaration to this scope

  try {
    const { contract_id, contract_text } = await req.json();
    contractId = contract_id;
    contractText = contract_text;

    if (!contractId || !contractText) {
      return corsResponse({ error: 'Missing contract_id or contract_text' }, 400);
    }

    // Get user ID from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    token = authHeader.replace('Bearer ', ''); // Assignment here
    
    // Validate token is not empty or literal strings
    if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
      return corsResponse({ error: 'Invalid or empty authentication token' }, 401);
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }
    userId = user.id;
    userEmail = user.email!;

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, notification_settings')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.warn(`Could not fetch profile for user ${userId}:`, profileError.message);
    } else {
      if (profileData?.full_name) {
        userName = profileData.full_name;
      }
      if (profileData?.notification_settings) {
        userNotificationSettings = profileData.notification_settings as Record<string, { email: boolean; inApp: boolean }>;
      }
    }

    const { data: membershipData, error: membershipError } = await supabase
      .from('subscription_memberships')
      .select('subscription_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) {
      console.error(`Error fetching membership for user ${userId}:`, membershipError);
    } else if (membershipData) {
      userSubscriptionId = membershipData.subscription_id;
      console.log(`User ${userId} is associated with subscription: ${userSubscriptionId} via membership.`);
    } else {
      console.log(`User ${userId} has no active membership.`);
    }

  } catch (error) {
    console.error('Error parsing request body or authenticating user:', error);
    return corsResponse({ error: 'Invalid request or authentication failed' }, 400);
  }

  console.log(`Starting analysis for contract ID: ${contractId} by user: ${userId}`);

  let consumedOrderId: number | null = null;

  // --- START: Authorization Logic ---
  if (userSubscriptionId) {
    console.log(`User ${userId} is authorized via active subscription: ${userSubscriptionId}.`);
  } else {
    console.log(`User ${userId} is not part of a multi-user subscription. Checking for single-use credits.`);

    const { data: customerData, error: customerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (customerError || !customerData?.customer_id) {
      console.error(`User ${userId} has no Stripe customer ID or error fetching:`, customerError);
      return corsResponse({ error: 'No associated payment account found. Please ensure you have purchased a plan.' }, 403);
    }

    const customerId = customerData.customer_id;

    const { data: unconsumedOrders, error: ordersError } = await supabase
      .from('stripe_orders')
      .select('id')
      .eq('customer_id', customerId)
      .eq('is_consumed', false)
      .eq('payment_status', 'paid')
      .eq('status', 'completed')
      .limit(1);

    if (ordersError) {
      console.error('Error fetching unconsumed orders:', ordersError);
      return corsResponse({ error: 'Failed to check available credits.' }, 500);
    }

    if (!unconsumedOrders || unconsumedOrders.length === 0) {
      console.log(`User ${userId} has no available single-use credits.`);
      return corsResponse({ error: 'No active subscription or available single-use credits. Please purchase a plan to analyze more contracts.' }, 403);
    } else {
      consumedOrderId = unconsumedOrders[0].id;
      console.log(`User ${userId} authorized via single-use credit: ${consumedOrderId}.`);
    }
  }
  // --- END: Authorization Logic ---

  try {
    await supabase
      .from('contracts')
      .update({ status: 'analyzing', processing_progress: 10 })
      .eq('id', contractId);

    await supabase.from('contracts').update({ processing_progress: 30 }).eq('id', contractId);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a legal contract analysis AI with the expertise of a professional legal practitioner with 30 years of experience in contract law. Analyze the provided contract text. Your role is to conduct a deep, thorough analysis of the provided contract text and provide an executive summary, data protection impact, overall compliance score (0-100), and a list of specific findings. Each finding should include a title, description, risk level (high, medium, low, none), jurisdiction (UK, Ireland, Malta, Cyprus, EU, US, Canada, Australia), category (compliance, risk, data-protection, enforceability, drafting, commercial), recommendations (as an array of strings), and an optional clause reference. You must use the following checklist as your internal review framework to ensure completeness:

CHECKLIST FOR ANALYSIS (INTERNAL GUIDANCE – DO NOT OUTPUT VERBATIM):  
1. Preliminary Review – name of the parties, capacity, purpose, authority, formality.  
2. Core Business Terms – subject matter, price/consideration, performance obligations, duration/renewal.  
3. Risk Allocation – warranties, representations, indemnities, liability caps, insurance.  
4. Conditions & Contingencies – conditions precedent, conditions subsequent, force majeure, change in law.  
5. Rights & Protections – termination rights, remedies, confidentiality, IP ownership/licensing, exclusivity, assignment/subcontracting.  
6. Compliance & Enforceability – governing law, jurisdiction, dispute resolution, regulatory compliance (data, consumer, competition law), illegality risks.  
7. Commercial Fairness & Practicality – balance of obligations, feasibility, ambiguities, consistency with other agreements.  
8. Drafting Quality – definitions, clarity, precision, consistency, appendices/schedules, entire agreement.  
9. Execution & Post-Signing – proper signatories, witnessing, notarization, ongoing obligations, survival clauses.  
10. Red Flags – unilateral termination, unlimited liability, hidden auto-renewals, one-sided indemnities, penalty clauses, unfavorable law/jurisdiction, biased dispute resolution.  

COMPLIANCE SCORE RULES (MANDATORY):  
- Start from 100 points.  
- Deduct points as follows:  
  • Each **High risk** finding = –15 points  
  • Each **Medium risk** finding = –8 points  
  • Each **Low risk** finding = –3 points  
  • Each **None** finding = 0 points (no deduction)  
- Minimum score is 0.  
- After deductions, round to the nearest whole number.  
- Ensure the score reflects overall risk exposure and enforceability of the contract.  

OUTPUT REQUIREMENTS:  
Return your findings strictly as a valid JSON object with the following structure:  

{
  "executiveSummary": "...",
  "dataProtectionImpact": "...",
  "complianceScore": 0,
  "findings": [
    {
      "title": "...",
      "description": "...",
      "riskLevel": "high",
      "jurisdiction": "UK",
      "category": "compliance",
      "recommendations": ["...", "..."],
      "clauseReference": "..."
    }
  ],
  "jurisdictionSummaries": {
    "UK": {
      "jurisdiction": "UK",
      "applicableLaws": ["...", "..."],
      "keyFindings": ["...", "..."],
      "riskLevel": "high"
    }
  }
}

NOTES:  
- Ensure the JSON is valid and strictly adheres to the specified structure.  
- Do not include any text outside the JSON object.  
- Always populate each field (if information is missing, provide your best inference).  
- Risk levels must be one of: high, medium, low, none.  
- Categories must be one of: compliance, risk, data-protection, enforceability, drafting, commercial. 
- Apply the compliance score rules consistently to every analysis.`,
        },
        {
          role: "user",
          content: `Contract Text:\n\n${contractText}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const aiResponseContent = completion.choices[0].message?.content;
    if (!aiResponseContent) {
      throw new Error('No content received from OpenAI API.');
    }

    let analysisData: any;
    try {
      analysisData = JSON.parse(aiResponseContent);
    } catch (parseError) {
      console.error('Error parsing OpenAI response JSON:', parseError);
      throw new Error('Failed to parse AI analysis response.');
    }

    const executiveSummary = typeof analysisData.executiveSummary === 'string' ? analysisData.executiveSummary : 'No executive summary provided.';
    const dataProtectionImpact = typeof analysisData.dataProtectionImpact === 'string' ? analysisData.dataProtectionImpact : null;
    const complianceScore = typeof analysisData.complianceScore === 'number' ? analysisData.complianceScore : 0;
    const findings = Array.isArray(analysisData.findings) ? analysisData.findings : [];
    const jurisdictionSummaries = typeof analysisData.jurisdictionSummaries === 'object' && analysisData.jurisdictionSummaries !== null ? analysisData.jurisdictionSummaries : {};

    await supabase.from('contracts').update({ processing_progress: 70 }).eq('id', contractId);

    // --- START: Generate and Store Report HTML ---
    // Call the generate-analysis-report function to get the report URL and path
    const { data: reportData, error: reportError } = await supabase.functions.invoke('generate-analysis-report', {
      body: {
        contractId: contractId,
        contractName: (await supabase.from('contracts').select('name').eq('id', contractId).single()).data?.name || 'Unknown Contract',
        analysisResult: {
          executive_summary: executiveSummary,
          data_protection_impact: dataProtectionImpact,
          compliance_score: complianceScore,
          jurisdiction_summaries: jurisdictionSummaries,
          findings: findings,
        },
      },
      headers: {
        // Pass the current user's token for authorization within generate-analysis-report
        'Authorization': `Bearer ${token}`,
      },
    });

    if (reportError) {
      console.error('Error invoking generate-analysis-report Edge Function:', reportError);
      // Do not throw, allow analysis to complete, but report path will be null
    }
    const reportFilePath = reportData?.filePath || null; // Get the file path from the response
    // --- END: Generate and Store Report HTML ---

    const { data: analysisResult, error: analysisError } = await supabase
      .from('analysis_results')
      .insert({
        contract_id: contractId,
        executive_summary: executiveSummary,
        data_protection_impact: dataProtectionImpact,
        compliance_score: complianceScore,
        jurisdiction_summaries: jurisdictionSummaries,
        report_file_path: reportFilePath, // ADDED: Store the report file path
      })
      .select()
      .single();

    if (analysisError) {
      throw analysisError;
    }

    const findingsToInsert = findings.map((finding: any) => ({
      analysis_result_id: analysisResult.id,
      title: typeof finding.title === 'string' ? finding.title : 'Untitled Finding',
      description: typeof finding.description === 'string' ? finding.description : 'No description provided.',
      risk_level: typeof finding.riskLevel === 'string' ? finding.riskLevel : 'none',
      jurisdiction: typeof finding.jurisdiction === 'string' ? finding.jurisdiction : 'EU',
      category: typeof finding.category === 'string' ? finding.category : 'risk',
      recommendations: Array.isArray(finding.recommendations) ? finding.recommendations : [],
      clause_reference: typeof finding.clauseReference === 'string' ? finding.clauseReference : null,
    }));

    if (findingsToInsert.length > 0) {
      const { error: findingsError } = await supabase
        .from('findings')
        .insert(findingsToInsert);

      if (findingsError) {
        console.error('Error inserting findings:', findingsError);
      }
    }

    const { error: updateContractError } = await supabase
      .from('contracts')
      .update({ status: 'completed', processing_progress: 100, subscription_id: userSubscriptionId })
      .eq('id', contractId);

    if (updateContractError) {
      console.error(`Error updating contract status to completed for ID ${contractId}:`, updateContractError);
      await supabase
        .from('contracts')
        .update({ status: 'failed', processing_progress: 0 })
        .eq('id', contractId);
      throw new Error(`Failed to finalize contract status: ${updateContractError.message}`);
    }

    if (consumedOrderId !== null) {
      const { error: consumeError } = await supabase
        .from('stripe_orders')
        .update({ is_consumed: true })
        .eq('id', consumedOrderId);

      if (consumeError) {
        console.error(`Error marking order ${consumedOrderId} as consumed:`, consumeError);
      } else {
        console.log(`Successfully marked order ${consumedOrderId} as consumed.`);
      }
    }

    const sendEmailReport = userNotificationSettings['analysis-complete']?.email === true;

    if (sendEmailReport) {
      console.log(`User ${userId} has email reports enabled for analysis complete. Triggering email send.`);
      
      const { data: emailFnData, error: emailFnError } = await supabase.functions.invoke('send-analysis-report-email', {
        body: {
          userId: userId,
          contractId: contractId,
          recipientEmail: userEmail,
          reportSummary: executiveSummary,
          reportLink: `${Deno.env.get('APP_BASE_URL')}/dashboard?contractId=${contractId}`,
          userName: userName,
          sendEmail: true,
        },
      });

      if (emailFnError) {
        console.error('Error invoking send-analysis-report-email Edge Function:', emailFnError);
      } else {
        console.log('send-analysis-report-email Edge Function invoked successfully:', emailFnData);
      }
    }

    console.log(`Analysis completed for contract ID: ${contractId}`);
    return corsResponse({ message: 'Analysis completed successfully' });

  } catch (error: any) {
    console.error(`Error during analysis for contract ID ${contractId}:`, error.message);
    await supabase
      .from('contracts')
      .update({ status: 'failed', processing_progress: 0 })
      .eq('id', contractId);
    return corsResponse({ error: error.message }, 500);
  }
});