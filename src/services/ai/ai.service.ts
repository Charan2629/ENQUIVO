import {
  PrismaClient,
  ChatMessageRole,
  ConversationLanguage,
  EscalationReason,
  FactSheetScope,
  FactSheetStatus,
  HandoffStatus,
  UserRole,
  Prisma,
} from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { isInternalAuditMessage } from "@/lib/chat-message";
import { BookingService } from "@/services/booking/booking.service";
import {
  ChatInput,
  chatInputSchema,
  getVerifiedFactsToolSchema,
  checkSlotAvailabilityToolSchema,
  bookVisitSlotToolSchema,
  handoffToExecutiveToolSchema,
} from "@/lib/validations/ai";

// ============================================================================
// Errors
// ============================================================================
export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

export class AIConversationNotFoundError extends AIError {
  constructor(message = "Conversation not found") {
    super(message);
    this.name = "AIConversationNotFoundError";
  }
}

export class AISecurityError extends AIError {
  constructor(message = "Security validation failed: conversation does not belong to specified lead") {
    super(message);
    this.name = "AISecurityError";
  }
}

export class AITransientError extends AIError {
  readonly status = 503;
  readonly retryable = true;
  constructor(
    message = "The AI Concierge is currently experiencing temporary high demand. Please try again in a few moments, or connect with our sales executive."
  ) {
    super(message);
    this.name = "AITransientError";
  }
}

export class AIRateLimitError extends AIError {
  readonly status = 429;
  readonly retryable = true;
  constructor(
    message = "The AI service is temporarily busy due to rate limits. Please wait a moment before trying again."
  ) {
    super(message);
    this.name = "AIRateLimitError";
  }
}

export class AIAuthError extends AIError {
  readonly status = 500;
  readonly retryable = false;
  constructor(
    message = "AI Concierge authentication configuration error. Please contact our sales team directly."
  ) {
    super(message);
    this.name = "AIAuthError";
  }
}

export class AIModelNotFoundError extends AIError {
  readonly status = 500;
  readonly retryable = false;
  constructor(
    message = "The requested AI model is unavailable or undergoing maintenance. Please contact our sales team directly."
  ) {
    super(message);
    this.name = "AIModelNotFoundError";
  }
}

/**
 * Classifies raw provider or network errors into strictly typed, sanitized AIError subclasses.
 * Never exposes raw provider JSON, API keys, or stack traces in buyer-facing error messages.
 */
export function classifyGeminiError(error: unknown): AIError {
  if (error instanceof AIError) {
    return error;
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  const status =
    typeof (error as { status?: unknown })?.status === "number"
      ? (error as { status: number }).status
      : undefined;

  const lower = rawMessage.toLowerCase();

  // 1. Transient 503 / 504 / Overloaded / Network disconnects
  if (
    status === 503 ||
    status === 504 ||
    lower.includes("503") ||
    lower.includes("unavailable") ||
    lower.includes("overload") ||
    lower.includes("high demand") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("fetch failed") ||
    lower.includes("socket hang up")
  ) {
    return new AITransientError();
  }

  // 2. Rate Limits 429
  if (
    status === 429 ||
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  ) {
    return new AIRateLimitError();
  }

  // 3. Authentication & API Key errors
  if (
    status === 401 ||
    status === 403 ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("api_key") ||
    lower.includes("unauthenticated") ||
    lower.includes("permission_denied") ||
    lower.includes("api key not valid")
  ) {
    return new AIAuthError();
  }

  // 4. Model not found or discontinued
  if (
    status === 404 ||
    lower.includes("404") ||
    lower.includes("not_found") ||
    lower.includes("is not found") ||
    lower.includes("no longer available")
  ) {
    return new AIModelNotFoundError();
  }

  return new AIError(
    "We encountered an unexpected error communicating with the AI Concierge. Please try again or connect with our sales team."
  );
}

// ============================================================================
// Gemini Client Interface & Types
// ============================================================================
export interface GeminiToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiContentPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: {
    id?: string;
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    id?: string;
    name: string;
    response: Record<string, unknown>;
  };
}

export interface GeminiConversationContent {
  role: "user" | "model";
  parts: GeminiContentPart[];
}

export interface GeminiTurnResult {
  text?: string;
  toolCalls?: GeminiToolCall[];
  rawParts?: GeminiContentPart[];
}

export interface GeminiClientInterface {
  generate(params: {
    systemInstruction: string;
    history: Array<{ role: "user" | "model"; text: string }>;
    userMessage: string;
    tools: unknown[];
  }): Promise<GeminiTurnResult>;

  continueTurn?(params: {
    systemInstruction: string;
    contents: GeminiConversationContent[];
    tools: unknown[];
  }): Promise<GeminiTurnResult>;
}

export const aiToolDeclarations = [
  {
    name: "getVerifiedFacts",
    description: "Retrieve active, verified real estate facts for the portfolio or a specific project in Ahmedabad.",
    parameters: {
      type: "OBJECT",
      properties: {
        scope: { type: "STRING", enum: ["PORTFOLIO", "PROJECT_1", "PROJECT_2"] },
        projectId: { type: "STRING" },
      },
    },
  },
  {
    name: "checkSlotAvailability",
    description: "Check upcoming available site visit appointment slots.",
    parameters: {
      type: "OBJECT",
      properties: {
        startDate: { type: "STRING" },
        endDate: { type: "STRING" },
      },
    },
  },
  {
    name: "bookVisitSlot",
    description: "Book an available site visit slot after explicit buyer confirmation.",
    parameters: {
      type: "OBJECT",
      properties: {
        slotId: { type: "STRING" },
        confirmed: { type: "BOOLEAN" },
      },
      required: ["slotId", "confirmed"],
    },
  },
  {
    name: "handoffToExecutive",
    description: "Escalate the conversation to a human sales executive when information is missing, unlisted amenities are requested, price negotiations occur, or buyer asks for a human.",
    parameters: {
      type: "OBJECT",
      properties: {
        escalationReason: {
          type: "STRING",
          enum: [
            "MISSING_PROJECT_INFO",
            "UNLISTED_AMENITY",
            "PRICE_NEGOTIATION",
            "BUYER_REQUESTED",
            "OTHER",
          ],
        },
        summary: { type: "STRING" },
      },
      required: ["escalationReason", "summary"],
    },
  },
];

/**
 * Resolves the configured Gemini model name from environment or defaults to stable "gemini-3.8-flash".
 * Server-side only; never exposed to browser bundles.
 */
export function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
}

/**
 * Default live Gemini client implementation using @google/genai SDK.
 * Configures bounded HTTP-level exponential backoff with jitter natively via SDK httpOptions.retryOptions.
 * Prevents nested retry loops by relying on the client's HTTP retry policy.
 */
export const createDefaultGeminiClient = (): GeminiClientInterface => {
  const getAiInstance = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your-google-gemini-api-key") {
      throw new AIAuthError(
        "GEMINI_API_KEY is not configured in .env.local. Configure a valid Google Gemini API key to run live AI generations."
      );
    }

    const { GoogleGenAI } = await import("@google/genai");
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 30000,
        retryOptions: {
          attempts: 3, // Initial request + up to 2 bounded retries
          initialDelay: 1.0, // 1s initial delay
          maxDelay: 4.0, // 4s maximum delay cap
          expBase: 2.0, // Exponential backoff multiplier
          jitter: 0.5, // 50% randomized jitter
          httpStatusCodes: [429, 503, 504], // Retry on transient rate limits & service overload
        },
      },
    });
  };

  const executeGenerate = async (
    systemInstruction: string,
    contents: GeminiConversationContent[],
    tools: unknown[]
  ): Promise<GeminiTurnResult> => {
    const ai = await getAiInstance();
    const model = getGeminiModelName();

    try {
      const response = await ai.models.generateContent({
        model,
        contents: contents as unknown as Parameters<typeof ai.models.generateContent>[0]["contents"],
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: tools as unknown as Record<string, unknown>[] }],
        },
      });

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts as GeminiContentPart[] | undefined;
      const text =
        parts?.find((p) => p.text && p.text.trim().length > 0 && !p.thought)?.text ??
        parts?.find((p) => p.text && p.text.trim().length > 0)?.text;
      const functionCalls = parts
        ?.filter(
          (
            p
          ): p is GeminiContentPart & {
            functionCall: { id?: string; name: string; args: Record<string, unknown> };
          } => Boolean(p.functionCall)
        )
        ?.map((p) => ({
          id: p.functionCall.id,
          name: p.functionCall.name,
          args: p.functionCall.args || {},
        }));

      return {
        text,
        toolCalls: functionCalls && functionCalls.length > 0 ? functionCalls : undefined,
        rawParts: parts,
      };
    } catch (rawError) {
      throw classifyGeminiError(rawError);
    }
  };

  return {
    async generate({ systemInstruction, history, userMessage, tools }) {
      const contents: GeminiConversationContent[] = [
        ...history.map((h) => ({
          role: h.role,
          parts: [{ text: h.text }],
        })),
        {
          role: "user",
          parts: [{ text: userMessage }],
        },
      ];
      return executeGenerate(systemInstruction, contents, tools);
    },

    async continueTurn({ systemInstruction, contents, tools }) {
      return executeGenerate(systemInstruction, contents, tools);
    },
  };
};

/**
 * Builds localized system instructions enforcing language, grounding, RERA disclaimer, and handoff triggers.
 */
export function buildSystemInstruction(
  language: ConversationLanguage,
  projectContext?: string | null
): string {
  const reraDisclaimer = "RERA Reg: DEMO-ONLY-NOT-VERIFIED (All project details are for demonstration purposes only).";

  let languageInstruction = "Communicate in clear, professional English.";
  if (language === ConversationLanguage.HI) {
    languageInstruction = "You must communicate exclusively in natural Hindi using standard Devanagari script (हिन्दी).";
  } else if (language === ConversationLanguage.GU) {
    languageInstruction = "You must communicate exclusively in natural Gujarati using standard Gujarati script (ગુજરાતી).";
  }

  return `You are the AI Concierge for ENQUIVO, an AI lead-response and site-visit assistant for premium residential developments in Ahmedabad, Gujarat, India.

Language Requirement:
${languageInstruction}

Strict Grounding & Governance Rules:
1. All property facts (pricing, configurations, unit counts, amenities, locations) MUST be strictly grounded in active, verified facts retrieved from getVerifiedFacts.
2. NEVER invent, extrapolate, or speculate about unlisted amenities (e.g. swimming pool, private plunge pool, pet park, helipad) or discounts/price negotiations.
3. If a buyer asks for information not present in the verified facts, or requests price negotiations, discounts, or asks for a human, you MUST immediately call handoffToExecutive.
4. When booking a visit, you MUST verify that the buyer has explicitly confirmed the slot before invoking bookVisitSlot.
5. Property Facts Compliance: Always include the compliance notice: "${reraDisclaimer}" when presenting property specifications, pricing, configurations, or amenities. Do NOT append the compliance notice to pure conversational clarifications, greetings, or disambiguation questions.
6. Multi-Option Follow-Ups:
   - When you have offered multiple choices (e.g. checking visit slots vs connecting with a sales executive) and the buyer replies with an ambiguous affirmative (such as "yes", "yes I would", "sure", "please do", "हाँ", "હા") without specifying which option they want:
     First time: Ask for clarification:
     "Certainly! Would you prefer to schedule a site visit or speak directly with a sales executive?"
     Second consecutive time: Provide numbered choices:
     "Please choose one option so I can help you:
1. Schedule a site visit
2. Speak with a sales executive"
   - Never invoke bookVisitSlot or handoffToExecutive on an ambiguous affirmative.
   - Do NOT append the RERA compliance notice to pure conversational clarifications or disambiguation questions.
7. Choice Selection: If the buyer selects "1" or "Schedule a site visit", invoke checkSlotAvailability. If the buyer selects "2" or "Speak with a sales executive", invoke handoffToExecutive with reason BUYER_REQUESTED.
${projectContext ? `\nTarget Project Context: ${projectContext}` : ""}`;
}

/**
 * Service orchestrating AI Concierge interactions for ENQUIVO.
 */
export class AIConciergeService {
  constructor(
    private db: PrismaClient = defaultPrisma,
    private bookingService: BookingService = new BookingService(db),
    private geminiClient: GeminiClientInterface = createDefaultGeminiClient(),
    private allowDirectToolBooking: boolean = false
  ) { }

  /**
   * Retrieves strictly VERIFIED and active facts from PostgreSQL.
   * Guarantees that DRAFT/UNVERIFIED facts and facts from unrelated projects are never returned.
   */
  async getVerifiedFacts(params: {
    scope?: FactSheetScope;
    projectId?: string | null;
  }) {
    const where: Prisma.FactSheetWhereInput = {
      status: FactSheetStatus.VERIFIED,
      isActive: true,
    };

    if (params.projectId) {
      // Return portfolio facts and facts specific to THIS project only
      where.OR = [
        { scope: FactSheetScope.PORTFOLIO },
        { projectId: params.projectId, scope: { not: FactSheetScope.PORTFOLIO } },
      ];
    } else if (params.scope) {
      where.scope = params.scope;
    } else {
      // Default to portfolio-wide verified facts
      where.scope = FactSheetScope.PORTFOLIO;
    }

    return this.db.factSheet.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        key: true,
        value: true,
        scope: true,
        projectId: true,
      },
    });
  }

  /**
   * Deduplicates verified facts for clean presentation:
   * 1. Filters out RERA compliance records from the bullet points list, because the
   *    statutory compliance disclaimer is explicitly appended once as the compliance footer.
   * 2. If portfolio_overview is present (which already summarizes 420 apartments, configurations,
   *    and price range), omits redundant standalone total_apartments facts so apartment counts don't repeat.
   * 3. Deduplicates identical normalized bullet points.
   */
  deduplicateVerifiedFacts<T extends { key: string; value: string }>(facts: T[]): T[] {
    const nonReraFacts = facts.filter(
      (f) => f.key !== "rera_compliance" && !f.value.toLowerCase().includes("rera reg:")
    );

    const hasPortfolioOverview = nonReraFacts.some(
      (f) =>
        f.key === "portfolio_overview" ||
        (f.value.toLowerCase().includes("420") && f.value.toLowerCase().includes("bhk"))
    );

    const seenValues = new Set<string>();
    return nonReraFacts.filter((f) => {
      if (hasPortfolioOverview && f.key === "total_apartments") {
        return false;
      }
      const normalized = f.value.trim().toLowerCase();
      if (seenValues.has(normalized)) {
        return false;
      }
      seenValues.add(normalized);
      return true;
    });
  }

  /**
   * Detects whether text represents an ambiguous affirmative response (e.g. "yes", "yes I would", "sure", "ok").
   */
  isAmbiguousAffirmative(text: string): boolean {
    const normalized = text
      .trim()
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?!]/g, "")
      .replace(/\s+/g, " ");

    const patterns = [
      /^(yes|sure|yeah|ok|okay)(\s+i\s+(would|do|will|want))?$/,
      /^(yes|sure)\s+please$/,
      /^sure$/,
      /^i\s+would(\s+like\s+that)?$/,
      /^i\s+want\s+to$/,
      /^yeah$/,
      /^yep$/,
      /^definitely$/,
      /^certainly$/,
      /^ok(ay)?$/,
      /^please$/,
      /^go\s+ahead$/,
      /^(हाँ|हा|हाँ\s*जी|जी\s*हाँ|ज़रूर|जरूर|बिलकुल|अवश्य)$/,
      /^(હા|હા\s*જરૂર|ચોક્કસ|હા\s*પ્લીઝ)$/,
    ];

    return patterns.some((p) => p.test(normalized));
  }

  /**
   * Detects whether an assistant message presented multiple alternative choices
   * (specifically offering both a site visit / slots and a sales executive / team).
   */
  offersSiteVisitOrSalesExecutive(text: string): boolean {
    const lower = text.toLowerCase();
    const mentionsVisit =
      lower.includes("site visit") ||
      lower.includes("visit slot") ||
      lower.includes("available slot") ||
      text.includes("साइट विज़िट") ||
      text.includes("વિઝિટ") ||
      text.includes("મુલાકાત");

    const mentionsSales =
      lower.includes("sales executive") ||
      lower.includes("sales team") ||
      lower.includes("speak directly") ||
      text.includes("बिक्री") ||
      text.includes("સેલ્સ");

    const mentionsAlternative =
      lower.includes(" or ") ||
      lower.includes("prefer") ||
      lower.includes("whether") ||
      text.includes("या") ||
      text.includes("કે");

    return mentionsVisit && mentionsSales && mentionsAlternative;
  }

  /**
   * Detects whether an assistant message was the first disambiguation prompt offering choices.
   */
  isFirstDisambiguationPrompt(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      (lower.includes("certainly!") && lower.includes("schedule a site visit or speak directly")) ||
      (text.includes("ज़रूर!") && text.includes("साइट विज़िट निर्धारित करना पसंद करेंगे")) ||
      (text.includes("ચોક્કસ!") && text.includes("સાઇટ મુલાકાત શેડ્યૂલ કરવાનું પસંદ કરશો"))
    );
  }

  /**
   * Detects whether an assistant message was the second consecutive numbered disambiguation prompt.
   */
  isNumberedDisambiguationPrompt(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes("please choose one option") ||
      text.includes("कृपया एक विकल्प चुनें") ||
      text.includes("કૃપા કરીને એક વિકલ્પ પસંદ કરો")
    );
  }

  /**
   * Detects whether the buyer selected Option 1 (Schedule a site visit) from the numbered disambiguation prompt.
   */
  isOption1Selection(text: string): boolean {
    const trimmed = text.trim().toLowerCase().replace(/[.,!?:;]/g, "");
    const patterns = [
      /^1$/,
      /^option\s*1$/,
      /^1st(\s+option)?$/,
      /^first(\s+option)?$/,
      /^(૧|१)$/,
      /^(विकल्प|વિકલ્પ)\s*(1|१)$/,
      /^(पहला|પહેલો)(\s*(विकल्प|વિકલ્પ))?$/,
      /^schedule(\s+a)?\s+site\s+visit$/,
      /^site\s+visit$/,
      /^schedule\s+visit$/,
    ];
    return patterns.some((p) => p.test(trimmed));
  }

  /**
   * Detects whether the buyer selected Option 2 (Speak with a sales executive) from the numbered disambiguation prompt.
   */
  isOption2Selection(text: string): boolean {
    const trimmed = text.trim().toLowerCase().replace(/[.,!?:;]/g, "");
    const patterns = [
      /^2$/,
      /^option\s*2$/,
      /^2nd(\s+option)?$/,
      /^second(\s+option)?$/,
      /^(૨|२)$/,
      /^(विकल्प|વિકલ્પ)\s*(2|२)$/,
      /^(दूसरा|બીજો)(\s*(विकल्प|વિકલ્પ))?$/,
      /^speak(\s+directly)?\s+(with|to)(\s+a)?\s+sales\s+executive$/,
      /^sales\s+executive$/,
      /^speak\s+(with|to)\s+sales$/,
      /^sales$/,
    ];
    return patterns.some((p) => p.test(trimmed));
  }

  /**
   * Strips the statutory RERA demo compliance disclaimer from conversational clarification
   * and disambiguation messages, preserving it exclusively for verified property facts.
   */
  stripReraNotice(text: string): string {
    return text
      .replace(/\n*\s*RERA Reg: DEMO-ONLY-NOT-VERIFIED[^\n]*/g, "")
      .trim();
  }

  /**
   * Collapses duplicate occurrences of the RERA demo notice in generated text.
   */
  sanitizeReraNotice(text: string): string {
    const marker = "RERA Reg: DEMO-ONLY-NOT-VERIFIED";
    const firstIdx = text.indexOf(marker);
    if (firstIdx === -1) return text;
    const secondIdx = text.indexOf(marker, firstIdx + marker.length);
    if (secondIdx === -1) return text;

    const parts = text.split(marker);
    return parts[0] + marker + parts.slice(1).join("").replace(new RegExp(marker, "g"), "");
  }

  /**
   * Builds an informative, grounded handoff message explaining WHY the AI cannot answer
   * (e.g. unlisted project pricing, missing specifications, custom amenities, or price negotiations),
   * mentions the assigned sales executive by name, and provides authentic trilingual localization.
   * Never promises specific callback timeframes and never invents unverified pricing.
   */
  buildHandoffExplanationMessage(params: {
    language: ConversationLanguage;
    execName: string;
    escalationReason: EscalationReason;
    summary: string;
    userMessage: string;
    projectName?: string | null;
  }): string {
    const { language, execName, escalationReason, summary, userMessage, projectName } = params;

    let targetProject: string | null = projectName ?? null;
    const combinedText = `${userMessage} ${summary}`.toLowerCase();
    if (!targetProject) {
      if (
        combinedText.includes("prakriti") ||
        combinedText.includes("प्रकृति") ||
        combinedText.includes("પ્રકૃતિ")
      ) {
        targetProject = "Prakriti Heights";
      } else if (
        combinedText.includes("vaastu") ||
        combinedText.includes("वास्तु") ||
        combinedText.includes("વાસ્તુ")
      ) {
        targetProject = "Vaastu Enclave";
      }
    }

    const getLocalizedProject = (pName: string, lang: ConversationLanguage): string => {
      if (
        pName.toLowerCase().includes("prakriti") ||
        pName.includes("प्रकृति") ||
        pName.includes("પ્રકૃતિ")
      ) {
        if (lang === ConversationLanguage.HI) return "प्रकृति हाइट्स";
        if (lang === ConversationLanguage.GU) return "પ્રકૃતિ હાઇટ્સ";
        return "Prakriti Heights";
      }
      if (
        pName.toLowerCase().includes("vaastu") ||
        pName.includes("वास्तु") ||
        pName.includes("વાસ્તુ")
      ) {
        if (lang === ConversationLanguage.HI) return "वास्तु एन्क्लेव";
        if (lang === ConversationLanguage.GU) return "વાસ્તુ એન્ક્લેવ";
        return "Vaastu Enclave";
      }
      return pName;
    };

    if (escalationReason === EscalationReason.MISSING_PROJECT_INFO) {
      if (targetProject) {
        const enProj = getLocalizedProject(targetProject, ConversationLanguage.EN);
        const hiProj = getLocalizedProject(targetProject, ConversationLanguage.HI);
        const guProj = getLocalizedProject(targetProject, ConversationLanguage.GU);

        return this.localizeText(
          language,
          `Exact 2 BHK and 3 BHK prices for ${enProj} are not available in our verified developer facts. I've connected you with ${execName}, who can confirm the current pricing. They have received your conversation summary and will reach out to assist you.`,
          `${hiProj} के लिए 2 BHK और 3 BHK की सटीक कीमतें हमारे सत्यापित डेवलपर विवरण में उपलब्ध नहीं हैं। मैंने आपको ${execName} से जोड़ दिया है, जो वर्तमान कीमतों की पुष्टि कर सकते हैं। उन्हें आपकी बातचीत का विवरण मिल गया है और वे आपकी सहायता करेंगे।`,
          `${guProj} માટે 2 BHK અને 3 BHK ના ચોક્કસ ભાવો અમારી ચકાસાયેલ ડેવલપર વિગતોમાં ઉપલબ્ધ નથી. મેં તમને ${execName} સાથે જોડ્યા છે, જે વર્તમાન ભાવોની પુષ્ટિ કરી શકે છે. તેમને તમારી વાતચીતની વિગતો મળી ગઈ છે અને તેઓ તમારી સહાય કરશે.`
        );
      }

      return this.localizeText(
        language,
        `Specific details for this project are not available in our verified developer facts. I've connected you with ${execName}, who can provide verified project specifications. They have received your conversation summary and will reach out to assist you.`,
        `इस प्रोजेक्ट के विशिष्ट विवरण हमारे सत्यापित डेवलपर विवरण में उपलब्ध नहीं हैं। मैंने आपको ${execName} से जोड़ दिया है, जो सत्यापित प्रोजेक्ट विनिर्देश प्रदान कर सकते हैं। उन्हें आपकी बातचीत का विवरण मिल गया है और वे आपकी सहायता करेंगे।`,
        `આ પ્રોજેક્ટની વિશિષ્ટ વિગતો અમારી ચકાસાયેલ ડેવલપર વિગતોમાં ઉપલબ્ધ નથી. મેં તમને ${execName} સાથે જોડ્યા છે, જે ચકાસાયેલ પ્રોજેક્ટ વિગતો આપી શકે છે. તેમને તમારી વાતચીતની વિગતો મળી ગઈ છે અને તેઓ તમારી સહાય કરશે.`
      );
    }

    if (escalationReason === EscalationReason.UNLISTED_AMENITY) {
      return this.localizeText(
        language,
        `Information regarding unlisted amenities or custom specifications is not available in our verified developer facts. I've connected you with ${execName}, who can confirm all available property amenities. They have received your conversation summary and will reach out to assist you.`,
        `असूचीबद्ध सुविधाओं या विशिष्ट सुविधाओं के बारे में जानकारी हमारे सत्यापित डेवलपर विवरण में उपलब्ध नहीं है। मैंने आपको ${execName} से जोड़ दिया है, जो सभी उपलब्ध सुविधाओं की पुष्टि कर सकते हैं। उन्हें आपकी बातचीत का विवरण मिल गया है और वे आपकी सहायता करेंगे।`,
        `બિનસૂચિબદ્ધ સુવિધાઓ અથવા કસ્ટમ વિગતો વિશેની માહિતી અમારી ચકાસાયેલ ડેવલપર વિગતોમાં ઉપલબ્ધ નથી. મેં તમને ${execName} સાથે જોડ્યા છે, જે ઉપલબ્ધ તમામ સુવિધાઓની પુષ્ટિ કરી શકે છે. તેમને તમારી વાતચીતની વિગતો મળી ગઈ છે અને તેઓ તમારી સહાય કરશે.`
      );
    }

    if (escalationReason === EscalationReason.PRICE_NEGOTIATION) {
      return this.localizeText(
        language,
        `Price negotiations, special discounts, and payment schedule customizations must be finalized directly with our sales team. I've connected you with ${execName}, who can discuss pricing structures and offers. They have received your conversation summary and will reach out to assist you.`,
        `मूल्य वार्ता, विशेष छूट और भुगतान योजनाओं को सीधे हमारी बिक्री टीम के साथ अंतिम रूप दिया जाना आवश्यक है। मैंने आपको ${execName} से जोड़ दिया है, जो मूल्य संरचनाओं और ऑफर्स पर चर्चा कर सकते हैं। उन्हें आपकी बातचीत का विवरण मिल गया है और वे आपकी सहायता करेंगे।`,
        `કિંમત અંગેની ચર્ચા, વિશેષ ડિસ્કાઉન્ટ અને પેમેન્ટ પ્લાનની વિગતો સીધી અમારી સેલ્સ ટીમ સાથે નક્કી કરવાની હોય છે. મેં તમને ${execName} સાથે જોડ્યા છે, જે કિંમતો અને ઑફર્સ અંગે ચર્ચા કરી શકે છે. તેમને તમારી વાતચીતની વિગતો મળી ગઈ છે અને તેઓ તમારી સહાય કરશે.`
      );
    }

    if (escalationReason === EscalationReason.BUYER_REQUESTED) {
      return this.localizeText(
        language,
        `I have connected you directly with ${execName} as requested. They have received your conversation summary and will reach out to assist you.`,
        `आपके अनुरोध के अनुसार मैंने आपको सीधे ${execName} से जोड़ दिया है। उन्हें आपकी बातचीत का विवरण मिल गया है और वे आपकी सहायता करेंगे।`,
        `તમારી વિનંતી અનુસાર મેં તમને સીધા ${execName} સાથે જોડ્યા છે. તેમને તમારી વાતચીતની વિગતો મળી ગઈ છે અને તેઓ તમારી સહાય કરશે.`
      );
    }

    return this.localizeText(
      language,
      `I have connected you with ${execName} regarding your request. They have received your conversation summary and will reach out to assist you.`,
      `मैंने आपके अनुरोध के संबंध में आपको ${execName} से जोड़ दिया है। उन्हें आपकी बातचीत का विवरण मिल गया है और वे आपकी सहायता करेंगे।`,
      `મેં તમારી વિનંતી અંગે તમને ${execName} સાથે જોડ્યા છે. તેમને તમારી વાતચીતની વિગતો મળી ગઈ છે અને તેઓ તમારી સહાય કરશે.`
    );
  }

  /**
   * Formats a deterministic, high-quality factual response grounded strictly in verified FactSheet records.
   * Invoked when Gemini requests getVerifiedFacts and subsequent generation is empty, rate-limited, or unavailable.
   * Guarantees 0% hallucinations, strict compliance notice inclusion, and authentic trilingual localization.
   */
  formatDeterministicFactResponse(
    facts: Array<{ key: string; value: string; scope: FactSheetScope; projectId?: string | null }>,
    language: ConversationLanguage
  ): string {
    const reraDisclaimer =
      "RERA Reg: DEMO-ONLY-NOT-VERIFIED (All project details are for demonstration purposes only).";

    if (facts.length === 0) {
      return this.localizeText(
        language,
        `Thank you for your inquiry. We currently do not have active verified specifications matching your exact request. Would you like me to connect you with our sales executive?\n\n${reraDisclaimer}`,
        `आपकी पूछताछ के लिए धन्यवाद। वर्तमान में हमारे पास आपके सटीक अनुरोध से मेल खाने वाले सक्रिय सत्यापित विवरण उपलब्ध नहीं हैं। क्या आप चाहेंगे कि मैं आपको हमारे बिक्री कार्यकारी से जोड़ूँ?\n\n${reraDisclaimer}`,
        `તમારી પૂછપરછ બદલ આભાર. હાલમાં અમારી પાસે તમારી ચોક્કસ વિનંતી મુજબની સક્રિય ચકાસાયેલ વિગતો ઉપલબ્ધ નથી. શું તમે ઈચ્છો છો કે હું તમને અમારા સેલ્સ એક્ઝિક્યુટિવ સાથે જોડું?\n\n${reraDisclaimer}`
      );
    }

    const cleanFacts = this.deduplicateVerifiedFacts(facts);
    const bulletPoints = cleanFacts.map((f) => `• ${f.value}`).join("\n");

    if (language === ConversationLanguage.HI) {
      return `अहमदाबाद में हमारे लक्जरी आवासीय प्रोजेक्ट्स के सत्यापित विवरण निम्नलिखित हैं:\n\n${bulletPoints}\n\n${reraDisclaimer}\n\nक्या आप साइट विज़िट के लिए उपलब्ध समय देखना चाहेंगे या बिक्री टीम से जुड़ना चाहेंगे?`;
    }

    if (language === ConversationLanguage.GU) {
      return `અમદાવાદમાં અમારા લક્ઝરી રેસિડેન્શિયલ પ્રોજેક્ટ્સની ચકાસાયેલ વિગતો નીચે મુજબ છે:\n\n${bulletPoints}\n\n${reraDisclaimer}\n\nશું તમે સાઇટ મુલાકાત માટે ઉપલબ્ધ સ્લોટ જોવા માંગો છો કે સેલ્સ ટીમ સાથે વાત કરવા માંગો છો?`;
    }

    return `Here are the verified details for our luxury residential developments in Ahmedabad:\n\n${bulletPoints}\n\n${reraDisclaimer}\n\nWould you like me to check upcoming available slots for your site visit, or connect you with our sales executive?`;
  }

  /**
   * Processes a turn in the conversation:
   * 1. Validates conversation and lead relationship.
   * 2. Persists the user message first (guaranteeing no data loss on AI error).
   * 3. Executes Gemini model turn with function calling.
   * 4. Executes tools server-side (grounding, booking, handoff).
   * 5. Persists the AI reply with groundingFactIds.
   * 6. Sets Lead.firstResponseAt atomically on first successful response.
   */
  async sendMessage(input: ChatInput) {
    const validated = chatInputSchema.parse(input);
    const now = new Date();

    // 1. Validate conversation and verify identity
    const conversation = await this.db.conversation.findUnique({
      where: { id: validated.conversationId },
      include: {
        lead: {
          include: {
            consentRecord: true,
            project: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new AIConversationNotFoundError(`Conversation ${validated.conversationId} not found`);
    }

    if (validated.leadId && conversation.leadId !== validated.leadId) {
      throw new AISecurityError(
        `Security violation: Conversation ${validated.conversationId} does not belong to lead ${validated.leadId}`
      );
    }

    // Update conversation language if requested and different from DB
    if (validated.language && conversation.language !== validated.language) {
      await this.db.conversation.update({
        where: { id: conversation.id },
        data: { language: validated.language },
      });
      conversation.language = validated.language;
    }

    const lead = conversation.lead;

    // 2. Persist user message or resolve idempotent retry
    let userMessage: Awaited<ReturnType<typeof this.db.chatMessage.create>>;

    if (validated.clientMessageId) {
      // 2a. Request-level idempotency via client-provided ID (backed by PostgreSQL PK unique constraint)
      const existing = await this.db.chatMessage.findUnique({
        where: { id: validated.clientMessageId },
      });

      if (existing) {
        userMessage = existing;
      } else {
        try {
          userMessage = await this.db.chatMessage.create({
            data: {
              id: validated.clientMessageId,
              conversationId: conversation.id,
              role: ChatMessageRole.USER,
              content: validated.message,
              createdAt: now,
            },
          });
        } catch (err: unknown) {
          // Catch concurrent duplicate insert (PostgreSQL unique constraint violation P2002)
          if (
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code: string }).code === "P2002"
          ) {
            const reFetched = await this.db.chatMessage.findUnique({
              where: { id: validated.clientMessageId },
            });
            if (reFetched) {
              userMessage = reFetched;
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
      }
    } else {
      // 2b. Heuristic retry deduplication for callers without clientMessageId
      const lastMessage = await this.db.chatMessage.findFirst({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
      });

      const isUnrepliedRetry =
        lastMessage !== null &&
        lastMessage.role === ChatMessageRole.USER &&
        lastMessage.content.trim() === validated.message.trim();

      if (isUnrepliedRetry) {
        // Reuse the existing persisted user message from the prior failed attempt (prevents duplicate user turns)
        userMessage = lastMessage;
      } else {
        // Persist user message first (ensures user message is retained even if AI generation fails)
        userMessage = await this.db.chatMessage.create({
          data: {
            conversationId: conversation.id,
            role: ChatMessageRole.USER,
            content: validated.message,
            createdAt: now,
          },
        });
      }
    }

    // 3. Load conversation history for context
    const previousMessages = await this.db.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    // Format history for Gemini (excluding the just-saved current user message and any internal audit entries)
    const history = previousMessages
      .filter((m) => m.id !== userMessage.id && !isInternalAuditMessage(m))
      .map((m) => ({
        role: (m.role === ChatMessageRole.USER ? "user" : "model") as "user" | "model",
        text: m.content,
      }));

    // Build localized system instructions
    const systemInstruction = buildSystemInstruction(
      conversation.language,
      lead.project ? `${lead.project.name} (${lead.project.id})` : null
    );

    // Track fact sheet IDs and records retrieved during this turn
    const turnGroundingFactIds = new Set<string>();
    const allRetrievedFacts: Array<{
      id: string;
      key: string;
      value: string;
      scope: FactSheetScope;
      projectId: string | null;
    }> = [];
    let lastRetrievedFacts: Array<{
      id: string;
      key: string;
      value: string;
      scope: FactSheetScope;
      projectId: string | null;
    }> = [];

    let finalAiText = "";
    let handoffCreated = false;
    let handoffRecord: Awaited<ReturnType<typeof this.db.handoff.create>> | null = null;

    // Inspect prior assistant message for multi-option offers (e.g. visit vs sales executive)
    const lastModelMessage = [...history].reverse().find((h) => h.role === "model");
    const isAmbiguousAffirmative = this.isAmbiguousAffirmative(validated.message);
    const isNumberedDisambiguation =
      Boolean(lastModelMessage) && this.isNumberedDisambiguationPrompt(lastModelMessage!.text);

    const isOption1 = isNumberedDisambiguation && this.isOption1Selection(validated.message);
    const isOption2 = isNumberedDisambiguation && this.isOption2Selection(validated.message);

    const isConsecutiveAmbiguousFollowUp =
      Boolean(lastModelMessage) &&
      (this.isFirstDisambiguationPrompt(lastModelMessage!.text) || isNumberedDisambiguation) &&
      isAmbiguousAffirmative;

    const isFirstAmbiguousFollowUp =
      Boolean(lastModelMessage) &&
      !isConsecutiveAmbiguousFollowUp &&
      this.offersSiteVisitOrSalesExecutive(lastModelMessage!.text) &&
      isAmbiguousAffirmative;

    const isAmbiguousFollowUp = isFirstAmbiguousFollowUp || isConsecutiveAmbiguousFollowUp;

    if (isOption1) {
      const slots = await this.bookingService.getAvailableSlots({});
      const slotSummary = slots.map((s) => ({
        id: s.id,
        startsAtIST: formatInTimeZone(s.startsAt, "Asia/Kolkata", "dd MMM yyyy, hh:mm a 'IST'"),
        location: s.location,
      }));
      if (slots.length === 0) {
        finalAiText = this.localizeText(
          conversation.language,
          "No upcoming visit slots are currently available. Would you like me to connect you with our sales team?",
          "वर्तमान में कोई आगामी विज़िट स्लॉट उपलब्ध नहीं हैं। क्या आप चाहेंगे कि मैं आपको हमारी बिक्री टीम से जोड़ूँ?",
          "હાલમાં કોઈ આગામી મુલાકાત સ્લોટ ઉપલબ્ધ નથી. શું તમે ઈચ્છો છો કે હું તમને અમારી વેચાણ ટીમ સાથે જોડું?"
        );
      } else {
        const slotsText = slotSummary
          .slice(0, 3)
          .map((s) => `• ${s.startsAtIST} (ID: ${s.id})`)
          .join("\n");
        finalAiText = this.localizeText(
          conversation.language,
          `Here are our upcoming available slots for your site visit:\n${slotsText}\n\nPlease let me know which time works best for you so I can confirm it!`,
          `आपकी साइट विज़िट के लिए आगामी उपलब्ध स्लॉट यहाँ हैं:\n${slotsText}\n\nकृपया मुझे बताएं कि कौन सा समय आपके लिए सबसे अच्छा है ताकि मैं पुष्टि कर सकूँ!`,
          `તમારી સાઇટ મુલાકાત માટે ઉપલબ્ધ સ્લોટ્સ અહીં છે:\n${slotsText}\n\nકૃપા કરીને મને જણાવો કે કયો સમય તમારા માટે શ્રેષ્ઠ છે જેથી હું તેની પુષ્ટિ કરી શકું!`
        );
      }
    } else if (isOption2) {
      const salesExec = await this.db.user.findFirst({
        where: { role: UserRole.SALES_EXEC },
        orderBy: { createdAt: "asc" },
      });
      const existingHandoff = await this.db.handoff.findUnique({
        where: { conversationId: conversation.id },
      });
      if (!existingHandoff) {
        handoffRecord = await this.db.handoff.create({
          data: {
            conversationId: conversation.id,
            escalationReason: EscalationReason.BUYER_REQUESTED,
            summary: "Buyer selected to speak with a sales executive from numbered options.",
            status: salesExec ? HandoffStatus.ASSIGNED : HandoffStatus.PENDING,
            assignedToId: salesExec?.id ?? null,
          },
          include: { assignedTo: true },
        });
      } else {
        handoffRecord = existingHandoff;
      }
      handoffCreated = true;
      const execName = salesExec?.name || "Vikram Mehta";
      finalAiText = this.buildHandoffExplanationMessage({
        language: conversation.language,
        execName,
        escalationReason: EscalationReason.BUYER_REQUESTED,
        summary: "Buyer requested to speak with a sales executive.",
        userMessage: validated.message,
        projectName: lead.project?.name,
      });
    } else if (isConsecutiveAmbiguousFollowUp) {
      finalAiText = this.localizeText(
        conversation.language,
        "Please choose one option so I can help you:\n1. Schedule a site visit\n2. Speak with a sales executive",
        "कृपया एक विकल्प चुनें ताकि मैं आपकी सहायता कर सकूँ:\n1. साइट विज़िट निर्धारित करें\n2. बिक्री कार्यकारी से बात करें",
        "કૃપા કરીને એક વિકલ્પ પસંદ કરો જેથી હું તમારી સહાય કરી શકું:\n1. સાઇટ મુલાકાત શેડ્યૂલ કરો\n2. સેલ્સ એક્ઝિક્યુટિવ સાથે વાત કરો"
      );
    } else if (isFirstAmbiguousFollowUp) {
      finalAiText = this.localizeText(
        conversation.language,
        "Certainly! Would you prefer to schedule a site visit or speak directly with a sales executive?",
        "ज़रूर! क्या आप साइट विज़िट निर्धारित करना पसंद करेंगे या बिक्री कार्यकारी से सीधे बात करना चाहेंगे?",
        "ચોક્કસ! શું તમે સાઇટ મુલાકાત શેડ્યૂલ કરવાનું પસંદ કરશો કે સેલ્સ એક્ઝિક્યુટિવ સાથે સીધી વાત કરવા માંગો છો?"
      );
    } else {
      // 4. Call Gemini client with multi-turn tool calling support (bounded by MAX_TOOL_ROUNDS = 3)
      const MAX_TOOL_ROUNDS = 3;
      const conversationContents: GeminiConversationContent[] = [
        ...history.map((h) => ({
          role: h.role,
          parts: [{ text: h.text }],
        })),
        {
          role: "user",
          parts: [{ text: validated.message }],
        },
      ];

      try {
      let round = 0;
      while (round < MAX_TOOL_ROUNDS) {
        round++;

        let turnResult: GeminiTurnResult;
        if (round === 1) {
          turnResult = await this.geminiClient.generate({
            systemInstruction,
            history,
            userMessage: validated.message,
            tools: aiToolDeclarations,
          });
        } else {
          if (!this.geminiClient.continueTurn) {
            break;
          }
          turnResult = await this.geminiClient.continueTurn({
            systemInstruction,
            contents: conversationContents,
            tools: aiToolDeclarations,
          });
        }

        if (turnResult.text && turnResult.text.trim().length > 0) {
          finalAiText = turnResult.text.trim();
        }

        const toolCalls = turnResult.toolCalls;
        if (!toolCalls || toolCalls.length === 0) {
          break;
        }

        const functionResponseParts: GeminiContentPart[] = [];
        let shouldStopEarly = false;

        for (const toolCall of toolCalls) {
          if (toolCall.name === "getVerifiedFacts") {
            const toolInput = getVerifiedFactsToolSchema.parse(toolCall.args);
            const facts = await this.getVerifiedFacts({
              scope: toolInput.scope,
              projectId: toolInput.projectId || lead.projectId,
            });

            for (const f of facts) {
              turnGroundingFactIds.add(f.id);
              if (!allRetrievedFacts.some((existing) => existing.id === f.id)) {
                allRetrievedFacts.push(f);
              }
            }
            lastRetrievedFacts = facts;

            functionResponseParts.push({
              functionResponse: {
                id: toolCall.id,
                name: "getVerifiedFacts",
                response: {
                  facts: facts.map((f) => ({
                    id: f.id,
                    scope: f.scope,
                    key: f.key,
                    value: f.value,
                  })),
                },
              },
            });
          } else if (toolCall.name === "checkSlotAvailability") {
            const toolInput = checkSlotAvailabilityToolSchema.parse(toolCall.args);
            const slots = await this.bookingService.getAvailableSlots({
              from: toolInput.startDate ? new Date(toolInput.startDate) : undefined,
              to: toolInput.endDate ? new Date(toolInput.endDate) : undefined,
            });

            const slotSummary = slots.map((s) => ({
              id: s.id,
              startsAtIST: formatInTimeZone(s.startsAt, "Asia/Kolkata", "dd MMM yyyy, hh:mm a 'IST'"),
              location: s.location,
            }));

            functionResponseParts.push({
              functionResponse: {
                id: toolCall.id,
                name: "checkSlotAvailability",
                response: { slots: slotSummary },
              },
            });

            if (!finalAiText) {
              if (slots.length === 0) {
                finalAiText = this.localizeText(
                  conversation.language,
                  "No upcoming visit slots are currently available. Would you like me to connect you with our sales team?",
                  "वर्तमान में कोई आगामी विज़िट स्लॉट उपलब्ध नहीं हैं। क्या आप चाहेंगे कि मैं आपको हमारी बिक्री टीम से जोड़ूँ?",
                  "હાલમાં કોઈ આગામી મુલાકાત સ્લોટ ઉપલબ્ધ નથી. શું તમે ઈચ્છો છો કે હું તમને અમારી વેચાણ ટીમ સાથે જોડું?"
                );
              } else {
                const slotsText = slotSummary
                  .slice(0, 3)
                  .map((s) => `• ${s.startsAtIST} (ID: ${s.id})`)
                  .join("\n");
                finalAiText = this.localizeText(
                  conversation.language,
                  `Here are our upcoming available slots for your site visit:\n${slotsText}\n\nPlease let me know which time works best for you so I can confirm it!`,
                  `आपकी साइट विज़िट के लिए आगामी उपलब्ध स्लॉट यहाँ हैं:\n${slotsText}\n\nकृपया मुझे बताएं कि कौन सा समय आपके लिए सबसे अच्छा है ताकि मैं पुष्टि कर सकूँ!`,
                  `તમારી સાઇટ મુલાકાત માટે ઉપલબ્ધ સ્લોટ્સ અહીં છે:\n${slotsText}\n\nકૃપા કરીને મને જણાવો કે કયો સમય તમારા માટે શ્રેષ્ઠ છે જેથી હું તેની પુષ્ટિ કરી શકું!`
                );
              }
            }
          } else if (toolCall.name === "bookVisitSlot") {
            const toolInput = bookVisitSlotToolSchema.parse(toolCall.args);

            if (!this.allowDirectToolBooking) {
              finalAiText = this.localizeText(
                conversation.language,
                "To ensure your site visit appointment is reserved accurately, bookings require explicit buyer confirmation through our interactive slot selector or direct confirmation with our sales team. Would you like me to connect you with our sales executive to finalize your visit?",
                "आपकी साइट विज़िट अपॉइंटमेंट सटीक रूप से आरक्षित हो, यह सुनिश्चित करने के लिए बुकिंग के लिए हमारे इंटरैक्टिव स्लॉट चयनकर्ता के माध्यम से या हमारी बिक्री टीम के साथ सीधी पुष्टि की आवश्यकता होती है। क्या आप चाहेंगे कि मैं आपकी विज़िट को अंतिम रूप देने के लिए आपको हमारे बिक्री कार्यकारी से जोड़ूँ?",
                "તમારી સાઇટ મુલાકાત યોગ્ય રીતે નક્કી થાય તે સુનિશ્ચિત કરવા માટે, બુકિંગ માટે અમારા ઇન્ટરેક્ટિવ સ્લોટ સિલેક્ટર દ્વારા અથવા અમારી સેલ્સ ટીમ સાથે સીધી પુષ્ટિની જરૂર છે. શું તમે ઈચ્છો છો કે તમારી મુલાકાત કન્ફર્મ કરવા હું તમને અમારા સેલ્સ એક્ઝિક્યુટિવ સાથે જોડું?"
              );
              shouldStopEarly = true;
            } else {
              const booking = await this.bookingService.bookVisit({
                slotId: toolInput.slotId,
                leadId: conversation.leadId,
              });

              const istTime = formatInTimeZone(booking.slot.startsAt, "Asia/Kolkata", "EEEE, dd MMMM yyyy 'at' hh:mm a 'IST'");
              finalAiText = this.localizeText(
                conversation.language,
                `Your site visit has been confirmed for ${istTime} at ${booking.slot.location}. We look forward to welcoming you!`,
                `आपकी साइट विज़िट ${istTime} पर ${booking.slot.location} पर कन्फर्म हो गई है। हम आपका स्वागत करने के लिए तत्पर हैं!`,
                `તમારી સાઇટ મુલાકાત ${istTime} વાગ્યે ${booking.slot.location} ખાતે કન્ફર્મ થઈ ગઈ છે. અમે તમારું સ્વાગત કરવા આતુર છીએ!`
              );
              shouldStopEarly = true;
            }
          } else if (toolCall.name === "handoffToExecutive") {
            const toolInput = handoffToExecutiveToolSchema.parse(toolCall.args);

            const salesExec = await this.db.user.findFirst({
              where: { role: UserRole.SALES_EXEC },
              orderBy: { createdAt: "asc" },
            });

            const existingHandoff = await this.db.handoff.findUnique({
              where: { conversationId: conversation.id },
            });

            if (!existingHandoff) {
              handoffRecord = await this.db.handoff.create({
                data: {
                  conversationId: conversation.id,
                  escalationReason: toolInput.escalationReason,
                  summary: toolInput.summary,
                  status: salesExec ? HandoffStatus.ASSIGNED : HandoffStatus.PENDING,
                  assignedToId: salesExec?.id ?? null,
                },
                include: { assignedTo: true },
              });
            } else {
              handoffRecord = existingHandoff;
            }

            handoffCreated = true;
            const execName = salesExec?.name || "Vikram Mehta";

            finalAiText = this.buildHandoffExplanationMessage({
              language: conversation.language,
              execName,
              escalationReason: toolInput.escalationReason,
              summary: toolInput.summary,
              userMessage: validated.message,
              projectName: lead.project?.name,
            });
            shouldStopEarly = true;
          }
        }

        if (shouldStopEarly) {
          break;
        }

        if (functionResponseParts.length > 0 && this.geminiClient.continueTurn) {
          const modelParts: GeminiContentPart[] =
            turnResult.rawParts && turnResult.rawParts.length > 0
              ? turnResult.rawParts
              : toolCalls.map((tc) => ({
                  functionCall: {
                    id: tc.id,
                    name: tc.name,
                    args: tc.args,
                  },
                }));

          conversationContents.push({
            role: "model",
            parts: modelParts,
          });

          conversationContents.push({
            role: "user",
            parts: functionResponseParts,
          });

          finalAiText = "";
        } else {
          break;
        }
      }

        const hasUsableAiText = Boolean(finalAiText && finalAiText.trim().length > 0);
        const factsForFallback = allRetrievedFacts.length > 0 ? allRetrievedFacts : lastRetrievedFacts;

        // Invariant: If verified facts were retrieved but Gemini did not produce a usable text answer,
        // strictly generate the answer from allRetrievedFacts. Never emit the welcome greeting.
        if (!hasUsableAiText && (factsForFallback.length > 0 || turnGroundingFactIds.size > 0)) {
          finalAiText = this.formatDeterministicFactResponse(factsForFallback, conversation.language);
        }

        const isWelcomeGreeting = (text: string): boolean => {
          const trimmed = text.trim();
          return (
            trimmed ===
              this.localizeText(
                conversation.language,
                "Thank you for contacting ENQUIVO. How can I assist you with our luxury residential properties today?",
                "ENQUIVO से संपर्क करने के लिए धन्यवाद। आज मैं हमारी लक्जरी आवासीय संपत्तियों के बारे में आपकी क्या मदद कर सकता हूँ?",
                "ENQUIVO નો સંપર્ક કરવા બદલ આભાર. આજે હું તમને અમારી લક્ઝરી રહેણાંક મિલકતો વિશે કેવી રીતે મદદ કરી શકું?"
              ).trim() ||
            trimmed.includes("Thank you for contacting ENQUIVO") ||
            trimmed.includes("ENQUIVO से संपर्क करने के लिए धन्यवाद") ||
            trimmed.includes("ENQUIVO નો સંપર્ક કરવા બદલ આભાર")
          );
        };

        // The generic greeting is strictly and only for genuine initial conversational openings with zero retrieved facts
        if (!finalAiText || finalAiText.trim().length === 0 || (history.length > 0 && isWelcomeGreeting(finalAiText))) {
          if (history.length > 0) {
            // Follow-up turn: Never restart the conversation with the initial welcome greeting!
            if (isConsecutiveAmbiguousFollowUp) {
              finalAiText = this.localizeText(
                conversation.language,
                "Please choose one option so I can help you:\n1. Schedule a site visit\n2. Speak with a sales executive",
                "कृपया एक विकल्प चुनें ताकि मैं आपकी सहायता कर सकूँ:\n1. साइट विज़िट निर्धारित करें\n2. बिक्री कार्यकारी से बात करें",
                "કૃપા કરીને એક વિકલ્પ પસંદ કરો જેથી હું તમારી સહાય કરી શકું:\n1. સાઇટ મુલાકાત શેડ્યૂલ કરો\n2. સેલ્સ એક્ઝિક્યુટિવ સાથે વાત કરો"
              );
            } else if (isFirstAmbiguousFollowUp) {
              finalAiText = this.localizeText(
                conversation.language,
                "Certainly! Would you prefer to schedule a site visit or speak directly with a sales executive?",
                "ज़रूर! क्या आप साइट विज़िट निर्धारित करना पसंद करेंगे या बिक्री कार्यकारी से सीधे बात करना चाहेंगे?",
                "ચોક્કસ! શું તમે સાઇટ મુલાકાત શેડ્યૂલ કરવાનું પસંદ કરશો કે સેલ્સ એક્ઝિક્યુટિવ સાથે સીધી વાત કરવા માંગો છો?"
              );
            } else {
              finalAiText = this.localizeText(
                conversation.language,
                "Could you please clarify how you would like to proceed? I can help you check site visit availability, connect you with our sales team, or answer questions about our properties.",
                "क्या आप स्पष्ट कर सकते हैं कि आप कैसे आगे बढ़ना चाहेंगे? मैं साइट विज़िट की उपलब्धता देखने, बिक्री टीम से जुड़ने, या हमारे प्रोजेक्ट्स के बारे में आपके प्रश्नों के उत्तर देने में मदद कर सकता हूँ।",
                "શું તમે સ્પષ્ટ કરી શકો છો કે તમે કેવી રીતે આગળ વધવા માંગો છો? હું સાઇટ મુલાકાતની ઉપલબ્ધતા તપાસવામાં, સેલ્સ ટીમ સાથે જોડવામાં, અથવા અમારા પ્રોજેક્ટ્સ વિશેના તમારા પ્રશ્નોના જવાબો આપવામાં મદદ કરી શકું છું."
              );
            }
          } else {
            finalAiText = this.localizeText(
              conversation.language,
              "Thank you for contacting ENQUIVO. How can I assist you with our luxury residential properties today?",
              "ENQUIVO से संपर्क करने के लिए धन्यवाद। आज मैं हमारी लक्जरी आवासीय संपत्तियों के बारे में आपकी क्या मदद कर सकता हूँ?",
              "ENQUIVO નો સંપર્ક કરવા બદલ આભાર. આજે હું તમને અમારી લક્ઝરી રહેણાંક મિલકતો વિશે કેવી રીતે મદદ કરી શકું?"
            );
          }
        }
      } catch (turnError) {
        const factsForFallback = allRetrievedFacts.length > 0 ? allRetrievedFacts : lastRetrievedFacts;
        if (factsForFallback.length > 0 || turnGroundingFactIds.size > 0) {
          console.warn(
            "[AIConciergeService] Gemini continuation failed after facts were retrieved. Falling back to deterministic verified facts.",
            turnError instanceof Error ? turnError.message : turnError
          );
          finalAiText = this.formatDeterministicFactResponse(factsForFallback, conversation.language);
        } else if (history.length > 0) {
          if (isConsecutiveAmbiguousFollowUp) {
            finalAiText = this.localizeText(
              conversation.language,
              "Please choose one option so I can help you:\n1. Schedule a site visit\n2. Speak with a sales executive",
              "कृपया एक विकल्प चुनें ताकि मैं आपकी सहायता कर सकूँ:\n1. साइट विज़िट निर्धारित करें\n2. बिक्री कार्यकारी से बात करें",
              "કૃપા કરીને એક વિકલ્પ પસંદ કરો જેથી હું તમારી સહાય કરી શકું:\n1. સાઇટ મુલાકાત શેડ્યૂલ કરો\n2. સેલ્સ એક્ઝિક્યુટિવ સાથે વાત કરો"
            );
          } else if (isFirstAmbiguousFollowUp) {
            finalAiText = this.localizeText(
              conversation.language,
              "Certainly! Would you prefer to schedule a site visit or speak directly with a sales executive?",
              "ज़रूर! क्या आप साइट विज़िट निर्धारित करना पसंद करेंगे या बिक्री कार्यकारी से सीधे बात करना चाहेंगे?",
              "ચોક્કસ! શું તમે સાઇટ મુલાકાત શેડ્યૂલ કરવાનું પસંદ કરશો કે સેલ્સ એક્ઝિક્યુટિવ સાથે સીધી વાત કરવા માંગો છો?"
            );
          } else {
            finalAiText = this.localizeText(
              conversation.language,
              "Could you please clarify how you would like to proceed? I can help you check site visit availability, connect you with our sales team, or answer questions about our properties.",
              "क्या आप स्पष्ट कर सकते हैं कि आप कैसे आगे बढ़ना चाहेंगे? मैं साइट विज़िट की उपलब्धता देखने, बिक्री टीम से जुड़ने, या हमारे प्रोजेक्ट्स के बारे में आपके प्रश्नों के उत्तर देने में मदद कर सकता हूँ।",
              "શું તમે સ્પષ્ટ કરી શકો છો કે તમે કેવી રીતે આગળ વધવા માંગો છો? હું સાઇટ મુલાકાતની ઉપલબ્ધતા તપાસવામાં, સેલ્સ ટીમ સાથે જોડવામાં, અથવા અમારા પ્રોજેક્ટ્સ વિશેના તમારા પ્રશ્નોના જવાબો આપવામાં મદદ કરી શકું છું."
            );
          }
        } else {
          throw classifyGeminiError(turnError);
        }
      }
    }

    // Sanitize potential duplicate RERA notices in generated AI text
    finalAiText = this.sanitizeReraNotice(finalAiText);

    // Pure clarifications, greetings, and disambiguation prompts must NOT carry the statutory RERA demo disclaimer
    if (isAmbiguousFollowUp || isOption1 || isOption2 || turnGroundingFactIds.size === 0) {
      finalAiText = this.stripReraNotice(finalAiText);
    }

    // 5. Persist AI response
    const isInitialOpening =
      finalAiText.trim() ===
      this.localizeText(
        conversation.language,
        "Thank you for contacting ENQUIVO. How can I assist you with our luxury residential properties today?",
        "ENQUIVO से संपर्क करने के लिए धन्यवाद। आज मैं हमारी लक्जरी आवासीय संपत्तियों के बारे में आपकी क्या मदद कर सकता हूँ?",
        "ENQUIVO નો સંપર્ક કરવા બદલ આભાર. આજે હું તમને અમારી લક્ઝરી રહેણાંક મિલકતો વિશે કેવી રીતે મદદ કરી શકું?"
      ).trim();

    // Invariant: Grounding metadata must accurately correspond to the saved response:
    // - Initial greeting or follow-up clarification: strictly []
    // - Pure handoff (or handoff where no verified facts are cited in the text): strictly []
    // - Partial handoff with cited facts: only fact IDs whose value is actually cited in finalAiText
    // - Genuine factual answer: all turnGroundingFactIds
    let persistedGroundingFactIds: string[];
    if (isInitialOpening || isAmbiguousFollowUp || isOption1 || isOption2 || turnGroundingFactIds.size === 0) {
      persistedGroundingFactIds = [];
    } else if (handoffCreated) {
      const citedFactIds = allRetrievedFacts
        .filter((f) => {
          if (!f.value) return false;
          const snippet = f.value.slice(0, 30).toLowerCase();
          return finalAiText.toLowerCase().includes(snippet);
        })
        .map((f) => f.id);
      persistedGroundingFactIds = citedFactIds;
    } else {
      persistedGroundingFactIds = Array.from(turnGroundingFactIds);
    }

      const aiMessage = await this.db.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: ChatMessageRole.AI,
          content: finalAiText,
          groundingFactIds: persistedGroundingFactIds,
          createdAt: new Date(),
        },
      });

      // 6. Set Lead.firstResponseAt only on successful first AI response
      await this.db.lead.updateMany({
        where: {
          id: conversation.leadId,
          firstResponseAt: null,
        },
        data: {
          firstResponseAt: new Date(),
        },
      });

      return {
        userMessage,
        aiMessage,
        groundingFactIds: persistedGroundingFactIds,
        handoffCreated,
        handoff: handoffRecord,
      };
  }

  /**
   * Directly creates and assigns a human sales executive handoff WITHOUT invoking Gemini.
   * Guarantees 100% availability for buyer escalation even during AI provider outages or high demand.
   */
  async createManualHandoff(params: {
    conversationId: string;
    leadId: string;
    escalationReason?: EscalationReason;
    summary?: string;
  }) {
    const conversation = await this.db.conversation.findUnique({
      where: { id: params.conversationId },
      include: { lead: true },
    });

    if (!conversation) {
      throw new AIConversationNotFoundError(`Conversation ${params.conversationId} not found`);
    }

    if (conversation.leadId !== params.leadId) {
      throw new AISecurityError(
        `Security violation: Conversation ${params.conversationId} does not belong to lead ${params.leadId}`
      );
    }

    // Query an active sales executive from PostgreSQL
    const salesExec = await this.db.user.findFirst({
      where: { role: UserRole.SALES_EXEC },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true },
    });

    const reason = params.escalationReason ?? EscalationReason.BUYER_REQUESTED;
    const summary = params.summary ?? "Buyer requested direct contact with a human sales executive.";

    // Idempotent handoff creation: find existing or create
    let handoff = await this.db.handoff.findUnique({
      where: { conversationId: conversation.id },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!handoff) {
      handoff = await this.db.handoff.create({
        data: {
          conversationId: conversation.id,
          escalationReason: reason,
          summary,
          status: salesExec ? HandoffStatus.ASSIGNED : HandoffStatus.PENDING,
          assignedToId: salesExec?.id ?? null,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }

    const execName = handoff.assignedTo?.name || "our senior sales executive";

    // Localized AI confirmation message
    const confirmationText = this.localizeText(
      conversation.language,
      `I have connected you directly with ${execName}. They have received your conversation history and will reach out to assist you shortly.`,
      `मैंने आपको सीधे ${execName} से जोड़ दिया है। उन्हें आपकी बातचीत की जानकारी मिल गई है और वे शीघ्र ही आपसे संपर्क करेंगे।`,
      `મેં તમને સીધા ${execName} સાથે જોડ્યા છે. તેમને તમારી વાતચીતની વિગતો મળી ગઈ છે અને તેઓ ટૂંક સમયમાં તમારો સંપર્ક કરશે.`
    );

    // Persist system AI confirmation message in chat history
    const aiMessage = await this.db.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: ChatMessageRole.AI,
        content: confirmationText,
        groundingFactIds: [],
        createdAt: new Date(),
      },
    });

    // Update Lead.firstResponseAt if null
    await this.db.lead.updateMany({
      where: {
        id: conversation.leadId,
        firstResponseAt: null,
      },
      data: {
        firstResponseAt: new Date(),
      },
    });

    return {
      success: true,
      handoff,
      aiMessage,
      assignedToName: execName,
    };
  }

  /**
   * Helper to select localized message text based on ConversationLanguage.
   */
  private localizeText(
    lang: ConversationLanguage,
    en: string,
    hi: string,
    gu: string
  ): string {
    if (lang === ConversationLanguage.HI) return hi;
    if (lang === ConversationLanguage.GU) return gu;
    return en;
  }
}
