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
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiTurnResult {
  text?: string;
  toolCalls?: GeminiToolCall[];
}

export interface GeminiClientInterface {
  generate(params: {
    systemInstruction: string;
    history: Array<{ role: "user" | "model"; text: string }>;
    userMessage: string;
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
 * Default live Gemini client implementation using @google/genai SDK.
 * Configures bounded HTTP-level exponential backoff with jitter natively via SDK httpOptions.retryOptions.
 * Prevents nested retry loops by relying on the client's HTTP retry policy.
 */
export const createDefaultGeminiClient = (): GeminiClientInterface => {
  return {
    async generate({ systemInstruction, history, userMessage, tools }) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "your-google-gemini-api-key") {
        throw new AIAuthError(
          "GEMINI_API_KEY is not configured in .env.local. Configure a valid Google Gemini API key to run live AI generations."
        );
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
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

      const contents = [
        ...history.map((h) => ({
          role: h.role,
          parts: [{ text: h.text }],
        })),
        {
          role: "user",
          parts: [{ text: userMessage }],
        },
      ];

      interface ContentPart {
        text?: string;
        functionCall?: {
          name: string;
          args: Record<string, unknown>;
        };
      }

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: tools as unknown as Record<string, unknown>[] }],
          },
        });

        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts as ContentPart[] | undefined;
        const text = parts?.find((p) => p.text)?.text;
        const functionCalls = parts
          ?.filter(
            (
              p
            ): p is ContentPart & {
              functionCall: { name: string; args: Record<string, unknown> };
            } => Boolean(p.functionCall)
          )
          ?.map((p) => ({
            name: p.functionCall.name,
            args: p.functionCall.args || {},
          }));

        return {
          text,
          toolCalls: functionCalls && functionCalls.length > 0 ? functionCalls : undefined,
        };
      } catch (rawError) {
        throw classifyGeminiError(rawError);
      }
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
5. Always display or include the compliance notice: "${reraDisclaimer}". Never represent it as an actual government-verified RERA number.
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
  ) {}

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

    // Format history for Gemini (excluding the just-saved current user message)
    const history = previousMessages
      .filter((m) => m.id !== userMessage.id)
      .map((m) => ({
        role: (m.role === ChatMessageRole.USER ? "user" : "model") as "user" | "model",
        text: m.content,
      }));

    // Build localized system instructions
    const systemInstruction = buildSystemInstruction(
      conversation.language,
      lead.project ? `${lead.project.name} (${lead.project.id})` : null
    );

    // Track fact sheet IDs retrieved during this turn
    const turnGroundingFactIds = new Set<string>();

    let finalAiText = "";
    let handoffCreated = false;
    let handoffRecord: Awaited<ReturnType<typeof this.db.handoff.create>> | null = null;

    // 4. Call Gemini client
    try {
      const turnResult = await this.geminiClient.generate({
        systemInstruction,
        history,
        userMessage: validated.message,
        tools: aiToolDeclarations,
      });

      // Handle server-side tool calls if invoked by model
      if (turnResult.toolCalls && turnResult.toolCalls.length > 0) {
        for (const toolCall of turnResult.toolCalls) {
          if (toolCall.name === "getVerifiedFacts") {
            const toolInput = getVerifiedFactsToolSchema.parse(toolCall.args);
            const facts = await this.getVerifiedFacts({
              scope: toolInput.scope,
              projectId: toolInput.projectId || lead.projectId,
            });

            for (const f of facts) {
              turnGroundingFactIds.add(f.id);
            }
          } else if (toolCall.name === "checkSlotAvailability") {
            const toolInput = checkSlotAvailabilityToolSchema.parse(toolCall.args);
            const slots = await this.bookingService.getAvailableSlots({
              from: toolInput.startDate ? new Date(toolInput.startDate) : undefined,
              to: toolInput.endDate ? new Date(toolInput.endDate) : undefined,
            });

            // Format slots with IST time for model
            const slotSummary = slots.map((s) => ({
              id: s.id,
              startsAtIST: formatInTimeZone(s.startsAt, "Asia/Kolkata", "dd MMM yyyy, hh:mm a 'IST'"),
              location: s.location,
            }));

            // If model didn't provide text, construct slot response
            if (!turnResult.text) {
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

            // M5.2 Security Boundary: Do not allow a Gemini tool call alone to finalize a booking
            // without independent interactive buyer confirmation.
            if (!this.allowDirectToolBooking) {
              finalAiText = this.localizeText(
                conversation.language,
                "To ensure your site visit appointment is reserved accurately, bookings require explicit buyer confirmation through our interactive slot selector or direct confirmation with our sales team. Would you like me to connect you with our sales executive to finalize your visit?",
                "आपकी साइट विज़िट अपॉइंटमेंट सटीक रूप से आरक्षित हो, यह सुनिश्चित करने के लिए बुकिंग के लिए हमारे इंटरैक्टिव स्लॉट चयनकर्ता के माध्यम से या हमारी बिक्री टीम के साथ सीधी पुष्टि की आवश्यकता होती है। क्या आप चाहेंगे कि मैं आपकी विज़िट को अंतिम रूप देने के लिए आपको हमारे बिक्री कार्यकारी से जोड़ूँ?",
                "તમારી સાઇટ મુલાકાત યોગ્ય રીતે નક્કી થાય તે સુનિશ્ચિત કરવા માટે, બુકિંગ માટે અમારા ઇન્ટરેક્ટિવ સ્લોટ સિલેક્ટર દ્વારા અથવા અમારી સેલ્સ ટીમ સાથે સીધી પુષ્ટિની જરૂર છે. શું તમે ઈચ્છો છો કે તમારી મુલાકાત કન્ફર્મ કરવા હું તમને અમારા સેલ્સ એક્ઝિક્યુટિવ સાથે જોડું?"
              );
            } else {
              // SECURITY: Derive leadId strictly from the validated conversation context
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
            }
          } else if (toolCall.name === "handoffToExecutive") {
            const toolInput = handoffToExecutiveToolSchema.parse(toolCall.args);

            // Query an active sales executive from the database
            const salesExec = await this.db.user.findFirst({
              where: { role: UserRole.SALES_EXEC },
              orderBy: { createdAt: "asc" },
            });

            // Idempotent handoff creation
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
            const execName = salesExec?.name || "our senior sales executive";

            finalAiText = this.localizeText(
              conversation.language,
              `I have connected you with ${execName} regarding your request. They have received your conversation summary and will reach out to assist you shortly.`,
              `मैंने आपके अनुरोध के संबंध में आपको ${execName} से जोड़ दिया है। उन्हें आपकी बातचीत का विवरण मिल गया है और वे शीघ्र ही आपसे संपर्क करेंगे।`,
              `મેં તમારી વિનંતી અંગે તમને ${execName} સાથે જોડ્યા છે. તેમને તમારી વાતચીતની વિગતો મળી ગઈ છે અને તેઓ ટૂંક સમયમાં તમારો સંપર્ક કરશે.`
            );
          }
        }
      }

      // If text was provided by the model and not overridden by specific tool formatting
      if (!finalAiText && turnResult.text) {
        finalAiText = turnResult.text;
      }

      // Fallback response if neither tool nor model provided text
      if (!finalAiText) {
        finalAiText = this.localizeText(
          conversation.language,
          "Thank you for contacting ENQUIVO. How can I assist you with our luxury residential properties today?",
          "ENQUIVO से संपर्क करने के लिए धन्यवाद। आज मैं हमारी लक्जरी आवासीय संपत्तियों के बारे में आपकी क्या मदद कर सकता हूँ?",
          "ENQUIVO નો સંપર્ક કરવા બદલ આભાર. આજે હું તમને અમારી લક્ઝરી રહેણાંક મિલકતો વિશે કેવી રીતે મદદ કરી શકું?"
        );
      }

      // 5. Persist AI response
      const aiMessage = await this.db.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: ChatMessageRole.AI,
          content: finalAiText,
          groundingFactIds: Array.from(turnGroundingFactIds),
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
        groundingFactIds: Array.from(turnGroundingFactIds),
        handoffCreated,
        handoff: handoffRecord,
      };
    } catch (error) {
      // User message is already safely stored in DB; classify transient vs permanent errors
      throw classifyGeminiError(error);
    }
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
