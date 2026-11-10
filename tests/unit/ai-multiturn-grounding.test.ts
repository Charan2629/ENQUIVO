import { describe, it, expect, vi } from "vitest";
import {
  PrismaClient,
  ConversationLanguage,
  FactSheetScope,
  FactSheetStatus,
  UserRole,
  ChatMessageRole,
  EscalationReason,
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
      key: "portfolio_overview",
      value: "2 live projects in Ahmedabad with 420 apartments total",
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
      key: "configurations",
      value: "2 BHK and 3 BHK luxury configurations available",
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
      id: "fact-port-3",
      key: "price_range",
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
    {
      id: "fact-port-4",
      key: "compliance_notice",
      value: "RERA Reg: DEMO-ONLY-NOT-VERIFIED (All project details are for demonstration purposes only)",
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
      id: "fact-port-5",
      key: "locations",
      value: "Prakriti Heights on SG Highway and Vaastu Enclave in Shela",
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
      id: "fact-port-6",
      key: "amenities",
      value: "Clubhouse, landscaped gardens, 24/7 security, and covered parking",
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
    previousMessages?: unknown[];
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
        findMany: vi.fn().mockImplementation(() => Promise.resolve(options.previousMessages ?? [])),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ...data,
          })
        ),
      },
      factSheet: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          if (where?.projectId === "non_existent_project") {
            return Promise.resolve([]);
          }
          return Promise.resolve(
            verifiedFactsMock.map((f) => ({
              id: f.id,
              key: f.key,
              value: f.value,
              scope: f.scope,
              projectId: f.projectId,
            }))
          );
        }),
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

  it("A. Initial function call retrieves six facts; continuation returns valid factual text", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [
          {
            id: "call_turn1_123",
            name: "getVerifiedFacts",
            args: { scope: "PORTFOLIO" },
          },
        ],
        rawParts: [
          {
            functionCall: {
              id: "call_turn1_123",
              name: "getVerifiedFacts",
              args: { scope: "PORTFOLIO" },
            },
            thoughtSignature: "sig_crypto_valid_turn1",
          },
        ],
      } satisfies GeminiTurnResult),

      continueTurn: vi.fn().mockResolvedValue({
        text: "Here are the details for our 2 and 3 BHK luxury residences in Ahmedabad ranging from ₹65 lakh to ₹1.2 crore across 420 units.",
        toolCalls: undefined,
        rawParts: [
          {
            text: "Here are the details for our 2 and 3 BHK luxury residences in Ahmedabad ranging from ₹65 lakh to ₹1.2 crore across 420 units.",
            thoughtSignature: "sig_crypto_turn2_reply",
          },
        ],
      } satisfies GeminiTurnResult),
    };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    const result = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "What are the prices and configurations for 2 and 3 BHK?",
    });

    expect(mockGeminiClient.generate).toHaveBeenCalledTimes(1);
    expect(mockGeminiClient.continueTurn).toHaveBeenCalledTimes(1);

    // Verify response content contains the model factual text
    expect(result.aiMessage.content).toContain("420 units");
    expect(result.aiMessage.content).toContain("₹65 lakh to ₹1.2 crore");
    expect(result.aiMessage.content).not.toContain(
      "Thank you for contacting ENQUIVO. How can I assist you with our luxury residential properties today?"
    );

    // Verify all six grounding IDs are preserved
    expect(result.groundingFactIds).toHaveLength(6);
    expect(result.groundingFactIds).toEqual([
      "fact-port-1",
      "fact-port-2",
      "fact-port-3",
      "fact-port-4",
      "fact-port-5",
      "fact-port-6",
    ]);
  });

  it("B. Initial call retrieves six facts; second function call retrieves zero facts; continuation returns empty text", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    let continueRound = 0;
    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [
          {
            id: "call_init_portfolio",
            name: "getVerifiedFacts",
            args: { scope: "PORTFOLIO" },
          },
        ],
        rawParts: [
          {
            functionCall: {
              id: "call_init_portfolio",
              name: "getVerifiedFacts",
              args: { scope: "PORTFOLIO" },
            },
            thoughtSignature: "sig_round1",
          },
        ],
      }),

      continueTurn: vi.fn().mockImplementation(async () => {
        continueRound++;
        if (continueRound === 1) {
          // Round 2: Gemini asks for project-specific facts that return 0 rows in DB
          return {
            text: undefined,
            toolCalls: [
              {
                id: "call_empty_project",
                name: "getVerifiedFacts",
                args: { projectId: "non_existent_project" },
              },
            ],
            rawParts: [
              {
                functionCall: {
                  id: "call_empty_project",
                  name: "getVerifiedFacts",
                  args: { projectId: "non_existent_project" },
                },
                thoughtSignature: "sig_round2",
              },
            ],
          };
        }
        // Round 3: Gemini finishes with empty text
        return {
          text: "",
          toolCalls: undefined,
          rawParts: [],
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
      message: "Tell me about prices and configurations",
    });

    // Invariant: The deterministic response MUST use the accumulated 6 facts from round 1,
    // and NEVER emit the welcome greeting!
    expect(result.aiMessage.content).toContain("420 apartments total");
    expect(result.aiMessage.content).toContain("₹65 lakh to ₹1.2 crore");
    expect(result.aiMessage.content).toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
    expect(result.aiMessage.content).not.toContain(
      "Thank you for contacting ENQUIVO. How can I assist you with our luxury residential properties today?"
    );

    // Grounding IDs must preserve the 6 facts
    expect(result.groundingFactIds).toHaveLength(6);
  });

  it("C. Continuation returns whitespace only -> deterministic verified-facts fallback", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [
          {
            id: "call_whitespace_test",
            name: "getVerifiedFacts",
            args: { scope: "PORTFOLIO" },
          },
        ],
        rawParts: [
          {
            functionCall: {
              id: "call_whitespace_test",
              name: "getVerifiedFacts",
              args: { scope: "PORTFOLIO" },
            },
            thoughtSignature: "sig_ws_1",
          },
        ],
      }),

      continueTurn: vi.fn().mockResolvedValue({
        text: "   \n\t   ",
        toolCalls: undefined,
        rawParts: [{ text: "   \n\t   " }],
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
      message: "What are the apartment options?",
    });

    // Whitespace is treated as empty; service falls back to deterministic facts
    expect(result.aiMessage.content.trim()).not.toBe("");
    expect(result.aiMessage.content).toContain("420 apartments total");
    expect(result.aiMessage.content).not.toContain("Thank you for contacting ENQUIVO");
    expect(result.groundingFactIds).toHaveLength(6);
  });

  it("D. Continuation throws a transient rate-limit error after facts were retrieved -> deterministic fallback", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [
          {
            id: "call_rate_limit_test",
            name: "getVerifiedFacts",
            args: { scope: "PORTFOLIO" },
          },
        ],
        rawParts: [
          {
            functionCall: {
              id: "call_rate_limit_test",
              name: "getVerifiedFacts",
              args: { scope: "PORTFOLIO" },
            },
            thoughtSignature: "sig_rl_1",
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
      message: "Tell me about your residential developments",
    });

    // Gracefully returns deterministic fact response instead of failing or emitting welcome greeting
    expect(result.aiMessage.content).toContain("420 apartments total");
    expect(result.aiMessage.content).toContain("₹65 lakh to ₹1.2 crore");
    expect(result.aiMessage.content).toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
    expect(result.aiMessage.content).not.toContain("Thank you for contacting ENQUIVO");
    expect(result.groundingFactIds).toHaveLength(6);
  });

  it("E. Genuine conversational opening with no retrieved facts -> localized welcome greeting and zero grounding IDs", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: undefined,
        rawParts: [],
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
      message: "Hello",
    });

    // Genuine greeting returns localized welcome greeting
    expect(result.aiMessage.content).toBe(
      "Thank you for contacting ENQUIVO. How can I assist you with our luxury residential properties today?"
    );

    // Invariant: Zero grounding IDs may be attached under a generic greeting!
    expect(result.groundingFactIds).toEqual([]);
    expect(result.aiMessage.groundingFactIds).toEqual([]);
  });

  it("F. Verify original rawParts including thoughtSignature are passed to continueTurn unchanged", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    let receivedContents: GeminiConversationContent[] = [];

    const expectedSignature = "EmAKXgFpFH0TNHWo2ROVqp+aqOcnyB1PBPXyt6h3WmdFXC0Fr0qVMRCW+e0TaogX";

    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [
          {
            id: "call_signature_test_001",
            name: "getVerifiedFacts",
            args: { scope: "PORTFOLIO" },
          },
        ],
        rawParts: [
          {
            functionCall: {
              id: "call_signature_test_001",
              name: "getVerifiedFacts",
              args: { scope: "PORTFOLIO" },
            },
            thoughtSignature: expectedSignature,
          },
        ],
      }),

      continueTurn: vi.fn().mockImplementation(async (params) => {
        receivedContents = params.contents;
        return {
          text: "Verified residential specifications confirmed.",
          toolCalls: undefined,
        };
      }),
    };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    await aiService.sendMessage({
      conversationId: "conv-101",
      message: "Can you verify project details?",
    });

    // Inspect the model message in continueTurn contents
    const modelMessage = receivedContents.find((c) => c.role === "model");
    expect(modelMessage).toBeDefined();
    expect(modelMessage!.parts).toHaveLength(1);

    const modelPart = modelMessage!.parts[0];
    expect(modelPart.thoughtSignature).toBe(expectedSignature);
    expect(modelPart.functionCall?.id).toBe("call_signature_test_001");
    expect(modelPart.functionCall?.name).toBe("getVerifiedFacts");
  });

  it("G. persists and synchronizes selected language (HI/GU) across prompt and response", async () => {
    const mockDb = createMockPrisma({ language: ConversationLanguage.EN });
    const mockBookingService = {} as unknown as BookingService;

    let recordedSystemInstruction = "";
    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockImplementation(async (params) => {
        recordedSystemInstruction = params.systemInstruction;
        return {
          text: undefined,
          toolCalls: [{ name: "getVerifiedFacts", args: { scope: "PORTFOLIO" } }],
          rawParts: [
            {
              functionCall: { name: "getVerifiedFacts", args: { scope: "PORTFOLIO" } },
              thoughtSignature: "sig_hi",
            },
          ],
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

    const result = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "कीमतों के बारे में बताएं",
      language: ConversationLanguage.HI,
    });

    expect(mockDb.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-101" },
      data: { language: ConversationLanguage.HI },
    });

    expect(recordedSystemInstruction).toContain("हिन्दी");
    expect(result.aiMessage.content).toContain("अहमदाबाद में हमारे लक्जरी आवासीय प्रोजेक्ट्स");
    expect(result.aiMessage.content).toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
  });

  it("H. escalates to human sales executive on unlisted amenity inquiries", async () => {
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

  it("I. bounds multi-turn execution to MAX_TOOL_ROUNDS = 3 when model loops tool calls", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    let continueTurnCount = 0;
    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [{ name: "getVerifiedFacts", args: { scope: "PORTFOLIO" } }],
        rawParts: [
          {
            functionCall: { name: "getVerifiedFacts", args: { scope: "PORTFOLIO" } },
            thoughtSignature: "sig_loop_0",
          },
        ],
      }),

      continueTurn: vi.fn().mockImplementation(async () => {
        continueTurnCount++;
        return {
          text: undefined,
          toolCalls: [{ name: "getVerifiedFacts", args: { scope: "PORTFOLIO" } }],
          rawParts: [
            {
              functionCall: { name: "getVerifiedFacts", args: { scope: "PORTFOLIO" } },
              thoughtSignature: `sig_loop_${continueTurnCount}`,
            },
          ],
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

    expect(mockGeminiClient.generate).toHaveBeenCalledTimes(1);
    expect(continueTurnCount).toBe(2);

    expect(result.aiMessage.content).toContain("420 apartments total");
    expect(result.groundingFactIds.length).toBe(6);
  });

  it("J. deduplicates repeated facts in formatDeterministicFactResponse and emits compliance notice exactly once", () => {
    const aiService = new AIConciergeService(
      {} as unknown as PrismaClient,
      {} as unknown as BookingService,
      {} as unknown as GeminiClientInterface
    );

    const redundantFacts = [
      {
        id: "f1",
        key: "portfolio_overview",
        value: "ENQUIVO portfolio comprises 2 premier luxury residential developments in Ahmedabad featuring 420 premium 2 & 3 BHK apartments priced between ₹65 Lakh and ₹1.2 Crore.",
        scope: FactSheetScope.PORTFOLIO,
      },
      {
        id: "f2",
        key: "total_apartments",
        value: "420 apartments total across both projects in Ahmedabad.",
        scope: FactSheetScope.PORTFOLIO,
      },
      {
        id: "f3",
        key: "rera_compliance",
        value: "RERA Reg: DEMO-ONLY-NOT-VERIFIED (All project details are for demonstration purposes only).",
        scope: FactSheetScope.PORTFOLIO,
      },
      {
        id: "f4",
        key: "location",
        value: "Strategically located in prime high-growth corridors of Ahmedabad, Gujarat.",
        scope: FactSheetScope.PORTFOLIO,
      },
    ];

    const response = aiService.formatDeterministicFactResponse(redundantFacts, ConversationLanguage.EN);

    // 1. RERA disclaimer must appear exactly once (as the compliance footer)
    const reraOccurrences = (response.match(/RERA Reg: DEMO-ONLY-NOT-VERIFIED/g) || []).length;
    expect(reraOccurrences).toBe(1);

    // 2. Standalone redundant "420 apartments total" is omitted when portfolio_overview already specifies it
    expect(response).not.toContain("• 420 apartments total across both projects in Ahmedabad.");
    expect(response).toContain("ENQUIVO portfolio comprises 2 premier luxury residential developments");
    expect(response).toContain("Strategically located in prime high-growth corridors");
  });

  it("K. explains WHY AI cannot answer and names sales executive when project-specific pricing is unavailable", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [
          {
            name: "handoffToExecutive",
            args: {
              escalationReason: "MISSING_PROJECT_INFO",
              summary: "Buyer asked for exact 2 and 3 BHK pricing for Prakriti Heights",
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
      message: "Tell me only about Prakriti Heights. What are its exact 2 BHK and 3 BHK prices?",
    });

    expect(result.handoffCreated).toBe(true);
    expect(result.handoff).not.toBeNull();
    // Explains why the AI cannot answer
    expect(result.aiMessage.content).toContain(
      "Exact 2 BHK and 3 BHK prices for Prakriti Heights are not available in our verified developer facts."
    );
    // Names sales executive
    expect(result.aiMessage.content).toContain("Vikram Mehta");
    expect(result.aiMessage.content).toContain("They have received your conversation summary and will reach out to assist you.");
    // Invariant: Pure handoff has zero grounding facts
    expect(result.groundingFactIds).toEqual([]);
    expect(result.aiMessage.groundingFactIds).toEqual([]);
  });

  it("L. retains groundingFactIds for genuine factual answers, but sets empty array for pure handoffs", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    // Factual turn
    const mockFactualGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [{ name: "getVerifiedFacts", args: { scope: "PORTFOLIO" } }],
      }),
      continueTurn: vi.fn().mockResolvedValue({
        text: "Here are the verified details for our luxury residential developments in Ahmedabad.",
        toolCalls: undefined,
      }),
    };

    const factualService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockFactualGeminiClient,
      true
    );

    const factualResult = await factualService.sendMessage({
      conversationId: "conv-101",
      message: "What are the configurations and prices?",
    });

    expect(factualResult.handoffCreated).toBe(false);
    expect(factualResult.groundingFactIds.length).toBe(6);
    expect(factualResult.aiMessage.groundingFactIds.length).toBe(6);
  });

  it("M. localizes handoff explanations in Hindi and Gujarati authentically", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;

    const mockHandoffGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [
          {
            name: "handoffToExecutive",
            args: {
              escalationReason: "MISSING_PROJECT_INFO",
              summary: "Buyer asked for exact 2 and 3 BHK pricing for Prakriti Heights in Hindi",
            },
          },
        ],
      }),
    };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockHandoffGeminiClient,
      true
    );

    // Hindi test
    const hiResult = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "प्रकृति हाइट्स की सटीक 2 BHK और 3 BHK कीमतें क्या हैं?",
      language: ConversationLanguage.HI,
    });

    expect(hiResult.handoffCreated).toBe(true);
    expect(hiResult.aiMessage.content).toContain(
      "प्रकृति हाइट्स के लिए 2 BHK और 3 BHK की सटीक कीमतें हमारे सत्यापित डेवलपर विवरण में उपलब्ध नहीं हैं।"
    );
    expect(hiResult.aiMessage.content).toContain("Vikram Mehta");
    expect(hiResult.groundingFactIds).toEqual([]);

    // Gujarati test
    const guResult = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "પ્રકૃતિ હાઇટ્સના 2 BHK અને 3 BHK ના ભાવ શું છે?",
      language: ConversationLanguage.GU,
    });

    expect(guResult.handoffCreated).toBe(true);
    expect(guResult.aiMessage.content).toContain(
      "પ્રકૃતિ હાઇટ્સ માટે 2 BHK અને 3 BHK ના ચોક્કસ ભાવો અમારી ચકાસાયેલ ડેવલપર વિગતોમાં ઉપલબ્ધ નથી."
    );
    expect(guResult.aiMessage.content).toContain("Vikram Mehta");
    expect(guResult.groundingFactIds).toEqual([]);
  });

  it("N. Initial buyer greeting -> welcome response", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;
    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: undefined,
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
      message: "Hello",
    });

    expect(result.aiMessage.content).toBe(
      "Thank you for contacting ENQUIVO. How can I assist you with our luxury residential properties today?"
    );
    expect(result.groundingFactIds).toEqual([]);
    expect(result.handoffCreated).toBe(false);
  });

  it("O. Buyer asks price -> assistant answers and offers site visit or sales handoff", async () => {
    const mockDb = createMockPrisma();
    const mockBookingService = {} as unknown as BookingService;
    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [{ name: "getVerifiedFacts", args: { scope: "PORTFOLIO" } }],
      }),
      continueTurn: vi.fn().mockResolvedValue({
        text: undefined, // fallback triggers formatDeterministicFactResponse
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
      message: "What are the prices and configurations for 2 and 3 BHK?",
    });

    expect(result.aiMessage.content).toContain("2 BHK and 3 BHK luxury configurations");
    expect(result.aiMessage.content).toContain(
      "Would you like me to check upcoming available slots for your site visit, or connect you with our sales executive?"
    );
    expect(result.groundingFactIds.length).toBeGreaterThan(0);
  });

  it("P. Buyer says 'yes I would' -> assistant asks which option they prefer", async () => {
    const previousMessages = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "What are the prices and configurations for 2 and 3 BHK?",
        createdAt: new Date(Date.now() - 60000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content:
          "Here are the verified details for our luxury residential developments in Ahmedabad:\n\n• 420 apartments total across both projects in Ahmedabad.\n\nRERA Reg: DEMO-ONLY-NOT-VERIFIED (All project details are for demonstration purposes only).\n\nWould you like me to check upcoming available slots for your site visit, or connect you with our sales executive?",
        createdAt: new Date(Date.now() - 30000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages });
    const mockBookingService = {} as unknown as BookingService;
    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: "Thank you for contacting ENQUIVO. How can I assist you with our luxury residential properties today?",
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
      message: "yes I would",
    });

    expect(result.aiMessage.content).toBe(
      "Certainly! Would you prefer to schedule a site visit or speak directly with a sales executive?"
    );
  });

  it("Q. Ambiguous affirmative does not create a booking or handoff", async () => {
    const previousMessages = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "What are the prices and configurations for 2 and 3 BHK?",
        createdAt: new Date(Date.now() - 60000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content:
          "Would you like me to check upcoming available slots for your site visit, or connect you with our sales executive?",
        createdAt: new Date(Date.now() - 30000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages });
    const bookVisitSpy = vi.fn();
    const mockBookingService = { bookVisit: bookVisitSpy } as unknown as BookingService;
    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn(),
    };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    const result = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "sure, I would",
    });

    expect(result.handoffCreated).toBe(false);
    expect(result.handoff).toBeNull();
    expect(bookVisitSpy).not.toHaveBeenCalled();
    expect(result.groundingFactIds).toEqual([]);
    expect(result.aiMessage.content).toBe(
      "Certainly! Would you prefer to schedule a site visit or speak directly with a sales executive?"
    );
  });

  it("R. Buyer says 'I want to speak to a sales executive' -> existing handoff flow works", async () => {
    const previousMessages = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "yes I would",
        createdAt: new Date(Date.now() - 60000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content:
          "Certainly! Would you prefer to schedule a site visit or speak directly with a sales executive?",
        createdAt: new Date(Date.now() - 30000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages });
    const mockBookingService = {} as unknown as BookingService;
    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [
          {
            name: "handoffToExecutive",
            args: {
              escalationReason: "BUYER_REQUESTED",
              summary: "Buyer requested to speak directly with a sales executive",
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
      message: "I want to speak to a sales executive",
    });

    expect(result.handoffCreated).toBe(true);
    expect(result.handoff?.escalationReason).toBe("BUYER_REQUESTED");
    expect(result.aiMessage.content).toContain("Vikram Mehta");
  });

  it("S. Buyer says 'I want to schedule a site visit' -> existing booking flow continues correctly", async () => {
    const previousMessages = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "yes I would",
        createdAt: new Date(Date.now() - 60000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content:
          "Certainly! Would you prefer to schedule a site visit or speak directly with a sales executive?",
        createdAt: new Date(Date.now() - 30000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages });
    const getAvailableSlotsSpy = vi.fn().mockResolvedValue([
      {
        id: "slot-1",
        startsAt: new Date("2026-11-15T10:00:00Z"),
        location: "Prakriti Heights Site Office, SG Highway",
      },
    ]);
    const mockBookingService = { getAvailableSlots: getAvailableSlotsSpy } as unknown as BookingService;

    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [
          {
            name: "checkSlotAvailability",
            args: {},
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
      message: "I want to schedule a site visit",
    });

    expect(getAvailableSlotsSpy).toHaveBeenCalled();
    expect(result.handoffCreated).toBe(false);
    expect(result.aiMessage.content).toContain("upcoming available slots for your site visit");
  });

  it("G. Follow-up with empty Gemini text never returns the generic initial welcome greeting", async () => {
    const previousMessages = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "Can you tell me about Prakriti Heights?",
        createdAt: new Date(Date.now() - 60000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content: "Prakriti Heights is located on SG Highway.",
        createdAt: new Date(Date.now() - 30000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages });
    const mockBookingService = {} as unknown as BookingService;
    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: "", // Empty model response on follow-up
        toolCalls: undefined,
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
      message: "Tell me more about it",
    });

    expect(result.aiMessage.content).not.toContain("Thank you for contacting ENQUIVO. How can I assist you with our luxury residential properties today?");
    expect(result.aiMessage.content).toBe(
      "Could you please clarify how you would like to proceed? I can help you check site visit availability, connect you with our sales team, or answer questions about our properties."
    );
  });

  it("U. Second consecutive ambiguous affirmative -> numbered choices without RERA disclaimer", async () => {
    const previousMessages = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "What are the prices and configurations?",
        createdAt: new Date(Date.now() - 90000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content:
          "Would you like me to check upcoming available slots for your site visit, or connect you with our sales executive?",
        createdAt: new Date(Date.now() - 60000),
      },
      {
        id: "msg-3",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "yes I would",
        createdAt: new Date(Date.now() - 40000),
      },
      {
        id: "msg-4",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content:
          "Certainly! Would you prefer to schedule a site visit or speak directly with a sales executive?",
        createdAt: new Date(Date.now() - 20000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages });
    const bookVisitSpy = vi.fn();
    const mockBookingService = { bookVisit: bookVisitSpy } as unknown as BookingService;
    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn(),
    };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    const result = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "yes",
    });

    expect(result.handoffCreated).toBe(false);
    expect(result.handoff).toBeNull();
    expect(bookVisitSpy).not.toHaveBeenCalled();
    expect(result.groundingFactIds).toEqual([]);
    expect(result.aiMessage.content).toBe(
      "Please choose one option so I can help you:\n1. Schedule a site visit\n2. Speak with a sales executive"
    );
    expect(result.aiMessage.content).not.toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
  });

  it("V. Second consecutive ambiguous affirmative localized in Hindi and Gujarati without RERA disclaimer", async () => {
    const previousMessagesHI = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "हाँ",
        createdAt: new Date(Date.now() - 40000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content:
          "ज़रूर! क्या आप साइट विज़िट निर्धारित करना पसंद करेंगे या बिक्री कार्यकारी से सीधे बात करना चाहेंगे?",
        createdAt: new Date(Date.now() - 20000),
      },
    ];

    const mockDbHI = createMockPrisma({ previousMessages: previousMessagesHI, language: ConversationLanguage.HI });
    const mockBookingService = {} as unknown as BookingService;
    const mockGeminiClient: GeminiClientInterface = { generate: vi.fn() };

    const aiServiceHI = new AIConciergeService(
      mockDbHI as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    const resultHI = await aiServiceHI.sendMessage({
      conversationId: "conv-101",
      message: "हाँ जी",
      language: ConversationLanguage.HI,
    });

    expect(resultHI.handoffCreated).toBe(false);
    expect(resultHI.aiMessage.content).toBe(
      "कृपया एक विकल्प चुनें ताकि मैं आपकी सहायता कर सकूँ:\n1. साइट विज़िट निर्धारित करें\n2. बिक्री कार्यकारी से बात करें"
    );
    expect(resultHI.aiMessage.content).not.toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");

    // Gujarati test
    const previousMessagesGU = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "હા",
        createdAt: new Date(Date.now() - 40000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content:
          "ચોક્કસ! શું તમે સાઇટ મુલાકાત શેડ્યૂલ કરવાનું પસંદ કરશો કે સેલ્સ એક્ઝિક્યુટિવ સાથે સીધી વાત કરવા માંગો છો?",
        createdAt: new Date(Date.now() - 20000),
      },
    ];

    const mockDbGU = createMockPrisma({ previousMessages: previousMessagesGU, language: ConversationLanguage.GU });
    const aiServiceGU = new AIConciergeService(
      mockDbGU as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    const resultGU = await aiServiceGU.sendMessage({
      conversationId: "conv-101",
      message: "હા",
      language: ConversationLanguage.GU,
    });

    expect(resultGU.handoffCreated).toBe(false);
    expect(resultGU.aiMessage.content).toBe(
      "કૃપા કરીને એક વિકલ્પ પસંદ કરો જેથી હું તમારી સહાય કરી શકું:\n1. સાઇટ મુલાકાત શેડ્યૂલ કરો\n2. સેલ્સ એક્ઝિક્યુટિવ સાથે વાત કરો"
    );
    expect(resultGU.aiMessage.content).not.toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
  });

  it("W. Pure clarification messages do not append RERA disclaimer, while verified property fact responses retain it", async () => {
    const mockDb = createMockPrisma({
      previousMessages: [
        {
          id: "msg-1",
          conversationId: "conv-101",
          role: ChatMessageRole.USER,
          content: "What are the prices and configurations?",
          createdAt: new Date(Date.now() - 40000),
        },
        {
          id: "msg-2",
          conversationId: "conv-101",
          role: ChatMessageRole.AI,
          content:
            "Would you like me to check upcoming available slots for your site visit, or connect you with our sales executive?",
          createdAt: new Date(Date.now() - 20000),
        },
      ],
    });

    const mockBookingService = {} as unknown as BookingService;
    const mockGeminiClient: GeminiClientInterface = { generate: vi.fn() };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    // 1. First ambiguous affirmative clarification: NO RERA disclaimer
    const firstClarification = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "yes I would",
    });
    expect(firstClarification.aiMessage.content).toBe(
      "Certainly! Would you prefer to schedule a site visit or speak directly with a sales executive?"
    );
    expect(firstClarification.aiMessage.content).not.toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
    expect(firstClarification.groundingFactIds).toEqual([]);

    // 2. Verified factual response: DOES contain RERA disclaimer
    const mockDbFacts = createMockPrisma();
    const mockGeminiFacts: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: undefined,
        toolCalls: [{ name: "getVerifiedFacts", args: { scope: "PORTFOLIO" } }],
      }),
      continueTurn: vi.fn().mockResolvedValue({
        text: undefined, // triggers deterministic fact response
      }),
    };
    const aiServiceFacts = new AIConciergeService(
      mockDbFacts as unknown as PrismaClient,
      mockBookingService,
      mockGeminiFacts,
      true
    );

    const factualResponse = await aiServiceFacts.sendMessage({
      conversationId: "conv-101",
      message: "What are the prices?",
    });

    expect(factualResponse.aiMessage.content).toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
    expect(factualResponse.groundingFactIds.length).toBeGreaterThan(0);
  });

  it("X. Buyer replies '1' or '1.' after numbered disambiguation prompt -> initiates booking availability flow, lists slots, does NOT create booking or handoff", async () => {
    const previousMessages = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "yes I would",
        createdAt: new Date(Date.now() - 40000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content:
          "Please choose one option so I can help you:\n1. Schedule a site visit\n2. Speak with a sales executive",
        createdAt: new Date(Date.now() - 20000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages });
    const mockBookVisit = vi.fn();
    const mockBookingService = {
      getAvailableSlots: vi.fn().mockResolvedValue([
        {
          id: "slot-preview-1",
          startsAt: new Date("2026-11-15T10:00:00Z"),
          endsAt: new Date("2026-11-15T11:00:00Z"),
          status: "AVAILABLE",
          location: "Site Office, Ahmedabad",
          projectId: "p1",
        },
      ]),
      bookVisit: mockBookVisit,
    } as unknown as BookingService;

    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn(),
    };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    // Test with "1"
    const result1 = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "1",
    });

    expect(mockBookingService.getAvailableSlots).toHaveBeenCalled();
    expect(mockBookVisit).not.toHaveBeenCalled();
    expect(result1.handoffCreated).toBe(false);
    expect(result1.handoff).toBeNull();
    expect(result1.aiMessage.content).toContain("Here are our upcoming available slots for your site visit");
    expect(result1.aiMessage.content).toContain("slot-preview-1");
    expect(result1.aiMessage.content).toContain("Please let me know which time works best for you");
    expect(result1.aiMessage.content).not.toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
    expect(result1.groundingFactIds).toEqual([]);
    expect(mockGeminiClient.generate).not.toHaveBeenCalled();

    // Test with "1."
    const result1Dot = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "1.",
    });
    expect(result1Dot.handoffCreated).toBe(false);
    expect(result1Dot.aiMessage.content).toContain("slot-preview-1");
  });

  it("Y. Buyer replies '2' or '2.' after numbered disambiguation prompt -> initiates sales handoff to Vikram Mehta with BUYER_REQUESTED, avoids duplicate handoff", async () => {
    const previousMessages = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "yes I would",
        createdAt: new Date(Date.now() - 40000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content:
          "Please choose one option so I can help you:\n1. Schedule a site visit\n2. Speak with a sales executive",
        createdAt: new Date(Date.now() - 20000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages });
    const mockBookingService = {} as unknown as BookingService;
    const mockGeminiClient: GeminiClientInterface = { generate: vi.fn() };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    // 1. First reply "2": Creates handoff
    const result2 = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "2",
    });

    expect(result2.handoffCreated).toBe(true);
    expect(result2.handoff).not.toBeNull();
    expect(result2.handoff?.escalationReason).toBe(EscalationReason.BUYER_REQUESTED);
    expect(result2.aiMessage.content).toContain("Vikram Mehta");
    expect(result2.aiMessage.content).toContain("I have connected you directly with Vikram Mehta as requested.");
    expect(result2.aiMessage.content).not.toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
    expect(result2.groundingFactIds).toEqual([]);
    expect(mockDb.handoff.create).toHaveBeenCalledTimes(1);

    // 2. Second reply "2." when handoff already exists: Reuses handoff without creating duplicate
    mockDb.handoff.findUnique = vi.fn().mockResolvedValue(result2.handoff);
    const result2Dot = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "2.",
    });

    expect(result2Dot.handoffCreated).toBe(true);
    expect(result2Dot.handoff?.id).toBe(result2.handoff?.id);
    expect(mockDb.handoff.create).toHaveBeenCalledTimes(1); // not called again
  });

  it("Z. Standalone numbers like '2' or '2 BHK' sent when previous message was NOT numbered prompt are NOT hijacked and pass to Gemini", async () => {
    const previousMessages = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "What configurations do you offer?",
        createdAt: new Date(Date.now() - 40000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content: "We offer 2 and 3 BHK luxury residences across our projects in Ahmedabad. Which one interests you?",
        createdAt: new Date(Date.now() - 20000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages });
    const mockBookingService = { getAvailableSlots: vi.fn() } as unknown as BookingService;

    const mockGeminiClient: GeminiClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: "Our 2 BHK residences feature spacious layouts with premium finishes.",
        toolCalls: undefined,
      }),
    };

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      mockGeminiClient,
      true
    );

    // Standalone "2" in response to "Which one interests you?"
    const result = await aiService.sendMessage({
      conversationId: "conv-101",
      message: "2",
    });

    // Must NOT be intercepted as Option 2 sales handoff!
    expect(result.handoffCreated).toBe(false);
    expect(result.handoff).toBeNull();
    expect(mockGeminiClient.generate).toHaveBeenCalledWith(
      expect.objectContaining({ userMessage: "2" })
    );
    expect(result.aiMessage.content).toContain("Our 2 BHK residences feature spacious layouts");

    // "2 BHK" must also not be hijacked
    await aiService.sendMessage({
      conversationId: "conv-101",
      message: "2 BHK",
    });
    expect(mockGeminiClient.generate).toHaveBeenCalledWith(
      expect.objectContaining({ userMessage: "2 BHK" })
    );
  });

  it("AA. Multilingual numbered choices support Hindi ('१', '२') and Gujarati ('૧', '૨')", async () => {
    // Hindi test
    const previousMessagesHI = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "हाँ",
        createdAt: new Date(Date.now() - 40000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content:
          "कृपया एक विकल्प चुनें ताकि मैं आपकी सहायता कर सकूँ:\n1. साइट विज़िट निर्धारित करें\n2. बिक्री कार्यकारी से बात करें",
        createdAt: new Date(Date.now() - 20000),
      },
    ];

    const mockDbHI = createMockPrisma({ previousMessages: previousMessagesHI, language: ConversationLanguage.HI });
    const mockBookingServiceHI = {
      getAvailableSlots: vi.fn().mockResolvedValue([
        {
          id: "slot-hi-1",
          startsAt: new Date("2026-11-15T10:00:00Z"),
          endsAt: new Date("2026-11-15T11:00:00Z"),
          status: "AVAILABLE",
          location: "Site Office, Ahmedabad",
          projectId: "p1",
        },
      ]),
      bookVisit: vi.fn(),
    } as unknown as BookingService;

    const mockGeminiClientHI: GeminiClientInterface = { generate: vi.fn() };
    const aiServiceHI = new AIConciergeService(
      mockDbHI as unknown as PrismaClient,
      mockBookingServiceHI,
      mockGeminiClientHI,
      true
    );

    // Hindi Option 1 ("१")
    const resultHI1 = await aiServiceHI.sendMessage({
      conversationId: "conv-101",
      message: "१",
      language: ConversationLanguage.HI,
    });
    expect(resultHI1.handoffCreated).toBe(false);
    expect(resultHI1.aiMessage.content).toContain("आपकी साइट विज़िट के लिए आगामी उपलब्ध स्लॉट यहाँ हैं");
    expect(resultHI1.aiMessage.content).toContain("slot-hi-1");

    // Hindi Option 2 ("२")
    const resultHI2 = await aiServiceHI.sendMessage({
      conversationId: "conv-101",
      message: "२",
      language: ConversationLanguage.HI,
    });
    expect(resultHI2.handoffCreated).toBe(true);
    expect(resultHI2.aiMessage.content).toContain("Vikram Mehta");
    expect(resultHI2.aiMessage.content).toContain("आपके अनुरोध के अनुसार मैंने आपको सीधे Vikram Mehta से जोड़ दिया है।");

    // Gujarati test
    const previousMessagesGU = [
      {
        id: "msg-1",
        conversationId: "conv-101",
        role: ChatMessageRole.USER,
        content: "હા",
        createdAt: new Date(Date.now() - 40000),
      },
      {
        id: "msg-2",
        conversationId: "conv-101",
        role: ChatMessageRole.AI,
        content:
          "કૃપા કરીને એક વિકલ્પ પસંદ કરો જેથી હું તમારી સહાય કરી શકું:\n1. સાઇટ મુલાકાત શેડ્યૂલ કરો\n2. સેલ્સ એક્ઝિક્યુટિવ સાથે વાત કરો",
        createdAt: new Date(Date.now() - 20000),
      },
    ];

    const mockDbGU = createMockPrisma({ previousMessages: previousMessagesGU, language: ConversationLanguage.GU });
    const mockBookingServiceGU = {
      getAvailableSlots: vi.fn().mockResolvedValue([
        {
          id: "slot-gu-1",
          startsAt: new Date("2026-11-15T10:00:00Z"),
          endsAt: new Date("2026-11-15T11:00:00Z"),
          status: "AVAILABLE",
          location: "Site Office, Ahmedabad",
          projectId: "p1",
        },
      ]),
      bookVisit: vi.fn(),
    } as unknown as BookingService;

    const mockGeminiClientGU: GeminiClientInterface = { generate: vi.fn() };
    const aiServiceGU = new AIConciergeService(
      mockDbGU as unknown as PrismaClient,
      mockBookingServiceGU,
      mockGeminiClientGU,
      true
    );

    // Gujarati Option 1 ("૧")
    const resultGU1 = await aiServiceGU.sendMessage({
      conversationId: "conv-101",
      message: "૧",
      language: ConversationLanguage.GU,
    });
    expect(resultGU1.handoffCreated).toBe(false);
    expect(resultGU1.aiMessage.content).toContain("તમારી સાઇટ મુલાકાત માટે ઉપલબ્ધ સ્લોટ્સ અહીં છે");
    expect(resultGU1.aiMessage.content).toContain("slot-gu-1");

    // Gujarati Option 2 ("૨")
    const resultGU2 = await aiServiceGU.sendMessage({
      conversationId: "conv-101",
      message: "૨",
      language: ConversationLanguage.GU,
    });
    expect(resultGU2.handoffCreated).toBe(true);
    expect(resultGU2.aiMessage.content).toContain("Vikram Mehta");
    expect(resultGU2.aiMessage.content).toContain("તમારી વિનંતી અનુસાર મેં તમને સીધા Vikram Mehta સાથે જોડ્યા છે.");
  });
});
