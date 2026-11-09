import { describe, it, expect, vi } from "vitest";
import {
  PrismaClient,
  ConversationLanguage,
  FactSheetScope,
  FactSheetStatus,
  UserRole,
} from "@prisma/client";
import {
  AIConciergeService,
  GeminiClientInterface,
  GeminiTurnResult,
  GeminiConversationContent,
  AIRateLimitError,
} from "@/services/ai/ai.service";
import { BookingService } from "@/services/booking/booking.service";

describe("AI Concierge Multi-Turn Tool Execution & Grounding (Unit Tests)", () => {
  const verifiedFactsMock = [
    {
      id: "fact-port-1",
      key: "portfolio_apartments",
      value: "420 total luxury apartments across Ahmedabad",
      scope: FactSheetScope.PORTFOLIO,
      status: FactSheetStatus.VERIFIED,
      isActive: true,
      projectId: null,
      createdById: "user-admin",
      verifiedById: "user-admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "fact-port-2",
      key: "portfolio_pricing",
      value: "₹65 lakh to ₹1.2 crore price range",
      scope: FactSheetScope.PORTFOLIO,
      status: FactSheetStatus.VERIFIED,
      isActive: true,
      projectId: null,
      createdById: "user-admin",
      verifiedById: "user-admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  function createMockPrisma(options: {
    language?: ConversationLanguage;
    persistedUserMessage?: unknown;
  } = {}) {
    const currentLang = options.language ?? ConversationLanguage.EN;

    const mockDb = {
      conversation: {
        findUnique: vi.fn().mockResolvedValue({
          id: "conv-101",
          leadId: "lead-202",
          language: currentLang,
          lead: {
            id: "lead-202",
            name: "Hardik Patel",
            projectId: null,
            project: null,
            consentRecord: {
              optedOut: false,
              consentedAt: new Date(),
            },
          },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      chatMessage: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(options.persistedUserMessage ?? null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ...data,
          })
        ),
      },
      factSheet: {
        findMany: vi.fn().mockResolvedValue(
          verifiedFactsMock.map((f) => ({
            id: f.id,
            key: f.key,
            value: f.value,
            scope: f.scope,
            projectId: f.projectId,
          }))
        ),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: "exec-1",
          name: "Vikram Mehta",
          role: UserRole.SALES_EXEC,
        }),
      },
      handoff: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "handoff-101",
            ...data,
            assignedTo: { id: "exec-1", name: "Vikram Mehta" },
          })
        ),
      },
      lead: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    return mockDb;
  }

  it("1. passes typed functionResponse in turn 2 to Gemini and returns model grounded response", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    let continueTurnCalledWith: {
      contents: GeminiConversationContent[];
    } | null = null;

    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [
          {
            name: "getVerifiedFacts",
            args: { scope: "PORTFOLIO" },
          },
        ],
      } satisfies GeminiTurnResult),

      continueTurn: vi.fn().mockImplementation(async (params) => {
        continueTurnCalledWith = params;
        return {
          text: "We offer 420 luxury apartments across Ahmedabad ranging from ₹65 lakh to ₹1.2 crore. RERA Reg: DEMO-ONLY-NOT-VERIFIED.",
          toolCalls: undefined,
        } satisfies GeminiTurnResult;
      }),
    };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    const result = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "What configurations and prices do you offer?",
    });

    // Verify turn 1 was invoked
    expect(mockGeminiClient.generate).toHaveBeenCalledTimes(1);

    // Verify turn 2 was invoked via continueTurn
    expect(mockGeminiClient.continueTurn).toHaveBeenCalledTimes(1);
    expect(continueTurnCalledWith).not.toBeNull();

    // Verify turn 2 contents included the model's functionCall and the user's functionResponse
    const contents = continueTurnCalledWith!.contents;
    expect(contents.length).toBeGreaterThanOrEqual(3); // [userMessage, modelFunctionCall, userFunctionResponse]

    const modelTurn = contents.find((c) => c.role === "model");
    expect(modelTurn).toBeDefined();

    const functionResponseTurn = contents.find(
      (c) => c.role === "user" && c.parts.some((p) => Boolean(p.functionResponse))
    );
    expect(functionResponseTurn).toBeDefined();
    const frPart = functionResponseTurn!.parts.find((p) => Boolean(p.functionResponse))!.functionResponse!;
    expect(frPart.name).toBe("getVerifiedFacts");
    expect(frPart.response).toHaveProperty("facts");

    // Verify final AI response is the model's grounded text (NOT the repetitive greeting!)
    expect(result.aiMessage.content).toContain("420 luxury apartments");
    expect(result.aiMessage.content).not.toContain("Thank you for contacting ENQUIVO. How can I assist you with our luxury residential properties today?");
    expect(result.groundingFactIds).toContain("fact-port-1");
    expect(result.groundingFactIds).toContain("fact-port-2");
  });

  it("2. provides deterministic localized fallback with RERA notice if turn 2 hits rate limit (429)", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [
          {
            name: "getVerifiedFacts",
            args: { scope: "PORTFOLIO" },
          },
        ],
      }),

      continueTurn: vi.fn().mockRejectedValue(new AIRateLimitError("Resource exhausted: 429")),
    };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    const result = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "Tell me about your projects",
    });

    // Even though turn 2 hit rate limit 429, the service recovered and returned deterministic facts!
    expect(result.aiMessage.content).toContain("420 total luxury apartments");
    expect(result.aiMessage.content).toContain("₹65 lakh to ₹1.2 crore");
    expect(result.aiMessage.content).toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
    expect(result.aiMessage.content).not.toContain("Thank you for contacting ENQUIVO");
  });

  it("3. bounds multi-turn execution to MAX_TOOL_ROUNDS = 3 when model loops tool calls", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    let continueTurnCount = 0;
    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [{ name: "getVerifiedFacts", args: { scope: "PORTFOLIO" } }],
      }),

      continueTurn: vi.fn().mockImplementation(async () => {
        continueTurnCount++;
        // Model keeps returning tool call indefinitely
        return {
          text: undefined,
          toolCalls: [{ name: "getVerifiedFacts", args: { scope: "PORTFOLIO" } }],
        };
      }),
    };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    const result = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "Loop test",
    });

    // Total rounds must be bounded by MAX_TOOL_ROUNDS = 3 (1 initial generate + 2 continueTurns)
    expect(mockGeminiClient.generate).toHaveBeenCalledTimes(1);
    expect(continueTurnCount).toBe(2);

    // Fallback gracefully provides deterministic grounded facts
    expect(result.aiMessage.content).toContain("420 total luxury apartments");
    expect(result.groundingFactIds.length).toBeGreaterThan(0);
  });

  it("4. persists and synchronizes selected language (HI/GU) across prompt and response", async () => {
    const mockDb = createMockPrisma({ language: ConversationLanguage.EN });
    const mockBookingService = {} as unknown as BookingService;

    let recordedSystemInstruction = "";
    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockImplementation(async (params) => {
        recordedSystemInstruction = params.systemInstruction;
        return {
          text: undefined,
          toolCalls: [{ name: "getVerifiedFacts", args: { scope: "PORTFOLIO" } }],
        };
      }),
      continueTurn: vi.fn().mockRejectedValue(new Error("API timeout")),
    };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    // Client sends language: "HI"
    const result = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "कीमतों के बारे में बताएं",
      language: ConversationLanguage.HI,
    });

    // DB conversation was updated with the new language
    expect(mockDb.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-101" },
      data: { language: ConversationLanguage.HI },
    });

    // System instruction enforced Hindi
    expect(recordedSystemInstruction).toContain("हिन्दी");

    // Fallback response produced authentic Hindi phrasing
    expect(result.aiMessage.content).toContain("अहमदाबाद में हमारे लक्जरी आवासीय प्रोजेक्ट्स");
    expect(result.aiMessage.content).toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
  });

  it("5. escalates to human sales executive on unlisted amenity inquiries", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [
          {
            name: "handoffToExecutive",
            args: {
              escalationReason: "UNLISTED_AMENITY",
              summary: "Buyer asked for private helipad and private golf course on SG Highway",
            },
          },
        ],
      }),
    };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    const result = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "Do you have a private helipad and a golf course?",
    });

    expect(result.handoffCreated).toBe(true);
    expect(result.handoff).not.toBeNull();
    expect(result.handoff?.escalationReason).toBe("UNLISTED_AMENITY");
    expect(result.aiMessage.content).toContain("Vikram Mehta");
  });
});

