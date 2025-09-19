import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import OpenAI from 'npm:openai@4.53.0';
import { logActivity } from '../_shared/logActivity.ts';

// Initialize Supabase client
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

// ADDED: Simple translation object for notification messages
const translations = {
  en: {
    analysis_complete_message: (contractName: string) => `Your contract "${contractName}" has been successfully analyzed.`,
    high_risk_findings_message: (contractName: string, count: number) => `Your contract "${contractName}" has ${count} high-risk findings. Review immediately.`,
    analysis_failed_message: (contractName: string) => `Contract analysis for "${contractName}" failed. Please try again or contact support.`
  },
  es: {
    analysis_complete_message: (contractName: string) => `Su contrato "${contractName}" ha sido analizado con éxito.`,
    high_risk_findings_message: (contractName: string, count: number) => `Su contrato "${contractName}" tiene ${count} hallazgos de alto riesgo. Revise inmediatamente.`,
    analysis_failed_message: (contractName: string) => `El análisis del contrato "${contractName}" falló. Por favor, inténtelo de nuevo o póngase en contacto con soporte.`
  },
  fr: {
    analysis_complete_message: (contractName: string) => `Votre contrat "${contractName}" a été analysé avec succès.`,
    high_risk_findings_message: (contractName: string, count: number) => `Votre contrat "${contractName}" contient ${count} constatations à haut risque. Veuillez les examiner immédiatement.`,
    analysis_failed_message: (contractName: string) => `L'analyse du contrat "${contractName}" a échoué. Veuillez réessayer ou contacter le support.`
  },
  ar: {
    analysis_complete_message: (contractName: string) => `تم تحليل عقدك "${contractName}" بنجاح.`,
    high_risk_findings_message: (contractName: string, count: number) => `عقدك "${contractName}" يحتوي على ${count} نتائج عالية الخطورة. يرجى المراجعة فوراً.`,
    analysis_failed_message: (contractName: string) => `فشل تحليل العقد "${contractName}". يرجى المحاولة مرة أخرى أو الاتصال بالدعم.`
  }
};

// ADDED: Helper function to get translated string
function getTranslatedMessage(key: string, lang: string, ...args: any[]): string {
  const langMap = (translations as any)[lang] || translations.en; // Fallback to English
  const messageTemplate = langMap[key];
  if (typeof messageTemplate === 'function') {
    return messageTemplate(...args);
  }
  return (translations.en as any)[key](...args); // Fallback to English template if key not found or not a function
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
  let userId: string;
  let userEmail: string;
  let userName: string | null = null;
  let userSubscriptionId: string | null = null;
  let userNotificationSettings: Record<string, { email: boolean; inApp: boolean }> = {};
  let token: string;
  let userPreferredLanguage: string = 'en'; // ADDED: Default user language

  try {
    const { contract_id, contract_text, source_language, output_language } = await req.json();
    contractId = contract_id;
    contractText = contract_text;
    sourceLanguage = source_language || 'auto';
    outputLanguage = output_language || 'en';

    if (!contractId || !contractText) {
      return corsResponse({ error: 'Missing contract_id or contract_text' }, 400);
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
        .select('full_name, notification_settings, theme_preference') // MODIFIED: Fetch theme_preference
        .eq('id', userId)
        .maybeSingle();
    }, 5, 500);

    if (profileError) {
      console.warn(`Could not fetch profile for user ${userId}:`, profileError.message);
      userNotificationSettings = {
        'analysis-complete': { email: true, inApp: true },
        'high-risk-findings': { email: true, inApp: true },
        'weekly-reports': { email: false, inApp: false },
        'system-updates': { email: false, inApp: true },
      };
    } else {
      if (profileData?.full_name) {
        userName = profileData.full_name;
      }
      userNotificationSettings = (profileData?.notification_settings as Record<string, { email: boolean; inApp: boolean }>) || {
        'analysis-complete': { email: true, inApp: true },
        'high-risk-findings': { email: true, inApp: true },
        'weekly-reports': { email: false, inApp: false },
        'system-updates': { email: false, inApp: true },
      };
      // ADDED: Set userPreferredLanguage from theme_preference or default to 'en'
      // For notifications, we'll use the outputLanguage as the preferred language, as it's explicitly chosen by the user.
      userPreferredLanguage = outputLanguage;
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
    } else {
      // User has no active membership.
    }

  } catch (error) {
    console.error('Error parsing request body or authenticating user:', error);
    return corsResponse({ error: 'Invalid request or authentication failed' }, 400);
  }

  let consumedOrderId: number | null = null;

  // --- START: Authorization Logic ---
  if (userSubscriptionId) {
    // User is authorized via active subscription.
  } else {
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
      .eq('payment_status', 'paid')
      .eq('status', 'completed')
      .eq('is_consumed', false)
      .limit(1);

    if (ordersError) {
      console.error('Error fetching unconsumed orders:', ordersError);
      return corsResponse({ error: 'Failed to check available credits.' }, 500);
    }

    if (!unconsumedOrders || unconsumedOrders.length === 0) {
      return corsResponse({ error: 'No active subscription or available single-use credits. Please purchase a plan to analyze more contracts.' }, 403);
    } else {
      consumedOrderId = unconsumedOrders[0].id;
    }
  }
  // --- END: Authorization Logic ---

  try {
    await logActivity(
      supabase,
      userId,
      'CONTRACT_ANALYSIS_STARTED',
      `User ${userEmail} started analysis for contract ID: ${contractId}`,
      { contract_id: contractId }
    );

    await supabase
      .from('contracts')
      .update({ status: 'analyzing', processing_progress: 10 })
      .eq('id', contractId);

    // Fetch the contract details, including contract_content and jurisdictions
    const { data: contractDetails, error: fetchContractError } = await supabase
      .from('contracts')
      .select('contract_content, user_id, jurisdictions') // ADDED 'jurisdictions'
      .eq('id', contractId)
      .single();

    if (fetchContractError) {
      console.error('contract-analyzer: Error fetching contract details:', fetchContractError);
      throw new Error('Failed to fetch contract details for analysis.');
    }

    const userSelectedJurisdictions = contractDetails.jurisdictions.join(', '); // Format for prompt

    await supabase.from('contracts').update({ processing_progress: 30 }).eq('id', contractId);

    // MODIFIED: Moved systemPromptContent definition here
    const systemPromptContent = `You are a legal contract analysis AI with the expertise of a professional legal practitioner with 30 years of experience in contract law. Analyze the provided contract text. Your role is to conduct a deep, thorough analysis of the provided contract text and provide an executive summary, data protection impact, overall compliance score (0-100), and a list of specific findings. Each finding should include a title, description, risk level (high, medium, low, none), jurisdiction (UK, EU, Ireland, US, Canada, Australia, Sharia, Others), category (compliance, risk, data-protection, enforceability, drafting, commercial), recommendations (as an array of strings), and an optional clause reference. You must use the following checklist as your internal review framework to ensure completeness:

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
The contract text provided is in ${sourceLanguage === 'auto' ? 'an auto-detected language' : sourceLanguage}. If the source language is 'auto', please detect the language of the document.

OUTPUT LANGUAGE INSTRUCTIONS:
All text fields within the JSON output (executiveSummary, dataProtectionImpact, title, description, recommendations, keyFindings, applicableLaws, clauseReference) MUST be generated in ${outputLanguage}. If translation is necessary, perform it accurately.

JURISDICTION FOCUS:
The user has specified the following jurisdictions for this analysis: ${userSelectedJurisdictions}. Prioritize findings and applicable laws relevant to these jurisdictions. If a finding is relevant to multiple jurisdictions, select the most pertinent one from the user's specified list. If a finding is relevant to a jurisdiction not in the user's list, but is still critical, you may include it, but ensure the primary focus remains on the user's selected jurisdictions.
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
        'Authorization': `Bearer ${token}`,
      },
    });

    if (reportError) {
      console.error('Error invoking generate-analysis-report Edge Function:', reportError);
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
        // Successfully marked order as consumed.
      }
    }

    const { data: emailTriggerData, error: emailTriggerError } = await supabase.functions.invoke('trigger-report-email', {
      body: {
        userId: userId,
        contractId: contractId,
        reportSummary: executiveSummary,
        reportLink: reportLink,
        reportHtmlContent: reportHtmlContent,
      },
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (emailTriggerError) {
      console.error('Error invoking trigger-report-email Edge Function:', emailTriggerError);
    } else {
      // trigger-report-email Edge Function invoked successfully.
    }

    // --- START: Notification Generation ---
    const contractData = await supabase.from('contracts').select('name').eq('id', contractId).single();
    const contractName = contractData.data?.name || 'Unknown Contract';

    if (userNotificationSettings['analysis-complete']?.inApp) {
      const notificationMessage = getTranslatedMessage('analysis_complete_message', userPreferredLanguage, contractName);
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: userId,
        title: 'notification_title_analysis_complete',
        message: notificationMessage,
        type: 'success',
      });
      if (notificationError) {
        console.error('Error inserting "Analysis Complete" notification:', notificationError);
      }
    }

    const highRiskFindings = findings.filter((f: any) => f.risk_level === 'high' || f.riskLevel === 'high');
    if (highRiskFindings.length > 0 && userNotificationSettings['high-risk-findings']?.inApp) {
      const notificationMessage = getTranslatedMessage('high_risk_findings_message', userPreferredLanguage, contractName, highRiskFindings.length);
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: userId,
        title: 'notification_title_high_risk_findings',
        message: notificationMessage,
        type: 'error',
      });
      if (notificationError) {
        console.error('Error inserting "High Risk Findings" notification:', notificationError);
      }
    }
    // --- END: Notification Generation ---

    await logActivity(
      supabase,
      userId,
      'CONTRACT_ANALYSIS_COMPLETED',
      `User ${userEmail} completed analysis for contract ID: ${contractId} with compliance score: ${complianceScore}%`,
      { contract_id: contractId, compliance_score: complianceScore }
    );

    return corsResponse({ message: 'Analysis completed successfully' });

  } catch (error: any) {
    console.error(`Error during analysis for contract ID ${contractId}:`, error.message);
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

    const contractData = await supabase.from('contracts').select('name').eq('id', contractId).single();
    const contractName = contractData.data?.name || 'Unknown Contract';

    if (userNotificationSettings['analysis-complete']?.inApp) {
      const notificationMessage = getTranslatedMessage('analysis_failed_message', userPreferredLanguage, contractName);
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: userId,
        title: 'notification_title_analysis_failed',
        message: notificationMessage,
        type: 'error',
      });
      if (notificationError) console.error('Error inserting "Analysis Failed" notification:', notificationError);
    }

    return corsResponse({ error: error.message }, 500);
  }
});