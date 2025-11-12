import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import OpenAI from 'npm:openai@4.53.0';
import Anthropic from 'npm:@anthropic-ai/sdk';
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

// Initialize Anthropic client
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
  
  let accessControlAllowOrigin = '*';
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
      return retry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// ENHANCED: More aggressive JSON cleaning function
function cleanJsonString(jsonString: string): string {
  if (!jsonString || typeof jsonString !== 'string') {
    console.warn("cleanJsonString: Input is not a valid string. Returning empty object.");
    return '{}';
  }

  // Step 1: Remove markdown code blocks
  let cleaned = jsonString.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();

  // Step 2: Extract the outermost JSON structure
  let startIndex = -1;
  let endIndex = -1;

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    startIndex = firstBrace;
    endIndex = lastBrace;
  } else if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    startIndex = firstBracket;
    endIndex = lastBracket;
  }

  if (startIndex === -1 || endIndex === -1) {
    console.warn("cleanJsonString: No valid JSON object or array structure found.");
    return '{}';
  }

  cleaned = cleaned.substring(startIndex, endIndex + 1);

  // Step 3: Remove comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/\/\/.*$/gm, '');

  // Step 4: Fix string values - escape control characters and quotes
  // This is a more robust approach that handles nested quotes better
  cleaned = cleaned.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
    // Escape newlines, carriage returns, tabs
    let fixed = content
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\f/g, '\\f')
      .replace(/\b/g, '\\b');
    
    // Fix backslashes - but preserve already escaped characters
    fixed = fixed.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
    
    return `"${fixed}"`;
  });

  // Step 5: Remove trailing commas
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // Step 6: Fix missing commas between objects/arrays
  cleaned = cleaned.replace(/}(\s*){/g, '},{');
  cleaned = cleaned.replace(/](\s*)\[/g, '],[');

  // Step 7: Fix missing commas after closing braces/brackets before new keys
  cleaned = cleaned.replace(/}(\s*)"(\w+)":/g, '},"$2":');
  cleaned = cleaned.replace(/](\s*)"(\w+)":/g, '],"$2":');

  return cleaned;
}

// ENHANCED: More robust JSON parsing with better error recovery
function safeJsonParse(jsonString: string, context: string = 'unknown', userPreferredLanguage: string = 'en'): any {
  console.info(`safeJsonParse: Starting parse for ${context}. Input length: ${jsonString.length}`);
  
  let cleanedOutput = jsonString;
  let parsedResult: any = null;

  // First attempt: Try parsing as-is
  try {
    parsedResult = JSON.parse(jsonString);
    console.info(`safeJsonParse: Direct JSON.parse succeeded for ${context}.`);
    return parsedResult;
  } catch (directError: any) {
    console.warn(`safeJsonParse: Direct parse failed for ${context}: ${directError.message}`);
  }

  // Second attempt: Try with cleaning
  try {
    console.info(`safeJsonParse: Attempting aggressive cleanup for ${context}`);
    cleanedOutput = cleanJsonString(jsonString);
    console.info(`safeJsonParse: Cleanup completed for ${context}. Cleaned length: ${cleanedOutput.length}`);
    
    parsedResult = JSON.parse(cleanedOutput);
    console.info(`safeJsonParse: JSON.parse succeeded for ${context} after cleanup.`);
    return parsedResult;
  } catch (parseError: any) {
    console.error(`safeJsonParse: JSON.parse failed for ${context} after cleanup: ${parseError.message}`);
    console.error(`safeJsonParse: Error position info:`, parseError.message);
    
    // Log problematic sections for debugging
    const errorMatch = parseError.message.match(/position (\d+)/);
    if (errorMatch) {
      const errorPos = parseInt(errorMatch[1]);
      const contextStart = Math.max(0, errorPos - 200);
      const contextEnd = Math.min(cleanedOutput.length, errorPos + 200);
      console.error(`safeJsonParse: Context around error position ${errorPos}:`, 
        cleanedOutput.substring(contextStart, contextEnd));
    } else {
      console.error(`safeJsonParse: First 500 chars:`, cleanedOutput.substring(0, 500));
      console.error(`safeJsonParse: Last 500 chars:`, cleanedOutput.substring(cleanedOutput.length - 500));
    }

    // Return fallback structure
    console.warn(`safeJsonParse: Returning fallback structure for ${context}`);
    return {
      executiveSummary: getTranslatedMessage('error_failed_to_parse_ai_response_summary', userPreferredLanguage),
      dataProtectionImpact: getTranslatedMessage('error_failed_to_parse_ai_response_data_protection', userPreferredLanguage),
      complianceScore: 0,
      findings: [],
      jurisdictionSummaries: {},
      effectiveDate: getTranslatedMessage('not_specified', userPreferredLanguage),
      terminationDate: getTranslatedMessage('not_specified', userPreferredLanguage),
      renewalDate: getTranslatedMessage('not_specified', userPreferredLanguage),
      contractType: getTranslatedMessage('not_specified', userPreferredLanguage),
      contractValue: getTranslatedMessage('not_specified', userPreferredLanguage),
      parties: [],
      liabilityCapSummary: getTranslatedMessage('not_specified', userPreferredLanguage),
      indemnificationClauseSummary: getTranslatedMessage('not_specified', userPreferredLanguage),
      confidentialityObligationsSummary: getTranslatedMessage('not_specified', userPreferredLanguage),
      performedAdvancedAnalysis: false,
    };
  }
}

// Helper function for translation with improved prompt
async function translateText(text: string | null | undefined, targetLanguage: string): Promise<string> {
  if (!text || targetLanguage === 'en') {
    return text || '';
  }

  try {
    const translationCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a highly accurate language translator. Translate the following text into ${targetLanguage}. If the text is already in ${targetLanguage}, return the original text as is. Provide only the translated or original text. Do NOT include any additional commentary, formatting, or conversational filler.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });
    const translatedContent = translationCompletion.choices[0].message?.content?.trim();

    if (!translatedContent) {
      console.warn(`translateText: Empty translation received for "${text}". Returning original.`);
      return text;
    }
    return translatedContent;
  } catch (error) {
    console.error(`translateText: Error translating text to ${targetLanguage}:`, error);
    return text;
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
            type: 'DOCUMENT_TEXT_DETECTION',
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

// Hashing function for caching
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
          userSubscriptionTier = directSubData.tier || null;
        }
      }
    }

  } catch (error) {
    console.error('contract-analyzer: Error parsing request body or authenticating user:', error);
    return corsResponse({ error: 'Invalid request or authentication failed' }, 400);
  }

  let consumedOrderId: number | null = null;

  console.log(`contract-analyzer: DEBUG - User ${userId} (Tier: ${userSubscriptionTier}) requested analysis.`);
  console.log(`contract-analyzer: DEBUG - performAdvancedAnalysis: ${performAdvancedAnalysis}, creditCost from frontend: ${creditCost}`);

  const isAdvancedPlanUser = userSubscriptionTier !== null && (userSubscriptionTier === 4 || userSubscriptionTier === 5);
  const isBasicPlanUser = userSubscriptionTier !== null && (userSubscriptionTier === 2 || userSubscriptionTier === 3);

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
      .order('created_at', { ascending: true });

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
      consumedOrderId = order.id;
    }
    console.log(`contract-analyzer: DEBUG - Credit deduction completed. Final remaining cost: ${remainingCost}`);
  } else {
    console.log(`contract-analyzer: DEBUG - User ${userId} is on an advanced plan (Tier 4 or 5) or a basic plan not requesting advanced analysis. Skipping credit deduction.`);
  }

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

    const userSelectedJurisdictions = contractDetails.jurisdictions;
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
        processedContractText = ocrResults.join('\n\n--- Page Break ---\n\n');
        
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

    if (performAdvancedAnalysis) {
      console.log(`contract-analyzer: DEBUG - Advanced Analysis requested. Using Dream Team workflow.`);
      
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
    {"segmentId": "2", "text": "Second paragraph/clause text."}
  ]
}

NOTES:
- Dates should be in YYYY-MM-DD format. If only month/year or year is available, use 'YYYY-MM-01' or 'YYYY-01-01'. If no date is found, use 'not_specified'.
- Ensure the JSON is valid and strictly adheres to the specified structure.
- Do not include any text outside the JSON object.
- All string values must be properly escaped for JSON. Specifically, any double quotes (") and newline characters (\\n) within a string value must be escaped with a backslash.
- Ensure all arrays are correctly formatted with commas between elements and no trailing commas. All objects must have commas between key-value pairs and no trailing commas.

CRITICAL JSON VALIDATION:
- The entire output MUST be a single, valid JSON object.
- DO NOT include any text, comments, or markdown outside the JSON object.
- ENSURE all string values are properly escaped (e.g., double quotes (\\"), newlines (\\n), and backslashes (\\\\)).
- VERIFY that all array elements are separated by commas, and there are NO trailing commas in arrays or objects.
- CONFIRM that all object key-value pairs are separated by commas, and there are NO trailing commas.
- DOUBLE-CHECK all brackets \`[]\` and braces \`{}\` are correctly matched and closed.
- IF YOU ARE UNSURE ABOUT JSON FORMATTING, PRIORITIZE VALIDITY OVER CONTENT.
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
      try {
        analysisData = safeJsonParse(gpt4oOutputContent, "GPT-4o (Eyes)", userPreferredLanguage);
      } catch (parseError: any) {
        console.error("contract-analyzer: JSON parsing failed for GPT-4o output. Raw output:", gpt4oOutputContent);
        throw new Error(`${getTranslatedMessage('error_failed_to_parse_ai_response', userPreferredLanguage)} (GPT-4o): ${parseError.message}`);
      }
      console.log("contract-analyzer: DEBUG - GPT-4o (Eyes) extracted data:", analysisData);

      // Phase 2: Claude Sonnet 4.5 as "Brain" for deep legal analysis
      await supabase.from('contracts').update({ processing_progress: 50 }).eq('id', contractId);

      // ENHANCED: Ultra-strict Claude prompt with explicit JSON formatting rules
      const claudeSystemPrompt = `You are a highly sophisticated legal contract analysis AI. You must analyze the provided contract and output ONLY valid, parseable JSON.

CRITICAL JSON FORMATTING RULES (YOU MUST FOLLOW THESE EXACTLY):
1. Output ONLY the JSON object - no markdown, no code blocks, no additional text before or after
2. All property names and string values MUST use double quotes (")
3. Inside string values, you MUST escape these characters:
   - Newlines: use \\n (not actual newline characters)
   - Tabs: use \\t (not actual tab characters)
   - Carriage returns: use \\r (not actual carriage return characters)
   - Double quotes: use \\" (backslash before quote)
   - Backslashes: use \\\\ (double backslash)
4. NO trailing commas after the last element in arrays or objects
5. All array elements MUST be separated by commas
6. All object properties MUST be separated by commas
7. All brackets [] and braces {} must be properly matched and closed
8. String values should be concise - keep descriptions under 800 characters, summaries under 1500 characters

ANALYSIS CHECKLIST (use internally, don't output):
1. Preliminary Review - parties, capacity, purpose, authority, formality
2. Core Business Terms - subject matter, price, obligations, duration
3. Risk Allocation - warranties, indemnities, liability caps, insurance
4. Conditions & Contingencies - conditions precedent/subsequent, force majeure
5. Rights & Protections - termination, remedies, confidentiality, IP, exclusivity
6. Compliance & Enforceability - governing law, jurisdiction, dispute resolution, regulatory compliance
7. Commercial Fairness - balance of obligations, feasibility, ambiguities
8. Drafting Quality - definitions, clarity, precision, consistency
9. Execution & Post-Signing - signatories, witnessing, ongoing obligations
10. Red Flags - unilateral terms, unlimited liability, auto-renewals, one-sided clauses
11. List redlined clause artifacts of all the high risk clauses

JURISDICTION FOCUS:
Primary focus on the specified following jurisdictions for this analysis: ${userSelectedJurisdictions.join(', ')}.

REQUIRED JSON STRUCTURE (output this exact structure):
{
  "executiveSummary": "Brief summary under 1500 chars with all quotes escaped",
  "dataProtectionImpact": "Data protection analysis under 1500 chars with all quotes escaped",
  "complianceScore": 75,
  "findings": [
    {
      "title": "Short title",
      "description": "Description under 800 chars",
      "riskLevel": "high",
      "jurisdiction": "UK",
      "category": "data-protection",
      "recommendations": ["Recommendation 1", "Recommendation 2"],
      "clauseReference": "Section X"
    }
  ],
  "jurisdictionSummaries": {
    "UK": {
      "jurisdiction": "UK",
      "applicableLaws": ["Law 1", "Law 2"],
      "keyFindings": ["Finding 1", "Finding 2"],
      "riskLevel": "high"
    }
  },
  "effectiveDate": "2025-08-11",
  "terminationDate": "2026-08-12",
  "renewalDate": "${notSpecifiedTranslatedString}",
  "contractType": "Professional Services Agreement",
  "contractValue": "${notSpecifiedTranslatedString}",
  "parties": ["Party Name 1", "Party Name 2"],
  "liabilityCapSummary": "Summary of liability caps",
  "indemnificationClauseSummary": "Summary of indemnification",
  "confidentialityObligationsSummary": "Summary of confidentiality",
  "redlinedClauseArtifact": {
    "originalClause": "original text with escaped quotes",
    "redlinedVersion": "redlined text with escaped quotes",
    "suggestedRevision": "suggested text with escaped quotes",
    "findingId": "finding reference"
  }
}

VALIDATION CHECKLIST BEFORE OUTPUT:
✓ No text outside the JSON object
✓ All strings use double quotes
✓ All special characters in strings are escaped (\\n \\t \\r \\" \\\\)
✓ No trailing commas in arrays or objects
✓ All commas between array/object elements are present
✓ All brackets and braces are matched
✓ Output would pass JSON.parse() without errors

Contract jurisdictions: ${userSelectedJurisdictions.join(', ')}
Output language: ${outputLanguage}`;

      // Caching Logic for Claude's analysis
      const cacheKeyContent = JSON.stringify({
        contractText: processedContractText,
        metadata: analysisData,
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

        // ENHANCED: Claude call with better error handling and extended timeout
        try {
          analysisData = await retry(async () => {
            try {
              console.log(`contract-analyzer: Calling Claude with contract length: ${processedContractText.length} chars`);
              
              const claudeCompletion = await anthropic.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 16000, // Increased for comprehensive output on large contracts
                temperature: 0.1,
                system: claudeSystemPrompt,
                messages: [
                  {
                    role: "user",
                    content: `Analyze this contract and output ONLY valid JSON with no additional text.

Full Contract Text:
${processedContractText}

Structured Metadata:
${JSON.stringify(analysisData, null, 2)}

Remember: Output ONLY the JSON object with properly escaped strings. No markdown, no code blocks, no extra text.`
                  }
                ],
              });

              const claudeOutputContent = claudeCompletion.content[0].text;
              if (!claudeOutputContent) {
                throw new Error(getTranslatedMessage('error_no_content_from_claude', userPreferredLanguage));
              }

              console.log("contract-analyzer: DEBUG - Claude response received. Output length:", claudeOutputContent.length);
              console.log("contract-analyzer: DEBUG - First 300 chars:", claudeOutputContent.substring(0, 300));
              console.log("contract-analyzer: DEBUG - Last 300 chars:", claudeOutputContent.substring(claudeOutputContent.length - 300));
              
              // Use enhanced safe JSON parsing
              const parsed = safeJsonParse(claudeOutputContent, "Claude Sonnet 4.5 analysis", userPreferredLanguage);
              
              // Validate that we got meaningful data
              if (!parsed.executiveSummary || parsed.executiveSummary.includes('error_failed_to_parse')) {
                console.warn("contract-analyzer: Claude output appears to be a fallback structure. May need to retry...");
                throw new Error("Claude returned unparseable or fallback data");
              }
              
              console.log("contract-analyzer: DEBUG - Claude analysis parsed successfully");
              return parsed;
            } catch (claudeError: any) {
              // Check if it's a 500 error or overloaded error from Anthropic API
              if (claudeError.status === 500 || claudeError.status === 529 || 
                  (claudeError.message && (claudeError.message.includes('500') || claudeError.message.includes('529') || claudeError.message.includes('overloaded')))) {
                console.error("contract-analyzer: Claude API error (500/529/overloaded). This may be temporary API instability.");
                console.error("contract-analyzer: Error details:", claudeError.message);
                throw new Error("CLAUDE_API_ERROR"); // Special error to trigger fallback
              }
              throw claudeError;
            }
          }, 2, 5000); // Retry up to 2 times with 5 second delay for large contracts
        } catch (claudeRetryError: any) {
          // If Claude keeps failing with API errors, fall back to GPT-4o
          if (claudeRetryError.message && claudeRetryError.message.includes('CLAUDE_API_ERROR')) {
            console.warn("contract-analyzer: Claude API failed after retries. Falling back to GPT-4o for analysis.");
            console.warn(`contract-analyzer: Note - Contract length: ${processedContractText.length} chars. GPT-4o may have limitations with very large contracts.`);
            
            // For very large contracts, use a more aggressive truncation for GPT-4o
            let gpt4oContractText = processedContractText;
            const GPT4O_MAX_LENGTH = 120000; // GPT-4o has smaller context window
            if (processedContractText.length > GPT4O_MAX_LENGTH) {
              console.warn(`contract-analyzer: Truncating contract to ${GPT4O_MAX_LENGTH} chars for GPT-4o fallback.`);
              gpt4oContractText = processedContractText.substring(0, GPT4O_MAX_LENGTH) + "\n\n[... Contract truncated for GPT-4o processing ...]";
            }
            
            // Fallback to GPT-4o with a simplified prompt
            const gpt4oFallbackPrompt = `You are a legal contract analysis AI. Analyze the contract and output ONLY valid JSON.

JSON STRUCTURE (output this exact structure):
{
  "executiveSummary": "Brief summary under 1500 chars",
  "dataProtectionImpact": "Data protection analysis under 1500 chars",
  "complianceScore": 75,
  "findings": [
    {
      "title": "Short title",
      "description": "Description under 800 chars",
      "riskLevel": "high",
      "jurisdiction": "UK",
      "category": "data-protection",
      "recommendations": ["Rec 1", "Rec 2"],
      "clauseReference": "Section X"
    }
  ],
  "jurisdictionSummaries": {
    "UK": {
      "jurisdiction": "UK",
      "applicableLaws": ["Law 1", "Law 2"],
      "keyFindings": ["Finding 1", "Finding 2"],
      "riskLevel": "high"
    }
  },
  "effectiveDate": "2025-08-11",
  "terminationDate": "2026-08-12",
  "renewalDate": "${notSpecifiedTranslatedString}",
  "contractType": "Service Agreement",
  "contractValue": "${notSpecifiedTranslatedString}",
  "parties": ["Party 1", "Party 2"],
  "liabilityCapSummary": "Summary",
  "indemnificationClauseSummary": "Summary",
  "confidentialityObligationsSummary": "Summary"
}

Output language: ${outputLanguage}
Jurisdictions: ${userSelectedJurisdictions.join(', ')}`;

            const gpt4oFallbackCompletion = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                { role: "system", content: gpt4oFallbackPrompt },
                { 
                  role: "user", 
                  content: `Contract Text:\n\n${gpt4oContractText}\n\nMetadata:\n${JSON.stringify(analysisData, null, 2)}` 
                },
              ],
              response_format: { type: "json_object" },
              temperature: 0.2,
            });

            const gpt4oFallbackContent = gpt4oFallbackCompletion.choices[0].message?.content;
            if (!gpt4oFallbackContent) {
              throw new Error(getTranslatedMessage('error_no_content_from_openai', userPreferredLanguage));
            }
            
            analysisData = safeJsonParse(gpt4oFallbackContent, "GPT-4o Fallback", userPreferredLanguage);
            console.log("contract-analyzer: DEBUG - GPT-4o Fallback analysis completed successfully");
          } else {
            // Re-throw if it's a different error
            throw claudeRetryError;
          }
        }
        
        console.log("contract-analyzer: DEBUG - Claude Sonnet 4.5 (Brain) analysis data:", analysisData);

        // Store in cache
        const { error: insertCacheError } = await supabase
          .from('cached_clause_analysis')
          .insert({
            clause_hash: cacheHash,
            jurisdiction: userSelectedJurisdictions,
            analysis_type: performAdvancedAnalysis ? 'advanced_dream_team' : 'basic_dream_team',
            llm_model: 'claude-sonnet-4-20250514',
            cached_result: analysisData,
          });
        if (insertCacheError) {
          console.warn("contract-analyzer: Error inserting into cache:", insertCacheError);
        }
      }

    } else {
      console.log(`contract-analyzer: DEBUG - Basic Analysis requested. Using GPT-4o All-in-One workflow.`);
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
- All string values must be properly escaped for JSON. Specifically, any double quotes (") and newline characters (\\n) within a string value must be escaped with a backslash.
- Ensure all arrays are correctly formatted with commas between elements and no trailing commas. All objects must have commas between key-value pairs and no trailing commas.
- All text fields within the JSON output MUST be generated in ${outputLanguage}. If translation is necessary, perform it accurately.
- Risk levels must be one of: high, medium, low, none.
- Categories must be one of: compliance, risk, data-protection, enforceability, drafting, commercial. 
- Apply the compliance score rules consistently to every analysis.

---
DOCUMENT LANGUAGE INSTRUCTIONS:
The contract text provided is in ${sourceLanguage === 'auto' ? 'an auto-detected language' : sourceLanguage}. If the source language === 'auto', please detect the language of the document.

OUTPUT LANGUAGE INSTRUCTIONS:
All text fields within the JSON output (executiveSummary, dataProtectionImpact, title, description, recommendations, keyFindings, applicableLaws, clauseReference) MUST be generated in ${outputLanguage}. If translation is necessary, perform it accurately.

JURISDICTION FOCUS:
The user has specified the following jurisdictions for this analysis: ${userSelectedJurisdictions.join(', ')}. Prioritize findings and applicable laws relevant to these jurisdictions. If a finding is relevant to multiple jurisdictions, you may include it, but ensure the primary focus remains on the user's selected jurisdictions.
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
      try {
        analysisData = safeJsonParse(aiResponseContent, "GPT-4o All-in-One", userPreferredLanguage);
      } catch (parseError: any) {
        console.error("contract-analyzer: JSON parsing failed for GPT-4o All-in-One output. Raw output:", aiResponseContent);
        throw new Error(`${getTranslatedMessage('error_failed_to_parse_ai_response', userPreferredLanguage)} (GPT-4o All-in-One): ${parseError.message}`);
      }
      console.log("contract-analyzer: DEBUG - GPT-4o (All-in-One) analysis data:", analysisData);
    }

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

    // Process and store artifacts
    let redlinedClauseArtifactPath: string | null = null;
    if (performAdvancedAnalysis && analysisData.redlinedClauseArtifact && analysisData.redlinedClauseArtifact.redlinedVersion) {
      const artifactContent = JSON.stringify(analysisData.redlinedClauseArtifact, null, 2);
      const artifactFileName = `redlined-clause-${contractId}-${Date.now()}.json`;
      const artifactFilePath = `${userId}/${contractId}/${artifactFileName}`;

      const { error: uploadArtifactError } = await supabase.storage
        .from('contract_artifacts')
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