import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import OpenAI from 'npm:openai@4.53.0';
import Anthropic from 'npm:@anthropic-ai/sdk'; // ADDED: Import Anthropic
import { logActivity } from '../_shared/logActivity.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';
import { GoogleAuth } from 'npm:google-auth-library@9.10.0';

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')!,
});

// ADDED: Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
});

// Initialize Google Cloud Auth for Vision API
const googleClientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL');
const googlePrivateKey = Deno.env.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

if (!googleClientEmail || !googlePrivateKey) {
  console.warn('GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY environment variables are not fully set. OCR functionality may be limited or fail.');
}

const auth = new GoogleAuth({
  credentials: {
    client_email: googleClientEmail,
    private_key: googlePrivateKey,
  },
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

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

// Helper for retries
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retry attempt ${retries} failed. Retrying in ${delay}ms...`, error);
      await new Promise(res => setTimeout(res, delay));
      return retry(fn, retries - 1, delay * 2); // Exponential backoff
    }
    throw error;
  }
}

// Helper function for translation with improved prompt
async function translateText(text: string | null | undefined, targetLanguage: string): Promise<string> {
  if (!text || targetLanguage === 'en') { // No need to translate if empty or target is English
    return text || ''; // Ensure a string is always returned
  }

  try {
    const translationCompletion = await openai.chat.completions.create({
      model: "gpt-4o", // Use a capable model for translation
      messages: [
        {
          role: "system",
          // CRITICAL MODIFICATION: Instruct the LLM to only translate if necessary
          content: `You are a highly accurate language translator. Translate the following text into ${targetLanguage}. If the text is already in ${targetLanguage}, return the original text as is. Provide only the translated or original text. Do NOT include any additional commentary, formatting, or conversational filler.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.1, // Keep temperature low for accurate translation
      max_tokens: 1000, // Adjust as needed
    });
    const translatedContent = translationCompletion.choices[0].message?.content?.trim();
    // console.log(`translateText: Original: "${text}" -> Translated: "${translatedContent}"`); // REMOVED

    // If the translation is empty, return the original text as a fallback
    if (!translatedContent) {
      console.warn(`translateText: Empty translation received for "${text}". Returning original.`);
      return text; // Return original text on error
    }
    return translatedContent;
  } catch (error) {
    console.error(`translateText: Error translating text to ${targetLanguage}:`, error);
    return text; // Return original text on error
  }
}

// OCR function using Google Cloud Vision API
async function executeOcr(imageData: string, userPreferredLanguage: string): Promise<string> {
  const requestBody = {
    requests: [
      {
        image: {
          content: imageData,
        },
        features: [
          {
            type: 'DOCUMENT_TEXT_DETECTION', // Use DOCUMENT_TEXT_DETECTION for better OCR on documents
          },
        ],
      },
    ],
  };

  try {
    const accessTokenResult = await auth.getAccessToken();

    let tokenString: string | undefined;
    if (typeof accessTokenResult === 'string') {
      tokenString = accessTokenResult;
    } else if (accessTokenResult && typeof accessTokenResult === 'object' && accessTokenResult.token) {
      tokenString = accessTokenResult.token;
    }

    if (!tokenString) {
      throw new Error(getTranslatedMessage('error_failed_to_obtain_gcp_access_token', userPreferredLanguage));
    }

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenString}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorBody = await response.json();
      console.error('Google Vision API error:', errorBody);
      throw new Error(getTranslatedMessage('error_google_vision_api_failed', userPreferredLanguage, { message: errorBody.error?.message || 'Unknown error' }));
    }

    const result = await response.json();
    const extractedText = result.responses[0]?.fullTextAnnotation?.text;

    if (!extractedText) {
      throw new Error(getTranslatedMessage('error_no_text_extracted_from_image', userPreferredLanguage));
    }

    return extractedText;
  } catch (error) {
    console.error('Error performing OCR:', error);
    throw error;
  }
}

// Cost for advanced analysis add-on
const ADVANCED_ANALYSIS_ADDON_COST = 1;

// ADDED: Hashing function for caching
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hexHash;
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
  let sourceLanguage: string;
  let outputLanguage: string;
  let originalContractName: string;
  let userId: string;
  let userEmail: string;
  let userName: string | null = null;
  let userSubscriptionId: string | null = null;
  let userSubscriptionTier: number | null = null;
  let userNotificationSettings: Record<string, { email: boolean; inApp: boolean }> = {};
  let token: string;
  let userPreferredLanguage: string = 'en';

  let imageDatas: string[] | undefined;
  let shouldPerformOcr: boolean;
  let performAnalysis: boolean;
  let performAdvancedAnalysis: boolean;
  let creditCost: number;

  try {
    const {
      contract_id,
      contract_text,
      source_language,
      output_language,
      original_contract_name,
      image_datas,
      perform_ocr_flag,
      perform_analysis,
      perform_advanced_analysis,
      credit_cost,
    } = await req.json();

    contractId = contract_id;
    contractText = contract_text;
    sourceLanguage = source_language || 'auto';
    outputLanguage = output_language || 'en';
    originalContractName = original_contract_name;
    imageDatas = image_datas;
    shouldPerformOcr = perform_ocr_flag || false;
    performAnalysis = perform_analysis || false;
    performAdvancedAnalysis = perform_advanced_analysis || false;
    creditCost = credit_cost || 0;

    if (!contractId || (!contractText && (!imageDatas || imageDatas.length === 0))) {
      return corsResponse({ error: 'Missing contract_id and either contract_text or image_datas' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsResponse({ error: 'Authorization header missing' }, 401);
    }
    token = authHeader.replace('Bearer ', '');
    
    if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
      return corsResponse({ error: 'Invalid or empty authentication token' }, 401);
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }
    userId = user.id;
    userEmail = user.email!;

    const { data: profileData, error: profileError } = await retry(async () => {
      return await supabase
        .from('profiles')
        .select('full_name, notification_settings, language_preference')
        .eq('id', userId)
        .maybeSingle();
    }, 5, 500);

    const defaultNotificationSettings = {
      'analysis-complete': { email: true, inApp: true },
      'high-risk-findings': { email: true, inApp: true },
      'weekly-reports': { email: false, inApp: false },
      'system-updates': { email: false, inApp: true },
    };

    if (profileError) {
      console.warn(`contract-analyzer: Could not fetch profile for user ${userId}:`, profileError.message);
      userNotificationSettings = defaultNotificationSettings;
    } else {
      if (profileData?.full_name) {
        userName = profileData.full_name;
      }
      userNotificationSettings = {
        ...defaultNotificationSettings,
        ...(profileData?.notification_settings as Record<string, { email: boolean; inApp: boolean }> || {}),
      };
      userPreferredLanguage = profileData?.language_preference || outputLanguage;
    }

    const { data: membershipData, error: membershipError } = await supabase
      .from('subscription_memberships')
      .select('subscription_id, stripe_subscriptions(tier)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) {
      console.error(`contract-analyzer: Error fetching membership for user ${userId}:`, membershipError);
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

  } catch (error) {
    console.error('contract-analyzer: Error parsing request body or authenticating user:', error);
    return corsResponse({ error: 'Invalid request or authentication failed' }, 400);
  }

  let consumedOrderId: number | null = null;

  // --- START: Authorization Logic & Credit Deduction ---
  console.log(`contract-analyzer: DEBUG - User ${userId} (Tier: ${userSubscriptionTier}) requested analysis.`);
  console.log(`contract-analyzer: DEBUG - performAdvancedAnalysis: ${performAdvancedAnalysis}, creditCost from frontend: ${creditCost}`);

  const isAdvancedPlanUser = userSubscriptionTier !== null && (userSubscriptionTier === 4 || userSubscriptionTier === 5);
  const isBasicPlanUser = userSubscriptionTier !== null && (userSubscriptionTier === 2 || userSubscriptionTier === 3);

  // Deduct credits if:
  // 1. User is on a single-use plan (no subscription)
  // 2. User is on a basic plan (tier 2 or 3) AND advanced analysis is requested.
  const shouldDeductCredits = !userSubscriptionId || (isBasicPlanUser && performAdvancedAnalysis);

  if (shouldDeductCredits) {
    console.log(`contract-analyzer: DEBUG - User is NOT on an advanced plan (Tier < 4 or no subscription) OR is on a basic plan requesting advanced analysis. Proceeding with credit deduction check.`);

    const { data: customerData, error: customerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (customerError || !customerData?.customer_id) {
      console.error(`contract-analyzer: User ${userId} has no Stripe customer ID or error fetching:`, customerError);
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
      .order('created_at', { ascending: true }); // Order by creation to consume oldest first

    if (ordersError) {
      console.error('contract-analyzer: Error fetching unconsumed orders:', ordersError);
      return corsResponse({ error: getTranslatedMessage('error_failed_to_check_available_credits', userPreferredLanguage) }, 500);
    }

    let totalAvailableCredits = unconsumedOrders.reduce((sum, order) => sum + (order.credits_remaining || 0), 0);

    console.log(`contract-analyzer: DEBUG - Customer ${customerId} has ${totalAvailableCredits} available credits. Required: ${creditCost}`);

    if (totalAvailableCredits < creditCost) {
      console.warn(`contract-analyzer: DEBUG - Insufficient credits for user ${userId}. Available: ${totalAvailableCredits}, Required: ${creditCost}`);
      return corsResponse({ error: getTranslatedMessage('error_insufficient_credits_for_operation', userPreferredLanguage, { requiredCredits: creditCost, availableCredits: totalAvailableCredits }) }, 403);
    }

    // Deduct credits from orders, starting with the oldest
    let remainingCost = creditCost;
    for (const order of unconsumedOrders) {
      if (remainingCost <= 0) break;

      const creditsInOrder = order.credits_remaining || 0;
      const deduction = Math.min(remainingCost, creditsInOrder);

      console.log(`contract-analyzer: DEBUG - Deducting ${deduction} from order ${order.id} (Credits in order: ${creditsInOrder}). Remaining cost: ${remainingCost - deduction}`);

      const { error: deductError } = await supabase
        .from('stripe_orders')
        .update({ credits_remaining: creditsInOrder - deduction })
        .eq('id', order.id);

      if (deductError) {
        console.error(`contract-analyzer: Error deducting credits from order ${order.id}:`, deductError);
        throw new Error(getTranslatedMessage('error_failed_to_deduct_credits', userPreferredLanguage));
      }
      remainingCost -= deduction;
      consumedOrderId = order.id; // Keep track of the last order credits were consumed from
    }
    console.log(`contract-analyzer: DEBUG - Credit deduction completed. Final remaining cost: ${remainingCost}`);
  } else {
    console.log(`contract-analyzer: DEBUG - User ${userId} is on an advanced plan (Tier 4 or 5) or a basic plan not requesting advanced analysis. Skipping credit deduction.`);
  }
  // --- END: Authorization Logic & Credit Deduction ---

  let translatedContractName: string = originalContractName;

  try {
    await logActivity(
      supabase,
      userId,
      'CONTRACT_ANALYSIS_STARTED',
      `User ${userEmail} started analysis for contract ID: ${contractId}`,
      { contract_id: contractId, perform_ocr: shouldPerformOcr, perform_analysis: performAnalysis, perform_advanced_analysis: performAdvancedAnalysis, credit_cost: creditCost, user_tier: userSubscriptionTier }
    );

    await supabase
      .from('contracts')
      .update({ status: 'analyzing', processing_progress: 10 })
      .eq('id', contractId);

    const { data: contractDetails, error: fetchContractError } = await supabase
      .from('contracts')
      .select('contract_content, user_id, jurisdictions, name, output_language, file_path')
      .eq('id', contractId)
      .single();

    if (fetchContractError) {
      console.error('contract-analyzer: Error fetching contract details:', fetchContractError);
      throw new Error(getTranslatedMessage('error_failed_to_fetch_contract_details', userPreferredLanguage));
    }

    const userSelectedJurisdictions = contractDetails.jurisdictions.join(', ');
    const fetchedContractName = contractDetails.name;

    let processedContractText = contractText;

    if (shouldPerformOcr) {
      await supabase.from('contracts').update({ processing_progress: 20 }).eq('id', contractId);
      let ocrImageDatas: string[] = [];

      if (imageDatas && imageDatas.length > 0) {
        ocrImageDatas = imageDatas;
      } else if (contractDetails.file_path) {
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from('contracts')
          .download(contractDetails.file_path);

        if (downloadError) {
          console.error('contract-analyzer: Error downloading file from storage for OCR:', downloadError);
          throw new Error(getTranslatedMessage('error_failed_to_fetch_file_from_storage', userPreferredLanguage));
        }

        const arrayBuffer = await fileBlob.arrayBuffer();
        ocrImageDatas.push(btoa(String.fromCharCode(...new Uint8Array(arrayBuffer))));
      }

      if (ocrImageDatas.length > 0) {
        let ocrResults: string[] = [];
        for (const imgData of ocrImageDatas) {
          try {
            ocrResults.push(await executeOcr(imgData, userPreferredLanguage));
          } catch (ocrError: any) {
            console.error('contract-analyzer: OCR failed for one image:', ocrError);
          }
        }
        processedContractText = ocrResults.join('\n\n');
        
        await supabase.from('contracts').update({ contract_content: processedContractText }).eq('id', contractId);
        await logActivity(
          supabase,
          userId,
          'CONTRACT_OCR_COMPLETED',
          `User ${userEmail} performed OCR for contract ID: ${contractId}`,
          { contract_id: contractId }
        );
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'notification_title_ocr_completed',
          message: getTranslatedMessage('notification_message_ocr_completed', userPreferredLanguage, { contractName: originalContractName }),
          type: 'success',
        });
      } else {
        throw new Error(getTranslatedMessage('error_no_image_data_for_ocr', userPreferredLanguage));
      }
    }

    if (shouldPerformOcr && !performAnalysis) {
      await supabase
        .from('contracts')
        .update({ status: 'completed', processing_progress: 100, subscription_id: userSubscriptionId, output_language: outputLanguage, translated_name: translatedContractName })
        .eq('id', contractId);
      return corsResponse({ message: getTranslatedMessage('message_ocr_completed_only', userPreferredLanguage), translated_contract_name: translatedContractName });
    }

    if (!performAnalysis || !processedContractText) {
      if (!processedContractText) {
        throw new Error(getTranslatedMessage('error_no_text_for_analysis', userPreferredLanguage));
      }
    }

    await supabase.from('contracts').update({ processing_progress: 30 }).eq('id', contractId);

    translatedContractName = await translateText(originalContractName, outputLanguage);

    let analysisData: any;
    const notSpecifiedTranslatedString = getTranslatedMessage('not_specified', outputLanguage);

    // --- Dream Team Logic: Conditional LLM Orchestration ---
    if (performAdvancedAnalysis) { // MODIFIED: Use performAdvancedAnalysis flag
      console.log(`contract-analyzer: DEBUG - Advanced Analysis requested. Using Dream Team workflow.`); // MODIFIED
      
      // Phase 1: GPT-4o as "Eyes" for initial extraction and structuring
      await supabase.from('contracts').update({ processing_progress: 40 }).eq('id', contractId);
      const gpt4oSystemPrompt = `You are an expert document parser. Your task is to extract and structure key information from the provided legal contract text. Do NOT perform any legal analysis or interpretation. Focus solely on accurate extraction.

Return your findings strictly as a valid JSON object with the following structure:
{
  "executiveSummaryBrief": "A very brief (1-2 sentences) summary of the contract's purpose.",
  "contractType": "e.g., Service Agreement, NDA, Lease Agreement",
  "parties": ["Party A Name", "Party B Name", "..."],
  "effectiveDate": "YYYY-MM-DD or 'not_specified'",
  "terminationDate": "YYYY-MM-DD or 'not_specified'",
  "renewalDate": "YYYY-MM-DD or 'not_specified'",
  "contractValue": "e.g., '$100,000 USD' or 'not_specified'",
  "segmentedText": [
    {"segmentId": "1", "text": "First paragraph/clause text."},
    {"segmentId": "2", "text": "Second paragraph/clause text."},
    // ... up to 50 segments for very long documents, or fewer for shorter ones.
  ]
}

NOTES:
- Dates should be in YYYY-MM-DD format. If only month/year or year is available, use 'YYYY-MM-01' or 'YYYY-01-01'. If no date is found, use 'not_specified'.
- Ensure the JSON is valid and strictly adheres to the specified structure.
- Do not include any text outside the JSON object.
- All text fields within the JSON output MUST be generated in English for consistent input to the next stage.
`;

      const gpt4oCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: gpt4oSystemPrompt },
          { role: "user", content: `Contract Text:\n\n${processedContractText}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const gpt4oOutputContent = gpt4oCompletion.choices[0].message?.content;
      if (!gpt4oOutputContent) {
        throw new Error(getTranslatedMessage('error_no_content_from_openai', userPreferredLanguage));
      }
      const gpt4oExtractedData = JSON.parse(gpt4oOutputContent);
      console.log("contract-analyzer: DEBUG - GPT-4o (Eyes) extracted data:", gpt4oExtractedData);

      // Phase 2: Claude Sonnet 4.5 as "Brain" for deep legal analysis and artifact generation
      await supabase.from('contracts').update({ processing_progress: 50 }).eq('id', contractId);

      const claudeSystemPrompt = `You are a highly sophisticated legal contract analysis AI, embodying the expertise of a senior legal counsel with 30 years of experience. Your task is to perform a deep, nuanced analysis of the provided legal contract text and structured metadata. You have access to the full contract text and should leverage your 200K context window to understand the document holistically without chunking.

Based on the provided contract text and metadata, generate:
1.  A comprehensive executive summary.
2.  A detailed data protection impact assessment.
3.  An overall compliance score (0-100).
4.  A list of specific findings. Each finding must include:
    *   title, description, risk level (high, medium, low, none),
    *   jurisdiction (UK, EU, Ireland, US, Canada, Australia, Islamic Law, Others),
    *   category (compliance, risk, data-protection, enforceability, drafting, commercial),
    *   recommendations (as an array of strings),
    *   an optional clauseReference (text from the contract).
5.  Jurisdiction-specific summaries.
6.  **Advanced Analysis Fields:** Extract and summarize the following:
    *   effectiveDate, terminationDate, renewalDate (YYYY-MM-DD or 'not_specified').
    *   contractType, contractValue.
    *   parties (array of strings).
    *   liabilityCapSummary (2-4 sentences).
    *   indemnificationClauseSummary (2-4 sentences).
    *   confidentialityObligationsSummary (2-4 sentences).
7.  **Artifacts (Redlined Clause Example):** For the most significant 'high' risk finding related to a specific clause, generate a redlined version of that clause. Assume the original clause is available in the 'segmentedText' from the metadata. Highlight problematic phrases/words with [[PROBLEM]] and suggest a revised version of the clause. If no such finding exists, return 'not_applicable'.

CHECKLIST FOR ANALYSIS (INTERNAL GUIDANCE – DO NOT OUTPUT VERBATIM):
1. Preliminary Review – name of the parties, capacity, purpose, authority, formality.  
2. Core Business Terms – subject matter, price/consideration, performance obligations, duration/renewal.  
3. Risk Allocation – warranties, representations, indemnities, liability caps, insurance.  
4. Conditions & Contingencies – conditions precedent, conditions subsequent, force majeure, change in law.  
6. Rights & Protections – termination rights, remedies, confidentiality, IP ownership/licensing, exclusivity, assignment/subcontracting.  
7. Compliance & Enforceability – governing law, jurisdiction, dispute resolution, regulatory compliance (data, consumer, competition law), illegality risks.  
8. Commercial Fairness & Practicality – balance of obligations, feasibility, ambiguities, consistency with other agreements.  
9. Drafting Quality – definitions, clarity, precision, consistency, appendices/schedules, entire agreement.  
10. Execution & Post-Signing – proper signatories, witnessing, notarization, ongoing obligations, survival clauses.  
11. Red Flags – unilateral termination, unlimited liability, hidden auto-renewals, one-sided indemnities, penalty clauses, unfavorable law/jurisdiction, biased dispute resolution.  

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
  },
  "effectiveDate": "YYYY-MM-DD or '${notSpecifiedTranslatedString}'",
  "terminationDate": "YYYY-MM-DD or '${notSpecifiedTranslatedString}'",
  "renewalDate": "YYYY-MM-DD or '${notSpecifiedTranslatedString}'",
  "contractType": "...",
  "contractValue": "...",
  "parties": ["...", "..."],
  "liabilityCapSummary": "...",
  "indemnificationClauseSummary": "...",
  "confidentialityObligationsSummary": "...",
  "redlinedClauseArtifact": {
    "originalClause": "...",
    "redlinedVersion": "...",
    "suggestedRevision": "...",
    "findingId": "..."
  }
}

NOTES:
- Ensure the JSON is valid and strictly adheres to the specified structure.
- Do not include any text outside the JSON object.
- All text fields within the JSON output MUST be generated in ${outputLanguage}. If translation is necessary, perform it accurately.
- Risk levels must be one of: high, medium, low, none.
- Categories must be one of: compliance, risk, data-protection, enforceability, drafting, commercial.
- Dates should be in YYYY-MM-DD format. If only month/year or year is available, use 'YYYY-MM-01' or 'YYYY-01-01'. If no date is found, use '${notSpecifiedTranslatedString}'.
- For 'redlinedClauseArtifact', if no suitable high-risk clause is found, set the entire object to null or 'not_applicable'.
`;

      // Caching Logic for Claude's analysis
      const cacheKeyContent = JSON.stringify({
        contractText: processedContractText,
        metadata: gpt4oExtractedData,
        jurisdictions: userSelectedJurisdictions,
        outputLanguage: outputLanguage,
        advancedAnalysis: performAdvancedAnalysis,
      });
      const cacheHash = await sha256(cacheKeyContent);

      const { data: cachedResult, error: cacheError } = await supabase
        .from('cached_clause_analysis')
        .select('cached_result')
        .eq('clause_hash', cacheHash)
        .maybeSingle();

      if (cacheError) {
        console.warn("contract-analyzer: Error querying cache:", cacheError);
      }

      if (cachedResult) {
        console.log("contract-analyzer: DEBUG - Cache hit for Claude analysis.");
        analysisData = cachedResult.cached_result;
      } else {
        console.log("contract-analyzer: DEBUG - Cache miss. Calling Claude Sonnet 4.5...");
        const claudeCompletion = await anthropic.messages.create({
          model: "claude-sonnet-4-5", // MODIFIED: Use the correct API identifier for Claude Sonnet 4.5
          max_tokens: 4000, // Adjust based on expected output length
          temperature: 0.2,
          system: claudeSystemPrompt,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `Full Contract Text:\n\n${processedContractText}` },
                { type: "text", text: `\n\nStructured Metadata from GPT-4o:\n${JSON.stringify(gpt4oExtractedData, null, 2)}` }
              ]
            }
          ],
        });

        const claudeOutputContent = claudeCompletion.content.text;
        if (!claudeOutputContent) {
          throw new Error(getTranslatedMessage('error_no_content_from_claude', userPreferredLanguage));
        }

        // MODIFIED: Remove markdown code block fences before parsing JSON
        const cleanedClaudeOutput = claudeOutputContent.replace(/```json\n?|```/g, '').trim();
        
        analysisData = JSON.parse(cleanedClaudeOutput); // MODIFIED: Parse the cleaned output
        console.log("contract-analyzer: DEBUG - Claude Sonnet 4.5 (Brain) analysis data:", analysisData);

        // Store in cache
        const { error: insertCacheError } = await supabase
          .from('cached_clause_analysis')
          .insert({
            clause_hash: cacheHash,
            jurisdiction: userSelectedJurisdictions,
            analysis_type: performAdvancedAnalysis ? 'advanced_dream_team' : 'basic_dream_team',
            llm_model: 'claude-sonnet-4-5',
            cached_result: analysisData,
          });
        if (insertCacheError) {
          console.warn("contract-analyzer: Error inserting into cache:", insertCacheError);
        }
      }

    } else { // Non-Advanced Plans: GPT-4o as "All-in-One"
      console.log(`contract-analyzer: DEBUG - Basic Analysis requested. Using GPT-4o All-in-One workflow.`); // MODIFIED
      await supabase.from('contracts').update({ processing_progress: 50 }).eq('id', contractId);

      const gpt4oAllInOneSystemPrompt = `You are a legal contract analysis AI with the expertise of a professional legal practitioner with 30 years of experience in contract law. Analyze the provided contract text. Your role is to conduct a deep, thorough analysis of the provided contract text and provide an executive summary, data protection impact, overall compliance score (0-100), and a list of specific findings. Each finding should include a title, description, risk level (high, medium, low, none), jurisdiction (UK, EU, Ireland, US, Canada, Australia, Islamic Law, Others), category (compliance, risk, data-protection, enforceability, drafting, commercial), recommendations (as an array of strings), and an optional clause reference. You must use the following checklist as your internal review framework to ensure completeness:

CHECKLIST FOR ANALYSIS (INTERNAL GUIDANCE – DO NOT OUTPUT VERBATIM):  
1. Preliminary Review – name of the parties, capacity, purpose, authority, formality.  
2. Core Business Terms – subject matter, price/consideration, performance obligations, duration/renewal.  
3. Risk Allocation – warranties, representations, indemnities, liability caps, insurance.  
4. Conditions & Contingencies – conditions precedent, conditions subsequent, force majeure, change in law.  
6. Rights & Protections – termination rights, remedies, confidentiality, IP ownership/licensing, exclusivity, assignment/subcontracting.  
7. Compliance & Enforceability – governing law, jurisdiction, dispute resolution, regulatory compliance (data, consumer, competition law), illegality risks.  
8. Commercial Fairness & Practicality – balance of obligations, feasibility, ambiguities, consistency with other agreements.  
9. Drafting Quality – definitions, clarity, precision, consistency, appendices/schedules, entire agreement.  
10. Execution & Post-Signing – proper signatories, witnessing, notarization, ongoing obligations, survival clauses.  
11. Red Flags – unilateral termination, unlimited liability, hidden auto-renewals, one-sided indemnities, penalty clauses, unfavorable law/jurisdiction, biased dispute resolution.  

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
  },
  "effectiveDate": "YYYY-MM-DD or '${notSpecifiedTranslatedString}'",
  "terminationDate": "YYYY-MM-DD or '${notSpecifiedTranslatedString}'",
  "renewalDate": "YYYY-MM-DD or '${notSpecifiedTranslatedString}'",
  "contractType": "...",
  "contractValue": "...",
  "parties": ["...", "..."],
  "liabilityCapSummary": "...",
  "indemnificationClauseSummary": "...",
  "confidentialityObligationsSummary": "..."
}

NOTES:  
- Ensure the JSON is valid and strictly adheres to the specified structure.  
- Do not include any text outside the JSON object.  
- Always populate each field (if information is missing, provide your best inference).  
- Risk levels must be one of: high, medium, low, none.  
- Categories must be one of: compliance, risk, data-protection, enforceability, drafting, commercial. 
- Apply the compliance score rules consistently to every analysis.

---
DOCUMENT LANGUAGE INSTRUCTIONS:
The contract text provided is in ${sourceLanguage === 'auto' ? 'an auto-detected language' : sourceLanguage}. If the source language === 'auto', please detect the language of the document.

OUTPUT LANGUAGE INSTRUCTIONS:
All text fields within the JSON output (executiveSummary, dataProtectionImpact, title, description, recommendations, keyFindings, applicableLaws, clauseReference) MUST be generated in ${outputLanguage}. If translation is necessary, perform it accurately.

JURISDICTION FOCUS:
The user has specified the following jurisdictions for this analysis: ${userSelectedJurisdictions}. Prioritize findings and applicable laws relevant to these jurisdictions. If a finding is relevant to multiple jurisdictions, you may include it, but ensure the primary focus remains on the user's selected jurisdictions.
`;

      const gpt4oCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: gpt4oAllInOneSystemPrompt },
          { role: "user", content: `Contract Text:\n\n${processedContractText}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const aiResponseContent = gpt4oCompletion.choices[0].message?.content;
      if (!aiResponseContent) {
        throw new Error(getTranslatedMessage('error_no_content_from_openai', userPreferredLanguage));
      }
      analysisData = JSON.parse(aiResponseContent);
      console.log("contract-analyzer: DEBUG - GPT-4o (All-in-One) analysis data:", analysisData);
    }
    // --- END Dream Team Logic ---

    // Defensive checks before processing analysisData properties
    analysisData.executiveSummary = typeof analysisData.executiveSummary === 'string' ? analysisData.executiveSummary : getTranslatedMessage('no_executive_summary_provided', outputLanguage);
    analysisData.executiveSummary = await translateText(analysisData.executiveSummary, outputLanguage);
    
    analysisData.dataProtectionImpact = typeof analysisData.dataProtectionImpact === 'string' ? analysisData.dataProtectionImpact : null;
    if (analysisData.dataProtectionImpact) {
      analysisData.dataProtectionImpact = await translateText(analysisData.dataProtectionImpact, outputLanguage);
    }

    if (Array.isArray(analysisData.findings)) {
      for (let i = 0; i < analysisData.findings.length; i++) {
        let finding = analysisData.findings[i];
        if (finding && typeof finding === 'object') {
          finding = { ...finding };
          finding.title = typeof finding.title === 'string' ? finding.title : '';
          finding.title = await translateText(finding.title, outputLanguage);
          
          finding.description = typeof finding.description === 'string' ? finding.description : '';
          finding.description = await translateText(finding.description, outputLanguage);
          
          if (Array.isArray(finding.recommendations)) {
            finding.recommendations = await Promise.all(finding.recommendations.map((rec: string) => translateText(rec, outputLanguage)));
          } else {
            finding.recommendations = [];
          }
          if (finding.clauseReference) {
            finding.clauseReference = typeof finding.clauseReference === 'string' ? finding.clauseReference : '';
            finding.clauseReference = await translateText(finding.clauseReference, outputLanguage);
          }
          analysisData.findings[i] = finding;
        } else {
          analysisData.findings[i] = {};
        }
      }
    }

    if (analysisData.jurisdictionSummaries && typeof analysisData.jurisdictionSummaries === 'object') {
      const newJurisdictionSummaries: Record<string, any> = {};
      for (const key in analysisData.jurisdictionSummaries) {
        let summary = analysisData.jurisdictionSummaries[key];
        if (summary && typeof summary === 'object') {
          summary = { ...summary };
          if (Array.isArray(summary.applicableLaws)) {
            summary.applicableLaws = await Promise.all(summary.applicableLaws.map((law: string) => translateText(law, outputLanguage)));
          } else {
            summary.applicableLaws = [];
          }
          if (Array.isArray(summary.keyFindings)) {
            summary.keyFindings = await Promise.all(summary.keyFindings.map((kf: string) => translateText(kf, outputLanguage)));
          } else {
            summary.keyFindings = [];
          }
          newJurisdictionSummaries[key] = summary;
        } else {
          newJurisdictionSummaries[key] = {};
        }
      }
      analysisData.jurisdictionSummaries = newJurisdictionSummaries;
    }

    // Translate advanced fields if present
    if (performAdvancedAnalysis) {
      if (analysisData.effectiveDate) analysisData.effectiveDate = await translateText(analysisData.effectiveDate, outputLanguage);
      if (analysisData.terminationDate) analysisData.terminationDate = await translateText(analysisData.terminationDate, outputLanguage);
      if (analysisData.renewalDate) analysisData.renewalDate = await translateText(analysisData.renewalDate, outputLanguage);
      if (analysisData.contractType) analysisData.contractType = await translateText(analysisData.contractType, outputLanguage);
      if (analysisData.contractValue) analysisData.contractValue = await translateText(analysisData.contractValue, outputLanguage);
      if (Array.isArray(analysisData.parties)) {
        analysisData.parties = await Promise.all(analysisData.parties.map((p: string) => translateText(p, outputLanguage)));
      }
      if (analysisData.liabilityCapSummary) analysisData.liabilityCapSummary = await translateText(analysisData.liabilityCapSummary, outputLanguage);
      if (analysisData.indemnificationClauseSummary) analysisData.indemnificationClauseSummary = await translateText(analysisData.indemnificationClauseSummary, outputLanguage);
      if (analysisData.confidentialityObligationsSummary) analysisData.confidentialityObligationsSummary = await translateText(analysisData.confidentialityObligationsSummary, outputLanguage);
    }

    const executiveSummary = typeof analysisData.executiveSummary === 'string' ? analysisData.executiveSummary : getTranslatedMessage('no_executive_summary_provided', outputLanguage);
    const dataProtectionImpact = typeof analysisData.dataProtectionImpact === 'string' ? analysisData.dataProtectionImpact : null;
    const complianceScore = typeof analysisData.complianceScore === 'number' ? analysisData.complianceScore : 0;
    const findings = Array.isArray(analysisData.findings) ? analysisData.findings : [];
    const jurisdictionSummaries = typeof analysisData.jurisdictionSummaries === 'object' && analysisData.jurisdictionSummaries !== null ? analysisData.jurisdictionSummaries : {};

    await supabase.from('contracts').update({ processing_progress: 70 }).eq('id', contractId);

    const processedEffectiveDate = analysisData.effectiveDate || notSpecifiedTranslatedString;
    const processedTerminationDate = analysisData.terminationDate || notSpecifiedTranslatedString;
    const processedRenewalDate = analysisData.renewalDate || notSpecifiedTranslatedString;
    const processedContractType = analysisData.contractType || notSpecifiedTranslatedString;
    const processedContractValue = analysisData.contractValue || notSpecifiedTranslatedString;
    const processedParties = analysisData.parties || [];
    const processedLiabilityCapSummary = analysisData.liabilityCapSummary || notSpecifiedTranslatedString;
    const processedIndemnificationClauseSummary = analysisData.indemnificationClauseSummary || notSpecifiedTranslatedString;
    const processedConfidentialityObligationsSummary = analysisData.confidentialityObligationsSummary || notSpecifiedTranslatedString;

    // ADDED: Process and store artifacts
    let redlinedClauseArtifactPath: string | null = null;
    if (isAdvancedPlanUser && analysisData.redlinedClauseArtifact && analysisData.redlinedClauseArtifact.redlinedVersion) {
      const artifactContent = JSON.stringify(analysisData.redlinedClauseArtifact, null, 2);
      const artifactFileName = `redlined-clause-${contractId}-${Date.now()}.json`;
      const artifactFilePath = `${userId}/${contractId}/${artifactFileName}`;

      const { error: uploadArtifactError } = await supabase.storage
        .from('contract_artifacts') // NEW STORAGE BUCKET
        .upload(artifactFilePath, artifactContent, {
          contentType: 'application/json',
          upsert: true,
        });

      if (uploadArtifactError) {
        console.error('contract-analyzer: Error uploading redlined clause artifact:', uploadArtifactError);
      } else {
        redlinedClauseArtifactPath = artifactFilePath;
      }
    }

    const { data: reportData, error: reportError } = await supabase.functions.invoke('generate-analysis-report', {
      body: {
        contractId: contractId,
        contractName: translatedContractName,
        analysisResult: {
          executive_summary: executiveSummary,
          data_protection_impact: dataProtectionImpact,
          compliance_score: complianceScore,
          jurisdiction_summaries: jurisdictionSummaries,
          findings: findings,
          effective_date: processedEffectiveDate,
          termination_date: processedTerminationDate,
          renewal_date: processedRenewalDate,
          contract_type: processedContractType,
          contract_value: processedContractValue,
          parties: processedParties,
          liability_cap_summary: processedLiabilityCapSummary,
          indemnification_clause_summary: processedIndemnificationClauseSummary,
          confidentiality_obligations_summary: processedConfidentialityObligationsSummary,
          // ADDED: Pass artifact path to report generator
          redlined_clause_artifact_path: redlinedClauseArtifactPath,
        },
        outputLanguage: outputLanguage,
      },
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (reportError) {
      console.error('contract-analyzer: Error invoking generate-analysis-report Edge Function:', reportError);
    }
    const reportFilePath = reportData?.filePath || null;
    const reportHtmlContent = reportData?.htmlContent || null;
    const reportLink = reportData?.url || null;

    const { data: analysisResult, error: analysisError } = await supabase
      .from('analysis_results')
      .insert({
        contract_id: contractId,
        executive_summary: executiveSummary,
        data_protection_impact: dataProtectionImpact,
        compliance_score: complianceScore,
        jurisdiction_summaries: jurisdictionSummaries,
        report_file_path: reportFilePath,
        effective_date: processedEffectiveDate,
        termination_date: processedTerminationDate,
        renewal_date: processedRenewalDate,
        contract_type: processedContractType,
        contract_value: processedContractValue,
        parties: processedParties,
        liability_cap_summary: processedLiabilityCapSummary,
        indemnification_clause_summary: processedIndemnificationClauseSummary,
        confidentiality_obligations_summary: processedConfidentialityObligationsSummary,
        performed_advanced_analysis: performAdvancedAnalysis,
        // ADDED: Store artifact path in DB
        redlined_clause_artifact_path: redlinedClauseArtifactPath,
      })
      .select()
      .single();

    if (analysisError) {
      throw analysisError;
    }

    const findingsToInsert = findings.map((finding: any) => ({
      analysis_result_id: analysisResult.id,
      title: typeof finding.title === 'string' ? finding.title : getTranslatedMessage('no_title_provided', outputLanguage),
      description: typeof finding.description === 'string' ? finding.description : getTranslatedMessage('no_description_provided', outputLanguage),
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
        console.error('contract-analyzer: Error inserting findings:', findingsError);
      }
    }
    
    const { error: updateContractError } = await supabase
      .from('contracts')
      .update({ status: 'completed', processing_progress: 100, subscription_id: userSubscriptionId, output_language: outputLanguage, translated_name: translatedContractName })
      .eq('id', contractId);

    if (updateContractError) {
      console.error(`contract-analyzer: Error updating contract status to completed for ID ${contractId}:`, updateContractError);
      await supabase
        .from('contracts')
        .update({ status: 'failed', processing_progress: 0 })
        .eq('id', contractId);
      throw new Error(`Failed to finalize contract status: ${updateContractError.message}`);
    }

    const { data: emailTriggerData, error: emailTriggerError } = await supabase.functions.invoke('trigger-report-email', {
      body: {
        userId: userId,
        contractId: contractId,
        reportSummary: executiveSummary,
        reportLink: reportLink,
        reportHtmlContent: reportHtmlContent,
        userPreferredLanguage: userPreferredLanguage,
        contractName: translatedContractName,
      },
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (emailTriggerError) {
      console.error('contract-analyzer: Error invoking trigger-report-email Edge Function:', emailTriggerError);
    } else {
      // trigger-report-email Edge Function invoked successfully.
    }

    const notificationContractName = translatedContractName;

    if (userNotificationSettings['analysis-complete']?.inApp) {
      const notificationMessage = getTranslatedMessage('notification_message_analysis_complete', userPreferredLanguage, { contractName: notificationContractName });
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: userId,
        title: 'notification_title_analysis_complete',
        message: notificationMessage,
        type: 'success',
      });
      if (notificationError) {
        console.error('contract-analyzer: Error inserting "Analysis Complete" notification:', notificationError);
      }
    }

    const highRiskFindings = findings.filter((f: any) => f.risk_level === 'high' || f.riskLevel === 'high');
    if (highRiskFindings.length > 0 && userNotificationSettings['high-risk-findings']?.inApp) {
      const notificationMessage = getTranslatedMessage('notification_message_high_risk_findings', userPreferredLanguage, { contractName: notificationContractName, count: highRiskFindings.length });
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: userId,
        title: 'notification_title_high_risk_findings',
        message: notificationMessage,
        type: 'error',
      });
      if (notificationError) {
        console.error('contract-analyzer: Error inserting "High Risk Findings" notification:', notificationError);
      }
    }

    await logActivity(
      supabase,
      userId,
      'CONTRACT_ANALYSIS_COMPLETED',
      `User ${userEmail} completed analysis for contract ID: ${contractId} with compliance score: ${complianceScore}%`,
      { contract_id: contractId, compliance_score: complianceScore, perform_advanced_analysis: performAdvancedAnalysis, user_tier: userSubscriptionTier }
    );

    return corsResponse({ message: 'Analysis completed successfully', translated_contract_name: translatedContractName });

  } catch (error: any) {
    console.error(`contract-analyzer: Error during analysis for contract ID ${contractId}:`, error.message);
    await supabase
      .from('contracts')
      .update({ status: 'failed', processing_progress: 0 })
      .eq('id', contractId);

    await logActivity(
      supabase,
      userId,
      'CONTRACT_ANALYSIS_FAILED',
      `User ${userEmail} failed analysis for contract ID: ${contractId}. Error: ${error.message}`,
      { contract_id: contractId, error: error.message, perform_advanced_analysis: performAdvancedAnalysis, user_tier: userSubscriptionTier }
    );

    const notificationContractName = translatedContractName;

    if (userNotificationSettings['analysis-complete']?.inApp) {
      const notificationMessage = getTranslatedMessage('notification_message_analysis_failed', userPreferredLanguage, { contractName: notificationContractName });
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: userId,
        title: 'notification_title_analysis_failed',
        message: notificationMessage,
        type: 'error',
      });
      if (notificationError) console.error('contract-analyzer: Error inserting "Analysis Failed" notification:', notificationError);
    }

    return corsResponse({ error: error.message }, 500);
  }
});