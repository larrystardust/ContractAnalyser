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
const auth = new GoogleAuth({
  credentials: {
    client_email: Deno.env.get('GOOGLE_CLIENT_EMAIL'),
    private_key: Deno.env.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n'), // Handle private key newlines
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
async function translateText(text: string, targetLanguage: string): Promise<string> {
  if (!text || targetLanguage === 'en') { // No need to translate if empty or target is English
    return text;
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
      return text;
    }
    return translatedContent;
  } catch (error) {
    console.error(`translateText: Error translating text to ${targetLanguage}:`, error);
    return text; // Return original text on error
  }
}

// ADDED: OCR function using Google Cloud Vision API
async function performOcr(imageData: string, userPreferredLanguage: string): Promise<string> {
  if (!Deno.env.get('GOOGLE_VISION_API_KEY')) {
    throw new Error(getTranslatedMessage('error_missing_ocr_api_key', userPreferredLanguage));
  }

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
    const accessToken = await auth.getAccessToken(); // Get access token for Google Cloud
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${Deno.env.get('GOOGLE_VISION_API_KEY')}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken.token}`, // Use access token for auth
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
  let userNotificationSettings: Record<string, { email: boolean; inApp: boolean }> = {};
  let token: string;
  let userPreferredLanguage: string = 'en';

  // ADDED: New variables from request body
  let imageData: string | undefined;
  let performOcr: boolean;
  let performAnalysis: boolean;
  let creditCost: number;

  try {
    const {
      contract_id,
      contract_text,
      source_language,
      output_language,
      original_contract_name,
      image_data, // ADDED
      perform_ocr, // ADDED
      perform_analysis, // ADDED
      credit_cost, // ADDED
    } = await req.json();

    contractId = contract_id;
    contractText = contract_text;
    sourceLanguage = source_language || 'auto';
    outputLanguage = output_language || 'en';
    originalContractName = original_contract_name;
    imageData = image_data; // ADDED
    performOcr = perform_ocr || false; // ADDED
    performAnalysis = perform_analysis || false; // ADDED
    creditCost = credit_cost || 0; // ADDED

    if (!contractId || (!contractText && !imageData)) { // MODIFIED: contractText is optional if imageData is present
      return corsResponse({ error: 'Missing contract_id and either contract_text or image_data' }, 400);
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
        .select('full_name, notification_settings, theme_preference')
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
      userPreferredLanguage = outputLanguage;
    }

    const { data: membershipData, error: membershipError } = await supabase
      .from('subscription_memberships')
      .select('subscription_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) {
      console.error(`contract-analyzer: Error fetching membership for user ${userId}:`, membershipError);
    } else if (membershipData) {
      userSubscriptionId = membershipData.subscription_id;
    } else {
      // User has no active membership.
    }

  } catch (error) {
    console.error('contract-analyzer: Error parsing request body or authenticating user:', error);
    return corsResponse({ error: 'Invalid request or authentication failed' }, 400);
  }

  let consumedOrderId: number | null = null;

  // --- START: Authorization Logic & Credit Deduction ---
  if (!userSubscriptionId) { // Only check credits if no active subscription
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
      { contract_id: contractId, perform_ocr: performOcr, perform_analysis: performAnalysis, credit_cost: creditCost }
    );

    await supabase
      .from('contracts')
      .update({ status: 'analyzing', processing_progress: 10 })
      .eq('id', contractId);

    // Fetch the contract details, including file_path if OCR is needed for a document
    const { data: contractDetails, error: fetchContractError } = await supabase
      .from('contracts')
      .select('contract_content, user_id, jurisdictions, name, file_path') // MODIFIED: Added file_path
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

    if (performOcr) {
      await supabase.from('contracts').update({ processing_progress: 20 }).eq('id', contractId);
      let ocrImageData: string | undefined = imageData;

      if (!ocrImageData && contractDetails.file_path) {
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
        ocrImageData = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      }

      if (ocrImageData) {
        try {
          processedContractText = await performOcr(ocrImageData, userPreferredLanguage);
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
        } catch (ocrError: any) {
          console.error('contract-analyzer: OCR failed:', ocrError);
          await supabase.from('contracts').update({ status: 'ocr_failed' }).eq('id', contractId); // New status for OCR failure
          await logActivity(
            supabase,
            userId,
            'CONTRACT_OCR_FAILED',
            `User ${userEmail} failed OCR for contract ID: ${contractId}. Error: ${ocrError.message}`,
            { contract_id: contractId, error: ocrError.message }
          );
          // Send notification for OCR failure
          await supabase.from('notifications').insert({
            user_id: userId,
            title: 'notification_title_ocr_failed',
            message: getTranslatedMessage('notification_message_ocr_failed', userPreferredLanguage, { contractName: originalContractName, errorMessage: ocrError.message }),
            type: 'error',
          });
          throw ocrError; // Re-throw to stop further processing if OCR is critical
        }
      } else {
        throw new Error(getTranslatedMessage('error_no_image_data_for_ocr', userPreferredLanguage));
      }
    }

    // If only OCR was requested, and not analysis, we can mark as completed and return
    if (performOcr && !performAnalysis) {
      await supabase
        .from('contracts')
        .update({ status: 'completed', processing_progress: 100, subscription_id: userSubscriptionId, output_language: outputLanguage, translated_name: translatedContractName })
        .eq('id', contractId);
      return corsResponse({ message: getTranslatedMessage('message_ocr_completed_only', userPreferredLanguage), translated_contract_name: translatedContractName });
    }

    // If analysis is not requested, or if OCR failed, we should not proceed with analysis
    if (!performAnalysis || !processedContractText) {
      // If OCR was performed but no analysis, the above block handles it.
      // If no OCR and no analysis, this is an invalid state, or just a text upload without analysis.
      // For now, we assume if performAnalysis is false, we stop here.
      // If processedContractText is empty here, it means no text was available for analysis.
      if (!processedContractText) {
        throw new Error(getTranslatedMessage('error_no_text_for_analysis', userPreferredLanguage));
      }
    }

    // Proceed with AI Analysis if performAnalysis is true
    await supabase.from('contracts').update({ processing_progress: 30 }).eq('id', contractId);

    translatedContractName = await translateText(originalContractName, outputLanguage);

    const systemPromptContent = `You are a legal contract analysis AI with the expertise of a professional legal practitioner with 30 years of experience in contract law. Analyze the provided contract text. Your role is to conduct a deep, thorough analysis of the provided contract text and provide an executive summary, data protection impact, overall compliance score (0-100), and a list of specific findings. Each finding should include a title, description, risk level (high, medium, low, none), jurisdiction (UK, EU, Ireland, US, Canada, Australia, Islamic Law, Others), category (compliance, risk, data-protection, enforceability, drafting, commercial), recommendations (as an array of strings), and an optional clause reference. You must use the following checklist as your internal review framework to ensure completeness:

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPromptContent,
        },
        {
          role: "user",
          content: `Contract Text:\n\n${processedContractText}`, // MODIFIED: Use processedContractText
        },
      ],
      response_format: { type: "json_object" },
    });

    const aiResponseContent = completion.choices[0].message?.content;
    if (!aiResponseContent) {
      throw new Error(getTranslatedMessage('error_no_content_from_openai', userPreferredLanguage));
    }

    let analysisData: any;
    try {
      analysisData = JSON.parse(aiResponseContent);
    } catch (parseError) {
      console.error('contract-analyzer: Error parsing OpenAI response JSON:', parseError);
      throw new Error(getTranslatedMessage('error_failed_to_parse_ai_response', userPreferredLanguage));
    }

    analysisData.executiveSummary = await translateText(analysisData.executiveSummary, outputLanguage);
    
    if (analysisData.dataProtectionImpact) {
      analysisData.dataProtectionImpact = await translateText(analysisData.dataProtectionImpact, outputLanguage);
    }

    for (const finding of analysisData.findings) {
      finding.title = await translateText(finding.title, outputLanguage);
      finding.description = await translateText(finding.description, outputLanguage);
      finding.recommendations = await Promise.all(finding.recommendations.map((rec: string) => translateText(rec, outputLanguage)));
      if (finding.clauseReference) {
        finding.clauseReference = await translateText(finding.clauseReference, outputLanguage);
      }
    }

    for (const key in analysisData.jurisdictionSummaries) {
      const summary = analysisData.jurisdictionSummaries[key];
      summary.applicableLaws = await Promise.all(summary.applicableLaws.map((law: string) => translateText(law, outputLanguage)));
      summary.keyFindings = await Promise.all(summary.keyFindings.map((kf: string) => translateText(kf, outputLanguage)));
    }

    const executiveSummary = typeof analysisData.executiveSummary === 'string' ? analysisData.executiveSummary : getTranslatedMessage('no_executive_summary_provided', outputLanguage);
    const dataProtectionImpact = typeof analysisData.dataProtectionImpact === 'string' ? analysisData.dataProtectionImpact : null;
    const complianceScore = typeof analysisData.complianceScore === 'number' ? analysisData.complianceScore : 0;
    const findings = Array.isArray(analysisData.findings) ? analysisData.findings : [];
    const jurisdictionSummaries = typeof analysisData.jurisdictionSummaries === 'object' && analysisData.jurisdictionSummaries !== null ? analysisData.jurisdictionSummaries : {};

    await supabase.from('contracts').update({ processing_progress: 70 }).eq('id', contractId);

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
      const notificationMessage = getTranslatedMessage('analysis_complete_message', userPreferredLanguage, { contractName: notificationContractName });
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
      const notificationMessage = getTranslatedMessage('high_risk_findings_message', userPreferredLanguage, { contractName: notificationContractName, count: highRiskFindings.length });
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
      { contract_id: contractId, compliance_score: complianceScore }
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
      { contract_id: contractId, error: error.message }
    );

    const notificationContractName = translatedContractName;

    if (userNotificationSettings['analysis-complete']?.inApp) {
      const notificationMessage = getTranslatedMessage('analysis_failed_message', userPreferredLanguage, { contractName: notificationContractName });
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