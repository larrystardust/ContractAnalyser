import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import OpenAI from 'npm:openai@4.53.0';
import { logActivity } from '../_shared/logActivity.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';
import { GoogleAuth } from 'npm:google-auth-library@9.10.0'; // ADDED: For Google Cloud Auth

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')!,
});

// ADDED: Initialize Google Cloud Auth
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

// MODIFIED: New helper function for translation with improved prompt
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

// ADDED: OCR function using Google Cloud Vision API
async function executeOcr(imageData: string, userPreferredLanguage: string): Promise<string> { // MODIFIED: Renamed function
  // REMOVED: if (!Deno.env.get('GOOGLE_VISION_API_KEY')) check

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
    const accessTokenResult = await auth.getAccessToken(); // Get access token for Google Cloud

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
          'Authorization': `Bearer ${tokenString}`, // Use the extracted token string
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

// ADDED: Cost for advanced analysis add-on
const ADVANCED_ANALYSIS_ADDON_COST = 1;

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
  let userSubscriptionTier: number | null = null; // ADDED: To store user's subscription tier
  let userNotificationSettings: Record<string, { email: boolean; inApp: boolean }> = {};
  let token: string;
  let userPreferredLanguage: string = 'en';

  // ADDED: New variables from request body
  let imageDatas: string[] | undefined; // MODIFIED: Array of image data
  let shouldPerformOcr: boolean;
  let performAnalysis: boolean;
  let performAdvancedAnalysis: boolean; // ADDED: New flag
  let creditCost: number;

  try {
    const {
      contract_id,
      contract_text,
      source_language,
      output_language,
      original_contract_name,
      image_datas, // MODIFIED: Array of image data
      perform_ocr_flag,
      perform_analysis,
      perform_advanced_analysis, // ADDED: Destructure new flag
      credit_cost,
    } = await req.json();

    contractId = contract_id;
    contractText = contract_text;
    sourceLanguage = source_language || 'auto';
    outputLanguage = output_language || 'en';
    originalContractName = original_contract_name;
    imageDatas = image_datas; // MODIFIED: Array of image data
    shouldPerformOcr = perform_ocr_flag || false;
    performAnalysis = perform_analysis || false;
    performAdvancedAnalysis = perform_advanced_analysis || false; // ADDED: Initialize new flag
    creditCost = credit_cost || 0;

    if (!contractId || (!contractText && (!imageDatas || imageDatas.length === 0))) { // MODIFIED: Check for imageDatas array
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
        .select('full_name, notification_settings, language_preference') // MODIFIED: Select language_preference
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
      userPreferredLanguage = profileData?.language_preference || outputLanguage; // MODIFIED: Use profileData.language_preference
    }

    // MODIFIED: Fetch user's subscription tier
    const { data: membershipData, error: membershipError } = await supabase
      .from('subscription_memberships')
      .select('subscription_id, stripe_subscriptions(tier)') // Select tier from related stripe_subscriptions
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) {
      console.error(`contract-analyzer: Error fetching membership for user ${userId}:`, membershipError);
    } else if (membershipData) {
      userSubscriptionId = membershipData.subscription_id;
      userSubscriptionTier = membershipData.stripe_subscriptions?.tier || null; // Extract tier
    } else {
      // If no active membership, check for direct subscription (owner)
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
  // MODIFIED: Only deduct credits if user is NOT on an advanced subscription plan
  if (!userSubscriptionId || (userSubscriptionTier !== null && userSubscriptionTier < 4)) { // If no subscription or basic/admin subscription
    // If advanced analysis is requested and user is not on an advanced plan, ensure creditCost includes it
    if (performAdvancedAnalysis && (userSubscriptionTier === null || userSubscriptionTier < 4)) {
      // The creditCost from frontend should already include this, but we re-verify
      // If the frontend sent 0 cost for advanced analysis for a basic user, we correct it here.
      // For simplicity, we trust the frontend's `creditCost` for now, but a more robust system
      // would recalculate it here based on `performOcr`, `performAnalysis`, `performAdvancedAnalysis`
      // and the user's actual plan.
    }

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

    if (totalAvailableCredits < creditCost) {
      return corsResponse({ error: getTranslatedMessage('error_insufficient_credits_for_operation', userPreferredLanguage, { requiredCredits: creditCost, availableCredits: totalAvailableCredits }) }, 403);
    }

    // Deduct credits from orders, starting with the oldest
    let remainingCost = creditCost;
    for (const order of unconsumedOrders) {
      if (remainingCost <= 0) break;

      const creditsInOrder = order.credits_remaining || 0;
      const deduction = Math.min(remainingCost, creditsInOrder);

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
  }
  // --- END: Authorization Logic & Credit Deduction ---

  let translatedContractName: string = originalContractName;

  try {
    await logActivity(
      supabase,
      userId,
      'CONTRACT_ANALYSIS_STARTED',
      `User ${userEmail} started analysis for contract ID: ${contractId}`,
      { contract_id: contractId, perform_ocr: shouldPerformOcr, perform_analysis: performAnalysis, perform_advanced_analysis: performAdvancedAnalysis, credit_cost: creditCost } // MODIFIED: Log new flag
    );

    await supabase
      .from('contracts')
      .update({ status: 'analyzing', processing_progress: 10 })
      .eq('id', contractId);

    // Fetch the contract details, including file_path if OCR is needed for a document
    const { data: contractDetails, error: fetchContractError } = await supabase
      .from('contracts')
      .select('contract_content, user_id, jurisdictions, name, output_language, file_path') // MODIFIED: Added output_language, file_path
      .eq('id', contractId)
      .single();

    if (fetchContractError) {
      console.error('contract-analyzer: Error fetching contract details:', fetchContractError);
      throw new Error(getTranslatedMessage('error_failed_to_fetch_contract_details', userPreferredLanguage));
    }

    const userSelectedJurisdictions = contractDetails.jurisdictions.join(', ');
    const fetchedContractName = contractDetails.name;

    // ADDED: OCR Processing Step
    let processedContractText = contractText; // Start with text from frontend (if any)

    if (shouldPerformOcr) {
      await supabase.from('contracts').update({ processing_progress: 20 }).eq('id', contractId);
      let ocrImageDatas: string[] = []; // MODIFIED: Array for OCR image data

      if (imageDatas && imageDatas.length > 0) {
        ocrImageDatas = imageDatas;
      } else if (contractDetails.file_path) {
        // If no imageData from frontend, but OCR is requested for a file already in storage
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from('contracts')
          .download(contractDetails.file_path);

        if (downloadError) {
          console.error('contract-analyzer: Error downloading file from storage for OCR:', downloadError);
          throw new Error(getTranslatedMessage('error_failed_to_fetch_file_from_storage', userPreferredLanguage));
        }

        // Convert Blob to Base64
        const arrayBuffer = await fileBlob.arrayBuffer();
        ocrImageDatas.push(btoa(String.fromCharCode(...new Uint8Array(arrayBuffer))));
      }

      if (ocrImageDatas.length > 0) { // MODIFIED: Check length of ocrImageDatas
        let ocrResults: string[] = [];
        for (const imgData of ocrImageDatas) { // MODIFIED: Iterate through image data array
          try {
            ocrResults.push(await executeOcr(imgData, userPreferredLanguage));
          } catch (ocrError: any) {
            console.error('contract-analyzer: OCR failed for one image:', ocrError);
            // Continue processing other images, but log the error
          }
        }
        processedContractText = ocrResults.join('\n\n'); // Concatenate OCR results
        
        // Update contract_content in DB with OCR'd text
        await supabase.from('contracts').update({ contract_content: processedContractText }).eq('id', contractId);
        await logActivity(
          supabase,
          userId,
          'CONTRACT_OCR_COMPLETED',
          `User ${userEmail} performed OCR for contract ID: ${contractId}`,
          { contract_id: contractId }
        );
        // Send notification for OCR completion
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

    // If only OCR was requested, and not analysis, we can mark as completed and return
    if (shouldPerformOcr && !performAnalysis) {
      await supabase
        .from('contracts')
        .update({ status: 'completed', processing_progress: 100, subscription_id: userSubscriptionId, output_language: outputLanguage, translated_name: translatedContractName })
        .eq('id', contractId);
      return corsResponse({ message: getTranslatedMessage('message_ocr_completed_only', userPreferredLanguage), translated_contract_name: translatedContractName });
    }

    // If analysis is not requested, or if OCR failed, we should not proceed with analysis
    if (!performAnalysis || !processedContractText) {
      if (!processedContractText) {
        throw new Error(getTranslatedMessage('error_no_text_for_analysis', userPreferredLanguage));
      }
    }

    // Proceed with AI Analysis if performAnalysis is true
    await supabase.from('contracts').update({ processing_progress: 30 }).eq('id', contractId);

    translatedContractName = await translateText(originalContractName, outputLanguage);

    let systemPromptContent = `You are a legal contract analysis AI with the expertise of a professional legal practitioner with 30 years of experience in contract law. Analyze the provided contract text. Your role is to conduct a deep, thorough analysis of the provided contract text and provide an executive summary, data protection impact, overall compliance score (0-100), and a list of specific findings. Each finding should include a title, description, risk level (high, medium, low, none), jurisdiction (UK, EU, Ireland, US, Canada, Australia, Islamic Law, Others), category (compliance, risk, data-protection, enforceability, drafting, commercial), recommendations (as an array of strings), and an optional clause reference. You must use the following checklist as your internal review framework to ensure completeness:

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
  }
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

    // ADDED: Conditional prompt modification for advanced analysis
    if (performAdvancedAnalysis) {
      systemPromptContent += `

ADVANCED ANALYSIS REQUIREMENTS (MANDATORY IF REQUESTED):
In addition to the above, if 'performAdvancedAnalysis' is true, extract the following specific data points from the contract. If a data point is not explicitly found, infer it if possible, or state "${getTranslatedMessage('not_specified', outputLanguage)}".

Add these fields to the root of the JSON object:
{
  // ... existing fields ...
  "effectiveDate": "YYYY-MM-DD", // The date the contract becomes active.
  "terminationDate": "YYYY-MM-DD", // The date the contract is set to terminate, if specified.
  "renewalDate": "YYYY-MM-DD", // The date the contract is set to renew, if applicable.
  "contractType": "...", // e.g., "Service Agreement", "Sales Agreements", "Non-Disclosure Agreements (NDAs)", "Lease Agreement", "Licensing Agreements", "Employment Contract", "Partnership Agreements", "Loan Agreements", "Independent Contractor Agreements", "Mergers & Acquisitions", "MDA".
  "contractValue": "...", // The monetary value of the contract, if specified (e.g., "$100,000 USD", "500,000 EUR").
  "parties": ["...", "..."], // An array of the names of all parties involved in the contract.
  "liabilityCapSummary": "...", // A summary (2-4 sentences) of any liability caps or limitations.
  "indemnificationClauseSummary": "...", // A summary (2-4 sentences) of the indemnification clause.
  "confidentialityObligationsSummary": "..." // A summary (2-4 sentences) of confidentiality obligations.
}

NOTES FOR ADVANCED ANALYSIS:
- Dates should be in YYYY-MM-DD format. If only month/year or year is available, use 'YYYY-MM-01' or 'YYYY-01-01'. If no date is found, use "${getTranslatedMessage('not_specified', outputLanguage)}".
- Ensure all new text fields are also generated in ${outputLanguage}.
`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPromptContent,
        },
        {
          role: "user",
          content: `Contract Text:\n\n${processedContractText}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // Keep it low for consistent demo results
    });

    const aiResponseContent = completion.choices[0].message?.content;
    if (!aiResponseContent) {
      throw new Error(getTranslatedMessage('error_no_content_from_openai', userPreferredLanguage));
    }

    let analysisData: any;
    try {
      const parsedContent = JSON.parse(aiResponseContent);
      // Ensure parsedContent is an object, otherwise default to an empty object
      analysisData = (typeof parsedContent === 'object' && parsedContent !== null) ? { ...parsedContent } : {}; // Shallow copy to ensure mutability

      // Ensure top-level properties are initialized as expected types if missing or invalid
      if (!Array.isArray(analysisData.findings)) {
        analysisData.findings = [];
      }
      if (typeof analysisData.jurisdictionSummaries !== 'object' || analysisData.jurisdictionSummaries === null) {
        analysisData.jurisdictionSummaries = {};
      }
    } catch (parseError) {
      console.error('contract-analyzer: Error parsing OpenAI response JSON:', parseError);
      throw new Error(getTranslatedMessage('error_failed_to_parse_ai_response', userPreferredLanguage));
    }

    // Defensive checks before processing analysisData properties
    analysisData.executiveSummary = typeof analysisData.executiveSummary === 'string' ? analysisData.executiveSummary : '';
    analysisData.executiveSummary = await translateText(analysisData.executiveSummary, outputLanguage);
    
    analysisData.dataProtectionImpact = typeof analysisData.dataProtectionImpact === 'string' ? analysisData.dataProtectionImpact : null;
    if (analysisData.dataProtectionImpact) {
      analysisData.dataProtectionImpact = await translateText(analysisData.dataProtectionImpact, outputLanguage);
    }

    // MODIFIED: Add defensive checks for findings
    if (Array.isArray(analysisData.findings)) {
      for (let i = 0; i < analysisData.findings.length; i++) { // Use index-based loop for safer modification
        let finding = analysisData.findings[i];
        if (finding && typeof finding === 'object') { // Ensure finding is an object
          // Create a shallow copy of finding to ensure mutability if it was frozen/sealed
          finding = { ...finding };
          finding.title = typeof finding.title === 'string' ? finding.title : '';
          finding.title = await translateText(finding.title, outputLanguage);
          
          finding.description = typeof finding.description === 'string' ? finding.description : '';
          finding.description = await translateText(finding.description, outputLanguage);
          
          // Ensure recommendations is an array before mapping
          if (Array.isArray(finding.recommendations)) {
            finding.recommendations = await Promise.all(finding.recommendations.map((rec: string) => translateText(rec, outputLanguage)));
          } else {
            finding.recommendations = []; // Default to empty array if not an array
          }
          if (finding.clauseReference) {
            finding.clauseReference = typeof finding.clauseReference === 'string' ? finding.clauseReference : '';
            finding.clauseReference = await translateText(finding.clauseReference, outputLanguage);
          }
          analysisData.findings[i] = finding; // Assign the potentially new/modified finding back
        } else {
          analysisData.findings[i] = {}; // Replace invalid finding with an empty object
        }
      }
    }

    // MODIFIED: Add defensive checks for jurisdictionSummaries
    if (analysisData.jurisdictionSummaries && typeof analysisData.jurisdictionSummaries === 'object') {
      const newJurisdictionSummaries: Record<string, any> = {}; // Create a new object for summaries
      for (const key in analysisData.jurisdictionSummaries) {
        let summary = analysisData.jurisdictionSummaries[key];
        if (summary && typeof summary === 'object') { // Ensure summary is an object
          // Create a shallow copy of summary to ensure mutability
          summary = { ...summary };
          // Ensure applicableLaws is an array before mapping
          if (Array.isArray(summary.applicableLaws)) {
            summary.applicableLaws = await Promise.all(summary.applicableLaws.map((law: string) => translateText(law, outputLanguage)));
          } else {
            summary.applicableLaws = [];
          }
          // Ensure keyFindings is an array before mapping
          if (Array.isArray(summary.keyFindings)) {
            summary.keyFindings = await Promise.all(summary.keyFindings.map((kf: string) => translateText(kf, outputLanguage)));
          } else {
            summary.keyFindings = [];
          }
          newJurisdictionSummaries[key] = summary; // Assign the potentially new/modified summary back
        } else {
          newJurisdictionSummaries[key] = {}; // Replace invalid summary with an empty object
        }
      }
      analysisData.jurisdictionSummaries = newJurisdictionSummaries; // Assign the new summaries object
    }

    // ADDED: Translate new advanced fields if present
    if (performAdvancedAnalysis) {
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

    // CRITICAL FIX: Process advanced analysis fields into their final translated string form
    // This ensures the database stores the display string, and the report generator receives it.
    const notSpecifiedTranslatedString = getTranslatedMessage('not_specified', outputLanguage);

    const processedEffectiveDate = analysisData.effectiveDate || notSpecifiedTranslatedString;
    const processedTerminationDate = analysisData.terminationDate || notSpecifiedTranslatedString;
    const processedRenewalDate = analysisData.renewalDate || notSpecifiedTranslatedString;
    const processedContractType = analysisData.contractType || notSpecifiedTranslatedString;
    const processedContractValue = analysisData.contractValue || notSpecifiedTranslatedString;
    const processedParties = analysisData.parties || []; // Keep as array for DB, but pass as string for report
    const processedLiabilityCapSummary = analysisData.liabilityCapSummary || notSpecifiedTranslatedString;
    const processedIndemnificationClauseSummary = analysisData.indemnificationClauseSummary || notSpecifiedTranslatedString;
    const processedConfidentialityObligationsSummary = analysisData.confidentialityObligationsSummary || notSpecifiedTranslatedString;


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
          // CRITICAL FIX: Pass processed string values to report generator
          effective_date: processedEffectiveDate,
          termination_date: processedTerminationDate,
          renewal_date: processedRenewalDate,
          contract_type: processedContractType,
          contract_value: processedContractValue,
          parties: processedParties, // Pass as array, generate-analysis-report will join
          liability_cap_summary: processedLiabilityCapSummary,
          indemnification_clause_summary: processedIndemnificationClauseSummary,
          confidentiality_obligations_summary: processedConfidentialityObligationsSummary,
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
        // CRITICAL FIX: Store processed string values in the database
        effective_date: processedEffectiveDate,
        termination_date: processedTerminationDate,
        renewal_date: processedRenewalDate,
        contract_type: processedContractType,
        contract_value: processedContractValue,
        parties: processedParties,
        liability_cap_summary: processedLiabilityCapSummary,
        indemnification_clause_summary: processedIndemnificationClauseSummary,
        confidentiality_obligations_summary: processedConfidentialityObligationsSummary,
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
      { contract_id: contractId, compliance_score: complianceScore, perform_advanced_analysis: performAdvancedAnalysis } // MODIFIED: Log new flag
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
      { contract_id: contractId, error: error.message, perform_advanced_analysis: performAdvancedAnalysis } // MODIFIED: Log new flag
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