import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import OpenAI from 'npm:openai@4.53.0';
import Anthropic from 'npm:@anthropic-ai/sdk'; // MODIFIED: Changed import path for Anthropic
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { logActivity } from '../_shared/logActivity.ts';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';
import { GoogleAuth } from 'npm:google-auth-library@9.10.0';
import { stripeProducts } from '../_shared/stripe_products_data.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')!,
});

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
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

// Helper function for translation
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(null, 204);
  }

  if (req.method !== 'POST') {
    return corsResponse({ error: 'Method not allowed' }, 405);
  }

  let contractId: string;
  let contractText: string | undefined;
  let imageDatas: string[] | undefined;
  let sourceLanguage: string;
  let outputLanguage: string;
  let originalContractName: string;
  let performOcrFlag: boolean;
  let performAnalysis: boolean;
  let performAdvancedAnalysis: boolean;
  let creditCost: number;
  let userId: string;
  let userEmail: string;
  let userPreferredLanguage: string = 'en'; // Default to English

  try {
    const requestBody = await req.json();
    contractId = requestBody.contract_id;
    contractText = requestBody.contract_text;
    imageDatas = requestBody.image_datas;
    sourceLanguage = requestBody.source_language || 'auto';
    outputLanguage = requestBody.output_language || 'en';
    originalContractName = requestBody.original_contract_name || 'Untitled Contract';
    performOcrFlag = requestBody.perform_ocr_flag || false;
    performAnalysis = requestBody.perform_analysis || false;
    performAdvancedAnalysis = requestBody.perform_advanced_analysis || false;
    creditCost = requestBody.credit_cost || 0;

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
      return corsResponse({ error: 'Unauthorized: Invalid or missing user token' }, 401);
    }
    userId = user.id;
    userEmail = user.email!;

    // Fetch user's preferred language from profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('language_preference')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.warn('contract-analyzer: Error fetching user profile for language:', profileError);
    } else if (profileData?.language_preference) {
      userPreferredLanguage = profileData.language_preference;
    }

    // Fetch subscription details to determine if user is on an advanced plan
    let userSubscriptionTier: number | null = null;
    const { data: membershipData, error: membershipError } = await supabase
      .from('subscription_memberships')
      .select('subscription_id, stripe_subscriptions(tier)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) {
      console.error(`contract-analyzer: Error fetching membership for user ${userId}:`, membershipError);
    } else if (membershipData) {
      userSubscriptionTier = membershipData.stripe_subscriptions?.tier || null;
    } else {
      // If no membership, check for direct subscription (owner)
      const { data: customerData, error: customerError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!customerError && customerData?.customer_id) {
        const { data: directSubData, error: directSubError } = await supabase
          .from('stripe_subscriptions')
          .select('tier')
          .eq('customer_id', customerData.customer_id)
          .eq('status', 'active')
          .maybeSingle();

        if (!directSubError && directSubData) {
          userSubscriptionTier = directSubData.tier || null;
        }
      }
    }

    // Determine if the user is on an advanced plan (Tier 4 or 5)
    const isAdvancedPlanUser = userSubscriptionTier !== null && (userSubscriptionTier === 4 || userSubscriptionTier === 5);
    // console.log(`contract-analyzer: DEBUG - User ${userId} subscription tier: ${userSubscriptionTier}, isAdvancedPlanUser: ${isAdvancedPlanUser}`); // REMOVED

    // --- Credit Deduction Logic ---
    if (creditCost > 0) {
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
        .order('created_at', { ascending: true }); // Deduct from oldest credits first

      if (ordersError) {
        console.error('contract-analyzer: Error fetching unconsumed orders:', ordersError);
        return corsResponse({ error: getTranslatedMessage('error_failed_to_check_available_credits', userPreferredLanguage) }, 500);
      }

      let totalAvailableCredits = unconsumedOrders.reduce((sum, order) => sum + (order.credits_remaining || 0), 0);

      if (totalAvailableCredits < creditCost) {
        return corsResponse({ error: getTranslatedMessage('error_insufficient_credits_for_operation', userPreferredLanguage, { requiredCredits: creditCost, availableCredits: totalAvailableCredits }) }, 403);
      }

      // Deduct credits
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
      }
      console.log(`contract-analyzer: Deducted ${creditCost} credits for contract ${contractId}. Remaining cost: ${remainingCost}`);
    }
    // --- End Credit Deduction Logic ---

    // Update contract status to 'analyzing'
    await supabase.from('contracts').update({ status: 'analyzing', processing_progress: 0 }).eq('id', contractId);

    // --- OCR Phase (if image data is provided or OCR is explicitly requested) ---
    if (imageDatas && imageDatas.length > 0) {
      console.log(`contract-analyzer: DEBUG - Performing OCR for ${imageDatas.length} images.`);
      await supabase.from('contracts').update({ processing_progress: 10 }).eq('id', contractId);

      const ocrPromises = imageDatas.map(async (imageData, index) => {
        const ocrPrompt = `Extract all text from the following image. Preserve line breaks and formatting as much as possible. If the image contains multiple pages, extract text from each page sequentially.`;
        const ocrCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: ocrPrompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${imageData}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
        });
        return ocrCompletion.choices[0].message?.content || '';
      });

      const ocrResults = await Promise.all(ocrPromises);
      contractText = ocrResults.join('\n\n--- Page Break ---\n\n');
      console.log(`contract-analyzer: DEBUG - OCR completed. Extracted text length: ${contractText.length}`);
      await supabase.from('contracts').update({ contract_content: contractText, processing_progress: 20 }).eq('id', contractId);
    } else if (performOcrFlag && !contractText) {
      // This case should ideally not be hit if frontend handles text extraction for PDF/DOCX
      // but as a fallback, if performOcrFlag is true and no text, it means it's a non-selectable PDF/DOCX
      // and we need to fetch the file from storage and perform OCR.
      console.log(`contract-analyzer: DEBUG - performOcrFlag is true but no contractText. Fetching file from storage for OCR.`);
      await supabase.from('contracts').update({ processing_progress: 10 }).eq('id', contractId);

      const { data: contractData, error: fetchContractError } = await supabase
        .from('contracts')
        .select('file_path')
        .eq('id', contractId)
        .single();

      if (fetchContractError || !contractData?.file_path) {
        throw new Error(getTranslatedMessage('error_contract_file_not_found', userPreferredLanguage));
      }

      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('contracts')
        .download(contractData.file_path);

      if (downloadError) {
        throw new Error(getTranslatedMessage('error_failed_to_download_contract_file', userPreferredLanguage, { errorMessage: downloadError.message }));
      }

      const base64File = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
          } else {
            reject(new Error('Failed to read file as Base64.'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(fileBlob);
      });

      const ocrPrompt = `Extract all text from the following document. Preserve line breaks and formatting as much as possible. If the document contains multiple pages, extract text from each page sequentially.`;
      const ocrCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: ocrPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64File}`, // Assuming it's a PDF for OCR
                },
              },
            ],
          },
        ],
        max_tokens: 4000,
      });
      contractText = ocrCompletion.choices[0].message?.content || '';
      console.log(`contract-analyzer: DEBUG - OCR from storage completed. Extracted text length: ${contractText.length}`);
      await supabase.from('contracts').update({ contract_content: contractText, processing_progress: 20 }).eq('id', contractId);
    }

    if (!contractText) {
      await supabase.from('contracts').update({ status: 'ocr_failed' }).eq('id', contractId);
      throw new Error(getTranslatedMessage('error_no_extractable_text_from_contract', userPreferredLanguage));
    }

    // --- Analysis Phase ---
    if (!performAnalysis) {
      console.log(`contract-analyzer: DEBUG - Analysis not requested for contract ${contractId}. Skipping analysis phase.`);
      await supabase.from('contracts').update({ status: 'completed', processing_progress: 100 }).eq('id', contractId);
      await logActivity(
        supabase,
        userId,
        'CONTRACT_UPLOADED_NO_ANALYSIS',
        `User ${userEmail} uploaded contract ${originalContractName} (ID: ${contractId}) without analysis.`,
        { contract_id: contractId, contract_name: originalContractName }
      );
      return corsResponse({ message: 'Contract uploaded, analysis skipped.' });
    }

    await supabase.from('contracts').update({ processing_progress: 30 }).eq('id', contractId);

    // Translate contract name if output language is different from English
    let translatedContractName = originalContractName;
    if (outputLanguage !== 'en') {
      translatedContractName = await translateText(originalContractName, outputLanguage);
      await supabase.from('contracts').update({ translated_name: translatedContractName }).eq('id', contractId);
    }

    const notSpecifiedTranslatedString = getTranslatedMessage('not_specified', outputLanguage);

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
    - All string values must be properly escaped for JSON. Specifically, any double quotes within a string value must be escaped with a backslash (\\"). // MODIFIED: Added instruction
    - All text fields within the JSON output MUST be generated in English for consistent input to the next stage.
    `;

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
    - All string values must be properly escaped for JSON. Specifically, any double quotes within a string value must be escaped with a backslash (\\"). // MODIFIED: Added instruction
    - All text fields within the JSON output MUST be generated in ${outputLanguage}. If translation is necessary, perform it accurately.
    - Risk levels must be one of: high, medium, low, none.
    - Categories must be one of: compliance, risk, data-protection, enforceability, drafting, commercial.
    - Dates should be in YYYY-MM-DD format. If only month/year or year is available, use 'YYYY-MM-01' or 'YYYY-01-01'. If no date is found, use '${notSpecifiedTranslatedString}'.
    - For 'redlinedClauseArtifact', if no suitable high-risk clause is found, set the entire object to null or 'not_applicable'.
    `;

    let analysisData: any;
    let gpt4oExtractedData: any;

    // --- Dream Team Logic: Conditional LLM Orchestration ---
    if (performAdvancedAnalysis) { // MODIFIED: Use performAdvancedAnalysis flag
      console.log(`contract-analyzer: DEBUG - Advanced Analysis requested. Using Dream Team workflow.`); // MODIFIED

      // Phase 1: GPT-4o as "Eyes" for initial extraction and structuring
      await supabase.from('contracts').update({ processing_progress: 40 }).eq('id', contractId);
      const gpt4oCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: gpt4oSystemPrompt },
          { role: "user", content: `Contract Text:\n\n${contractText}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4000,
      });

      const gpt4oOutputContent = gpt4oCompletion.choices[0].message?.content;
      if (!gpt4oOutputContent) {
        throw new Error(getTranslatedMessage('error_no_content_from_openai', userPreferredLanguage));
      }
      gpt4oExtractedData = JSON.parse(gpt4oOutputContent);
      console.log("contract-analyzer: DEBUG - GPT-4o (Eyes) extracted data:", gpt4oExtractedData);

      // Phase 2: Claude Sonnet 4.5 as "Brain" for deep analysis
      await supabase.from('contracts').update({ processing_progress: 60 }).eq('id', contractId);
      const claudeCompletion = await anthropic.messages.create({
        model: "claude-sonnet-4-5", // MODIFIED: Use the correct API identifier for Claude Sonnet 4.5
        max_tokens: 4000,
        temperature: 0.2,
        system: claudeSystemPrompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `Full Contract Text:\n\n${contractText}\n\nStructured Metadata from GPT-4o:\n\n${JSON.stringify(gpt4oExtractedData, null, 2)}` }
            ]
          }
        ]
      });

      const claudeOutputContent = claudeCompletion.content[0].text;
      if (!claudeOutputContent) {
        throw new Error(getTranslatedMessage('error_no_content_from_claude', userPreferredLanguage));
      }
      
      // MODIFIED: Remove markdown code block fences before parsing JSON
      const cleanedClaudeOutput = claudeOutputContent.replace(/```json\n?|```/g, '').trim();
      
      analysisData = JSON.parse(cleanedClaudeOutput); // MODIFIED: Parse the cleaned output
      console.log("contract-analyzer: DEBUG - Claude Sonnet 4.5 (Brain) analysis data:", analysisData);

    } else { // Non-Advanced Analysis: GPT-4o as "All-in-One"
      console.log(`contract-analyzer: DEBUG - Basic Analysis requested. Using GPT-4o All-in-One workflow.`); // MODIFIED
      await supabase.from('contracts').update({ processing_progress: 50 }).eq('id', contractId);

      const gpt4oAllInOneSystemPrompt = `You are a legal contract analysis AI. Your task is to provide a comprehensive analysis of the provided legal contract text.

      Based on the provided contract text, generate:
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
      - All string values must be properly escaped for JSON. Specifically, any double quotes within a string value must be escaped with a backslash (\\"). // MODIFIED: Added instruction
      - All text fields within the JSON output MUST be generated in ${outputLanguage}. If translation is necessary, perform it accurately.
      - Risk levels must be one of: high, medium, low, none.
      - Categories must be one of: compliance, risk, data-protection, enforceability, drafting, commercial.
      - Dates should be in YYYY-MM-DD format. If only month/year or year is available, use 'YYYY-MM-01' or 'YYYY-01-01'. If no date is found, use '${notSpecifiedTranslatedString}'.
      `;

      const gpt4oAllInOneCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: gpt4oAllInOneSystemPrompt },
          { role: "user", content: `Contract Text:\n\n${contractText}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 4000,
      });

      const gpt4oAllInOneOutputContent = gpt4oAllInOneCompletion.choices[0].message?.content;
      if (!gpt4oAllInOneOutputContent) {
        throw new Error(getTranslatedMessage('error_no_content_from_openai', userPreferredLanguage));
      }
      analysisData = JSON.parse(gpt4oAllInOneOutputContent);
      console.log("contract-analyzer: DEBUG - GPT-4o All-in-One analysis data:", analysisData);
    }

    // --- Post-processing and Database Insertion ---
    await supabase.from('contracts').update({ processing_progress: 80 }).eq('id', contractId);

    // Ensure findings and jurisdictionSummaries are arrays/objects even if LLM returns null/undefined
    const findings = analysisData.findings || [];
    const jurisdictionSummaries = analysisData.jurisdictionSummaries || {};

    // Calculate compliance score based on findings
    let complianceScore = 100;
    findings.forEach((finding: any) => {
      switch (finding.riskLevel) {
        case 'high':
          complianceScore -= 15;
          break;
        case 'medium':
          complianceScore -= 8;
          break;
        case 'low':
          complianceScore -= 3;
          break;
      }
    });
    complianceScore = Math.max(0, Math.round(complianceScore)); // Ensure score is not negative and is rounded

    // Insert analysis result
    const { data: analysisResultData, error: insertAnalysisError } = await supabase
      .from('analysis_results')
      .insert({
        contract_id: contractId,
        executive_summary: analysisData.executiveSummary,
        data_protection_impact: analysisData.dataProtectionImpact,
        compliance_score: complianceScore,
        jurisdiction_summaries: jurisdictionSummaries,
        // Advanced analysis fields
        effective_date: analysisData.effectiveDate === notSpecifiedTranslatedString ? null : analysisData.effectiveDate,
        termination_date: analysisData.terminationDate === notSpecifiedTranslatedString ? null : analysisData.terminationDate,
        renewal_date: analysisData.renewalDate === notSpecifiedTranslatedString ? null : analysisData.renewalDate,
        contract_type: analysisData.contractType,
        contract_value: analysisData.contractValue,
        parties: analysisData.parties,
        liability_cap_summary: analysisData.liabilityCapSummary,
        indemnification_clause_summary: analysisData.indemnificationClauseSummary,
        confidentiality_obligations_summary: analysisData.confidentialityObligationsSummary,
        performed_advanced_analysis: performAdvancedAnalysis, // Store the flag
      })
      .select()
      .single();

    if (insertAnalysisError) {
      console.error('contract-analyzer: Error inserting analysis result:', insertAnalysisError);
      throw new Error(getTranslatedMessage('error_failed_to_save_analysis_results', userPreferredLanguage));
    }

    // Insert findings
    const findingsToInsert = findings.map((finding: any) => ({
      analysis_result_id: analysisResultData.id,
      title: finding.title,
      description: finding.description,
      risk_level: finding.riskLevel,
      jurisdiction: finding.jurisdiction,
      category: finding.category,
      recommendations: finding.recommendations,
      clause_reference: finding.clauseReference,
    }));

    if (findingsToInsert.length > 0) {
      const { error: insertFindingsError } = await supabase
        .from('findings')
        .insert(findingsToInsert);

      if (insertFindingsError) {
        console.error('contract-analyzer: Error inserting findings:', insertFindingsError);
        throw new Error(getTranslatedMessage('error_failed_to_save_findings', userPreferredLanguage));
      }
    }

    // Handle Redlined Clause Artifact
    let redlinedClauseArtifactPath: string | null = null;
    if (performAdvancedAnalysis && analysisData.redlinedClauseArtifact && analysisData.redlinedClauseArtifact !== 'not_applicable') {
      try {
        const artifactFileName = `redlined_clause_${contractId}.json`;
        const artifactFilePath = `${userId}/${contractId}/${artifactFileName}`;

        const { data: uploadArtifactData, error: uploadArtifactError } = await supabase.storage
          .from('contract_artifacts')
          .upload(artifactFilePath, JSON.stringify(analysisData.redlinedClauseArtifact), {
            contentType: 'application/json',
            upsert: true,
          });

        if (uploadArtifactError) {
          console.error('contract-analyzer: Error uploading redlined clause artifact:', uploadArtifactError);
        } else {
          redlinedClauseArtifactPath = artifactFilePath;
          // Update analysis_results with the path
          await supabase.from('analysis_results').update({ redlined_clause_artifact_path: redlinedClauseArtifactPath }).eq('id', analysisResultData.id);
        }
      } catch (artifactError) {
        console.error('contract-analyzer: Error processing redlined clause artifact:', artifactError);
      }
    }

    // Generate and upload HTML report
    await supabase.from('contracts').update({ processing_progress: 90 }).eq('id', contractId);
    const { data: reportData, error: reportError } = await supabase.functions.invoke('generate-analysis-report', {
      body: {
        contractId: contractId,
        contractName: translatedContractName,
        analysisResult: {
          ...analysisResultData,
          findings: findingsToInsert, // Pass the inserted findings
          jurisdiction_summaries: jurisdictionSummaries,
          redlined_clause_artifact_path: redlinedClauseArtifactPath,
        },
        outputLanguage: outputLanguage,
      },
      headers: {
        'Authorization': `Bearer ${token}`, // Pass the current user's token
      },
    });

    if (reportError) {
      console.error('contract-analyzer: Error generating report:', reportError);
      throw new Error(getTranslatedMessage('error_failed_to_generate_report', userPreferredLanguage));
    }

    // Update contract with report file path and final status
    await supabase
      .from('contracts')
      .update({
        status: 'completed',
        processing_progress: 100,
        analysis_result_id: analysisResultData.id,
        report_file_path: reportData.filePath,
      })
      .eq('id', contractId);

    // Send notification to user
    await supabase.from('notifications').insert({
      user_id: userId,
      title: getTranslatedMessage('notification_title_analysis_complete', userPreferredLanguage),
      message: getTranslatedMessage('notification_message_analysis_complete', userPreferredLanguage, { contractName: translatedContractName }),
      type: 'success',
    });

    await logActivity(
      supabase,
      userId,
      'CONTRACT_ANALYSIS_COMPLETED',
      `User ${userEmail} completed analysis for contract ${originalContractName} (ID: ${contractId}).`,
      { contract_id: contractId, contract_name: originalContractName, compliance_score: complianceScore, advanced_analysis: performAdvancedAnalysis }
    );

    return corsResponse({ message: 'Analysis completed successfully', translated_contract_name: translatedContractName });

  } catch (error: any) {
    console.error(`contract-analyzer: Error during analysis for contract ID ${contractId}: ${error.message}`, error);
    await supabase.from('contracts').update({ status: 'failed' }).eq('id', contractId);

    // Send error notification to user
    await supabase.from('notifications').insert({
      user_id: userId,
      title: getTranslatedMessage('notification_title_analysis_failed', userPreferredLanguage),
      message: getTranslatedMessage('notification_message_analysis_failed', userPreferredLanguage, { contractName: originalContractName, errorMessage: error.message }),
      type: 'error',
    });

    await logActivity(
      supabase,
      userId,
      'CONTRACT_ANALYSIS_FAILED',
      `User ${userEmail} failed analysis for contract ${originalContractName} (ID: ${contractId}). Error: ${error.message}`,
      { contract_id: contractId, contract_name: originalContractName, error_message: error.message }
    );

    return corsResponse({ error: error.message }, 500);
  }
});
