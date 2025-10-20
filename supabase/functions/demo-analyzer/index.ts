import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import OpenAI from 'npm:openai@4.53.0';
import { getTranslatedMessage } from '../_shared/edge_translations.ts';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')!,
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

  let contractText: string;
  let outputLanguage: string;

  try {
    const { contractText: bodyContractText, outputLanguage: bodyOutputLanguage } = await req.json();

    contractText = bodyContractText;
    outputLanguage = bodyOutputLanguage || 'en';

    if (!contractText) {
      return corsResponse({ error: 'Missing contractText' }, 400);
    }

  } catch (error) {
    console.error('demo-analyzer: Error parsing request body:', error);
    return corsResponse({ error: 'Invalid request body' }, 400);
  }

  try {
    const systemPromptContent = `You are a legal contract analysis AI. Your task is to provide a brief, high-level preview analysis of the provided contract text. This is for a demo, so keep it concise and focus on the most critical aspects. Do NOT perform OCR. Do NOT save any data.

Your output should include:
1.  A very brief executive summary (1-2 sentences).
2.  An overall risk level (high, medium, low, none).
3.  One key finding (title and description, 1-2 sentences each) that represents the most significant risk or insight.
4.  A compliance score (0-100).

COMPLIANCE SCORE RULES (MANDATORY):
- Start from 100 points.
- Deduct points based on perceived risk:
  • High risk = -15 points
  • Medium risk = -8 points
  • Low risk = -3 points
- Minimum score is 0.
- Round to the nearest whole number.
- Ensure the score reflects overall risk exposure and enforceability of the contract.

OUTPUT REQUIREMENTS:
Return your findings strictly as a valid JSON object with the following structure:

{
  "executiveSummary": "...",
  "overallRiskLevel": "high",
  "keyFindingTitle": "...",
  "keyFindingDescription": "...",
  "complianceScore": 0,
  "effectiveDate": "YYYY-MM-DD",
  "terminationDate": "YYYY-MM-DD",
  "contractType": "...",
  "parties": ["...", "..."],
  "liabilityCapSummary": "...",
}

NOTES:
- Ensure the JSON is valid and strictly adheres to the specified structure.
- Do not include any text outside the JSON object.
- All text fields within the JSON output MUST be generated in ${outputLanguage}. If translation is necessary, perform it accurately.
- Risk levels must be one of: high, medium, low, none.
- Dates should be in YYYY-MM-DD format. If only month/year or year is available, use 'YYYY-MM-01' or 'YYYY-01-01'. If no date is found, use "${getTranslatedMessage('not_specified', outputLanguage)}".
- For 'liabilityCapSummary', provide a concise summary (1-2 sentences).
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
      temperature: 0.2, // Keep it low for consistent demo results
    });

    const aiResponseContent = completion.choices[0].message?.content;
    if (!aiResponseContent) {
      throw new Error(getTranslatedMessage('error_no_content_from_openai', outputLanguage));
    }

    let demoAnalysis: any;
    try {
      demoAnalysis = JSON.parse(aiResponseContent);
    } catch (parseError) {
      console.error('demo-analyzer: Error parsing OpenAI response JSON:', parseError);
      throw new Error(getTranslatedMessage('error_failed_to_parse_ai_response', outputLanguage));
    }

    // Translate fields if necessary
    demoAnalysis.executiveSummary = await translateText(demoAnalysis.executiveSummary, outputLanguage);
    if (demoAnalysis.keyFindingTitle) {
      demoAnalysis.keyFindingTitle = await translateText(demoAnalysis.keyFindingTitle, outputLanguage);
    }
    if (demoAnalysis.keyFindingDescription) {
      demoAnalysis.keyFindingDescription = await translateText(demoAnalysis.keyFindingDescription, outputLanguage);
    }
    // ADDED: Translate new advanced fields if present
    if (demoAnalysis.contractType) demoAnalysis.contractType = await translateText(demoAnalysis.contractType, outputLanguage);
    if (Array.isArray(demoAnalysis.parties)) {
      demoAnalysis.parties = await Promise.all(demoAnalysis.parties.map((p: string) => translateText(p, outputLanguage)));
    }
    if (demoAnalysis.liabilityCapSummary) demoAnalysis.liabilityCapSummary = await translateText(demoAnalysis.liabilityCapSummary, outputLanguage);


    // Ensure risk level is valid
    const validRiskLevels: string[] = ['high', 'medium', 'low', 'none']; // Changed to string[] for comparison
    if (!validRiskLevels.includes(demoAnalysis.overallRiskLevel)) {
      demoAnalysis.overallRiskLevel = 'none'; // Default to none if invalid
    }

    // Ensure compliance score is a number
    if (typeof demoAnalysis.complianceScore !== 'number') {
      demoAnalysis.complianceScore = 0;
    }

    return corsResponse(demoAnalysis);

  } catch (error: any) {
    console.error(`demo-analyzer: Error during demo analysis:`, error.message);
    return corsResponse({ error: error.message }, 500);
  }
});