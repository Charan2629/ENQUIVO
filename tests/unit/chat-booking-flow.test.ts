import { describe, it, expect, vi } from "vitest";
import {
  ChatMessageRole,
  ConversationLanguage,
  EscalationReason,
  UserRole,
  Prisma,
  PrismaClient,
  VisitSlot,
  BookingStatus,
  AttendanceOutcome,
  ReminderType,
  ReminderStatus,
} from "@prisma/client";
import { AIConciergeService } from "../../src/services/ai/ai.service";
import { BookingService, SlotUnavailableError } from "../../src/services/booking/booking.service";

describe("Chat-Based Site Visit Booking Flow (End-to-End Unit & Integration Tests)", () => {
  const prakritiSlot1: VisitSlot = {
    id: "slot-ph-001",
    startsAt: new Date("2026-11-15T04:30:00.000Z"), // 10:00 AM IST
    endsAt: new Date("2026-11-15T05:30:00.000Z"), // 11:00 AM IST
    status: "AVAILABLE",
    location: "Prakriti Heights Experience Gallery, SG Highway, Ahmedabad",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prakritiSlot2: VisitSlot = {
    id: "slot-ph-002",
    startsAt: new Date("2026-11-15T08:30:00.000Z"), // 02:00 PM IST
    endsAt: new Date("2026-11-15T09:30:00.000Z"), // 03:00 PM IST
    status: "AVAILABLE",
    location: "Prakriti Heights Experience Gallery, SG Highway, Ahmedabad",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const vaastuSlot1: VisitSlot = {
    id: "slot-ve-001",
    startsAt: new Date("2026-11-16T05:30:00.000Z"), // 11:00 AM IST
    endsAt: new Date("2026-11-16T06:30:00.000Z"), // 12:00 PM IST
    status: "AVAILABLE",
    location: "Vaastu Enclave Site Office, Shela, Ahmedabad",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function createMockPrisma(options: {
    language?: ConversationLanguage;
    previousMessages?: Array<{ id: string; conversationId: string; role: ChatMessageRole; content: string; createdAt: Date }>;
    leadProject?: { id?: string; name: string } | null;
  } = {}) {
    const lang = options.language ?? ConversationLanguage.EN;
    return {
      conversation: {
        findUnique: vi.fn().mockResolvedValue({
          id: "conv-test-1",
          leadId: "lead-test-1",
          language: lang,
          lead: {
            id: "lead-test-1",
            name: "Hardik Patel",
            projectId: options.leadProject ? options.leadProject.id ?? "proj-1" : null,
            project: options.leadProject ?? null,
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
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockImplementation(() => Promise.resolve(options.previousMessages ?? [])),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ...data,
          })
        ),
      },
      factSheet: {
        findMany: vi.fn().mockResolvedValue([]),
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
            id: "handoff-test-1",
            ...data,
            assignedTo: { id: "exec-1", name: "Vikram Mehta" },
          })
        ),
      },
      lead: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
  }

  // --- REQUIREMENT A & B: Full Conversational Flow & Single Booking Execution ---
  it("A & B. Complete 3-turn conversational booking flow with textual slot selection", async () => {
    // Turn 1: "I want to schedule a site visit."
    const mockDbTurn1 = createMockPrisma();
    const mockBookingServiceTurn1 = {
      getAvailableSlots: vi.fn(),
      bookVisit: vi.fn(),
    } as unknown as BookingService;

    const aiTurn1 = new AIConciergeService(
      mockDbTurn1 as unknown as PrismaClient,
      mockBookingServiceTurn1,
      { generate: vi.fn() },
      true
    );

    const turn1Result = await aiTurn1.sendMessage({
      conversationId: "conv-test-1",
      message: "I want to schedule a site visit.",
    });

    expect(turn1Result.handoffCreated).toBe(false);
    expect(mockBookingServiceTurn1.bookVisit).not.toHaveBeenCalled();
    expect(turn1Result.aiMessage.content).toContain("Which project would you like to visit?");
    expect(turn1Result.aiMessage.content).toContain("1. Prakriti Heights (SG Highway)");
    expect(turn1Result.aiMessage.content).toContain("2. Vaastu Enclave (Shela)");

    // Turn 2: "1" (Selecting Prakriti Heights)
    const turn2History = [
      {
        id: "msg-1",
        conversationId: "conv-test-1",
        role: ChatMessageRole.USER,
        content: "I want to schedule a site visit.",
        createdAt: new Date(Date.now() - 30000),
      },
      {
        id: "msg-2",
        conversationId: "conv-test-1",
        role: ChatMessageRole.AI,
        content: turn1Result.aiMessage.content,
        createdAt: new Date(Date.now() - 20000),
      },
    ];

    const mockDbTurn2 = createMockPrisma({ previousMessages: turn2History });
    const mockBookingServiceTurn2 = {
      getAvailableSlots: vi.fn().mockResolvedValue([prakritiSlot1, prakritiSlot2]),
      bookVisit: vi.fn(),
    } as unknown as BookingService;

    const aiTurn2 = new AIConciergeService(
      mockDbTurn2 as unknown as PrismaClient,
      mockBookingServiceTurn2,
      { generate: vi.fn() },
      true
    );

    const turn2Result = await aiTurn2.sendMessage({
      conversationId: "conv-test-1",
      message: "1",
    });

    expect(turn2Result.handoffCreated).toBe(false);
    expect(mockBookingServiceTurn2.bookVisit).not.toHaveBeenCalled();
    expect(turn2Result.aiMessage.content).toContain("upcoming available slots for your site visit to Prakriti Heights:");
    expect(turn2Result.aiMessage.content).toContain("slot-ph-001");
    expect(turn2Result.aiMessage.content).toContain("15 Nov 2026, 10:00 AM IST");
    expect(turn2Result.aiMessage.content).toContain("Please let me know which time works best for you so I can confirm it!");

    // Turn 3: "15 Nov 2026, 10:00 AM IST" (Natural language slot selection)
    const turn3History = [
      ...turn2History,
      {
        id: "msg-3",
        conversationId: "conv-test-1",
        role: ChatMessageRole.USER,
        content: "1",
        createdAt: new Date(Date.now() - 15000),
      },
      {
        id: "msg-4",
        conversationId: "conv-test-1",
        role: ChatMessageRole.AI,
        content: turn2Result.aiMessage.content,
        createdAt: new Date(Date.now() - 10000),
      },
    ];

    const mockDbTurn3 = createMockPrisma({ previousMessages: turn3History });
    const mockBookVisit = vi.fn().mockResolvedValue({
      visit: {
        id: "visit-123",
        slotId: prakritiSlot1.id,
        leadId: "lead-test-1",
        bookingStatus: BookingStatus.CONFIRMED,
        attendanceOutcome: AttendanceOutcome.UNRECORDED,
        bookedAt: new Date(),
      },
      slot: prakritiSlot1,
    });

    const mockBookingServiceTurn3 = {
      getAvailableSlots: vi.fn().mockResolvedValue([prakritiSlot1, prakritiSlot2]),
      bookVisit: mockBookVisit,
    } as unknown as BookingService;

    const aiTurn3 = new AIConciergeService(
      mockDbTurn3 as unknown as PrismaClient,
      mockBookingServiceTurn3,
      { generate: vi.fn() },
      true
    );

    const turn3Result = await aiTurn3.sendMessage({
      conversationId: "conv-test-1",
      message: "15 Nov 2026, 10:00 AM IST",
    });

    // Validations for B:
    expect(mockBookVisit).toHaveBeenCalledTimes(1);
    expect(mockBookVisit).toHaveBeenCalledWith({
      slotId: prakritiSlot1.id,
      leadId: "lead-test-1",
    });

    expect(turn3Result.handoffCreated).toBe(false);
    expect(turn3Result.aiMessage.content).toContain("Your site visit to Prakriti Heights has been confirmed");
    expect(turn3Result.aiMessage.content).toContain("Sunday, 15 November 2026 at 10:00 AM IST");
    expect(turn3Result.aiMessage.content).toContain("Prakriti Heights Experience Gallery, SG Highway, Ahmedabad");
  });

  // --- REQUIREMENT C: Slot ID Selection ---
  it("C. Selecting a slot directly by slot ID confirms the booking", async () => {
    const slotPromptHistory = [
      {
        id: "msg-1",
        conversationId: "conv-test-1",
        role: ChatMessageRole.AI,
        content: `Here are our upcoming available slots for your site visit to Prakriti Heights:\n• 15 Nov 2026, 10:00 AM IST (ID: slot-ph-001)\n• 15 Nov 2026, 02:00 PM IST (ID: slot-ph-002)\n\nPlease let me know which time works best for you so I can confirm it!`,
        createdAt: new Date(Date.now() - 10000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages: slotPromptHistory });
    const mockBookVisit = vi.fn().mockResolvedValue({
      visit: { id: "visit-456", slotId: prakritiSlot2.id },
      slot: prakritiSlot2,
    });

    const mockBookingService = {
      getAvailableSlots: vi.fn().mockResolvedValue([prakritiSlot1, prakritiSlot2]),
      bookVisit: mockBookVisit,
    } as unknown as BookingService;

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      { generate: vi.fn() },
      true
    );

    const result = await aiService.sendMessage({
      conversationId: "conv-test-1",
      message: "Please book slot-ph-002",
    });

    expect(mockBookVisit).toHaveBeenCalledTimes(1);
    expect(mockBookVisit).toHaveBeenCalledWith({
      slotId: "slot-ph-002",
      leadId: "lead-test-1",
    });
    expect(result.aiMessage.content).toContain("Your site visit to Prakriti Heights has been confirmed");
    expect(result.aiMessage.content).toContain("02:00 PM IST");
  });

  // --- REQUIREMENT D: Cross-Project Slot Rejection ---
  it("D. Selecting a slot for another project is rejected and does not book", async () => {
    const slotPromptHistory = [
      {
        id: "msg-1",
        conversationId: "conv-test-1",
        role: ChatMessageRole.AI,
        content: `Here are our upcoming available slots for your site visit to Prakriti Heights:\n• 15 Nov 2026, 10:00 AM IST (ID: slot-ph-001)\n\nPlease let me know which time works best for you so I can confirm it!`,
        createdAt: new Date(Date.now() - 10000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages: slotPromptHistory });
    const mockBookVisit = vi.fn();
    // getAvailableSlots returns both projects, but the filter isolates Prakriti Heights
    const mockBookingService = {
      getAvailableSlots: vi.fn().mockResolvedValue([prakritiSlot1, vaastuSlot1]),
      bookVisit: mockBookVisit,
    } as unknown as BookingService;

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      { generate: vi.fn() },
      true
    );

    // Buyer provides Vaastu Enclave slot ID
    const result = await aiService.sendMessage({
      conversationId: "conv-test-1",
      message: "Can you book slot-ve-001?",
    });

    expect(mockBookVisit).not.toHaveBeenCalled();
    expect(result.aiMessage.content).toContain("That slot is not available for Prakriti Heights.");
    expect(result.aiMessage.content).toContain("slot-ph-001");
    expect(result.aiMessage.content).toContain("Which time works best for you?");
  });

  // --- REQUIREMENT E: Simultaneous Booking Contention (SlotUnavailableError) ---
  it("E. Simultaneous booking conflict (SlotUnavailableError) offers fresh alternatives, never false success", async () => {
    const slotPromptHistory = [
      {
        id: "msg-1",
        conversationId: "conv-test-1",
        role: ChatMessageRole.AI,
        content: `Here are our upcoming available slots for your site visit to Prakriti Heights:\n• 15 Nov 2026, 10:00 AM IST (ID: slot-ph-001)\n• 15 Nov 2026, 02:00 PM IST (ID: slot-ph-002)\n\nPlease let me know which time works best for you so I can confirm it!`,
        createdAt: new Date(Date.now() - 10000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages: slotPromptHistory });
    // First call returns both slots, second call (after slot 1 taken) returns only slot 2
    let slotCallCount = 0;
    const mockGetAvailableSlots = vi.fn().mockImplementation(() => {
      slotCallCount++;
      if (slotCallCount === 1) {
        return Promise.resolve([prakritiSlot1, prakritiSlot2]);
      }
      return Promise.resolve([prakritiSlot2]);
    });

    const mockBookVisit = vi.fn().mockRejectedValue(
      new SlotUnavailableError("Slot is no longer available for booking")
    );

    const mockBookingService = {
      getAvailableSlots: mockGetAvailableSlots,
      bookVisit: mockBookVisit,
    } as unknown as BookingService;

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      { generate: vi.fn() },
      true
    );

    const result = await aiService.sendMessage({
      conversationId: "conv-test-1",
      message: "15 Nov 2026, 10:00 AM IST",
    });

    expect(mockBookVisit).toHaveBeenCalledTimes(1);
    // Crucial: Must NEVER claim confirmed!
    expect(result.aiMessage.content).not.toContain("has been confirmed");
    expect(result.aiMessage.content).toContain("I apologize, but that slot was just booked by another buyer.");
    expect(result.aiMessage.content).toContain("Here are our remaining available slots for Prakriti Heights:");
    expect(result.aiMessage.content).toContain("slot-ph-002");
    expect(result.aiMessage.content).toContain("02:00 PM IST");
  });

  // --- REQUIREMENT F: Missing or Invalid Slot ID/Text ---
  it("F. Invalid slot ID asks buyer to choose a valid displayed slot and does not book", async () => {
    const slotPromptHistory = [
      {
        id: "msg-1",
        conversationId: "conv-test-1",
        role: ChatMessageRole.AI,
        content: `Here are our upcoming available slots for your site visit to Prakriti Heights:\n• 15 Nov 2026, 10:00 AM IST (ID: slot-ph-001)\n\nPlease let me know which time works best for you so I can confirm it!`,
        createdAt: new Date(Date.now() - 10000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages: slotPromptHistory });
    const mockBookVisit = vi.fn();
    const mockBookingService = {
      getAvailableSlots: vi.fn().mockResolvedValue([prakritiSlot1]),
      bookVisit: mockBookVisit,
    } as unknown as BookingService;

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      { generate: vi.fn() },
      true
    );

    const result = await aiService.sendMessage({
      conversationId: "conv-test-1",
      message: "Please book slot-invalid-9999",
    });

    expect(mockBookVisit).not.toHaveBeenCalled();
    expect(result.aiMessage.content).toContain("That slot is not available for Prakriti Heights.");
    expect(result.aiMessage.content).toContain("slot-ph-001");
    expect(result.aiMessage.content).not.toContain("confirmed");
  });

  // --- REQUIREMENT G: Pre-visit Reminders Staging Logic ---
  it("G. Booking transaction stages 24-hour and 2-hour pre-visit ReminderJobs", async () => {
    // Test the BookingService bookVisit transaction directly to verify DB staging
    const futureSlot: VisitSlot = {
      id: "slot-future-777",
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours in the future
      endsAt: new Date(Date.now() + 49 * 60 * 60 * 1000),
      status: "AVAILABLE",
      location: "Prakriti Heights Experience Gallery, SG Highway, Ahmedabad",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const stagedReminders: Prisma.ReminderJobCreateManyInput[] = [];
    const mockTx = {
      lead: {
        findFirst: vi.fn().mockResolvedValue({ id: "lead-real-1", deletedAt: null }),
      },
      visitSlot: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...futureSlot, status: "BOOKED" }),
      },
      siteVisit: {
        create: vi.fn().mockResolvedValue({
          id: "visit-real-1",
          slotId: futureSlot.id,
          leadId: "lead-real-1",
          bookingStatus: BookingStatus.CONFIRMED,
          attendanceOutcome: AttendanceOutcome.UNRECORDED,
          bookedAt: new Date(),
        }),
      },
      reminderJob: {
        createMany: vi.fn().mockImplementation(({ data }) => {
          stagedReminders.push(...data);
          return Promise.resolve({ count: data.length });
        }),
      },
    };

    const mockPrismaClient = {
      $transaction: vi.fn().mockImplementation((callback) => callback(mockTx)),
    } as unknown as PrismaClient;

    const bookingService = new BookingService(mockPrismaClient);
    const result = await bookingService.bookVisit({
      slotId: futureSlot.id,
      leadId: "lead-real-1",
    });

    expect(result.visit.id).toBe("visit-real-1");
    expect(result.visit.bookingStatus).toBe(BookingStatus.CONFIRMED);
    expect(mockTx.reminderJob.createMany).toHaveBeenCalledTimes(1);

    // Verify both 24h and 2h reminders were staged
    expect(stagedReminders).toHaveLength(2);
    const reminder24h = stagedReminders.find(
      (r) => r.reminderType === ReminderType.REMINDER_24H
    );
    const reminder2h = stagedReminders.find(
      (r) => r.reminderType === ReminderType.REMINDER_2H
    );

    expect(reminder24h).toBeDefined();
    expect(reminder24h?.status).toBe(ReminderStatus.PENDING);
    expect(reminder24h?.idempotencyKey).toBe("visit-real-1:REMINDER_24H");
    expect(new Date(reminder24h?.scheduledFor ?? 0).getTime()).toBeCloseTo(
      futureSlot.startsAt.getTime() - 24 * 60 * 60 * 1000,
      -3
    );

    expect(reminder2h).toBeDefined();
    expect(reminder2h?.status).toBe(ReminderStatus.PENDING);
    expect(reminder2h?.idempotencyKey).toBe("visit-real-1:REMINDER_2H");
    expect(new Date(reminder2h?.scheduledFor ?? 0).getTime()).toBeCloseTo(
      futureSlot.startsAt.getTime() - 2 * 60 * 60 * 1000,
      -3
    );
  });

  // --- REQUIREMENT H: Explicit Human Sales Handoff preserved during slot flow ---
  it("H. Explicit request for sales team while viewing slots creates handoff and does not book", async () => {
    const slotPromptHistory = [
      {
        id: "msg-1",
        conversationId: "conv-test-1",
        role: ChatMessageRole.AI,
        content: `Here are our upcoming available slots for your site visit to Prakriti Heights:\n• 15 Nov 2026, 10:00 AM IST (ID: slot-ph-001)\n\nPlease let me know which time works best for you so I can confirm it!`,
        createdAt: new Date(Date.now() - 10000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages: slotPromptHistory });
    const mockBookVisit = vi.fn();
    const mockBookingService = {
      getAvailableSlots: vi.fn().mockResolvedValue([prakritiSlot1]),
      bookVisit: mockBookVisit,
    } as unknown as BookingService;

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      { generate: vi.fn() },
      true
    );

    const result = await aiService.sendMessage({
      conversationId: "conv-test-1",
      message: "Actually I prefer to talk with a sales executive directly",
    });

    expect(mockBookVisit).not.toHaveBeenCalled();
    expect(result.handoffCreated).toBe(true);
    expect(result.handoff?.escalationReason).toBe(EscalationReason.BUYER_REQUESTED);
    expect(result.aiMessage.content).toContain("Vikram Mehta");
  });

  // --- REQUIREMENT I: Ordinal Selection ("1", "first") ---
  it("I. Replying '1' or 'first' to slot prompt selects the first available slot and confirms", async () => {
    const slotPromptHistory = [
      {
        id: "msg-1",
        conversationId: "conv-test-1",
        role: ChatMessageRole.AI,
        content: `Here are our upcoming available slots for your site visit to Prakriti Heights:\n• 15 Nov 2026, 10:00 AM IST (ID: slot-ph-001)\n• 15 Nov 2026, 02:00 PM IST (ID: slot-ph-002)\n\nPlease let me know which time works best for you so I can confirm it!`,
        createdAt: new Date(Date.now() - 10000),
      },
    ];

    const mockDb = createMockPrisma({ previousMessages: slotPromptHistory });
    const mockBookVisit = vi.fn().mockResolvedValue({
      visit: { id: "visit-ord-1", slotId: prakritiSlot1.id },
      slot: prakritiSlot1,
    });

    const mockBookingService = {
      getAvailableSlots: vi.fn().mockResolvedValue([prakritiSlot1, prakritiSlot2]),
      bookVisit: mockBookVisit,
    } as unknown as BookingService;

    const aiService = new AIConciergeService(
      mockDb as unknown as PrismaClient,
      mockBookingService,
      { generate: vi.fn() },
      true
    );

    const result = await aiService.sendMessage({
      conversationId: "conv-test-1",
      message: "1",
    });

    expect(mockBookVisit).toHaveBeenCalledTimes(1);
    expect(mockBookVisit).toHaveBeenCalledWith({
      slotId: "slot-ph-001",
      leadId: "lead-test-1",
    });
    expect(result.aiMessage.content).toContain("Your site visit to Prakriti Heights has been confirmed");
  });

  // --- REQUIREMENT J: Multilingual Support (Hindi & Gujarati) ---
  it("J. Multilingual slot booking confirms in authentic Hindi and Gujarati", async () => {
    // Hindi Test
    const slotPromptHistoryHI = [
      {
        id: "msg-1",
        conversationId: "conv-test-1",
        role: ChatMessageRole.AI,
        content: `प्रकृति हाइट्स की आपकी साइट विज़िट के लिए आगामी उपलब्ध स्लॉट यहाँ हैं:\n• 15 Nov 2026, 10:00 AM IST (ID: slot-ph-001)\n\nकृपया मुझे बताएं कि कौन सा समय आपके लिए सबसे अच्छा है ताकि मैं पुष्टि कर सकूँ!`,
        createdAt: new Date(Date.now() - 10000),
      },
    ];

    const mockDbHI = createMockPrisma({
      previousMessages: slotPromptHistoryHI,
      language: ConversationLanguage.HI,
    });
    const mockBookVisitHI = vi.fn().mockResolvedValue({
      visit: { id: "visit-hi-1", slotId: prakritiSlot1.id },
      slot: prakritiSlot1,
    });

    const mockBookingServiceHI = {
      getAvailableSlots: vi.fn().mockResolvedValue([prakritiSlot1]),
      bookVisit: mockBookVisitHI,
    } as unknown as BookingService;

    const aiServiceHI = new AIConciergeService(
      mockDbHI as unknown as PrismaClient,
      mockBookingServiceHI,
      { generate: vi.fn() },
      true
    );

    const resultHI = await aiServiceHI.sendMessage({
      conversationId: "conv-test-1",
      message: "10:00 AM",
      language: ConversationLanguage.HI,
    });

    expect(mockBookVisitHI).toHaveBeenCalledWith({
      slotId: "slot-ph-001",
      leadId: "lead-test-1",
    });
    expect(resultHI.aiMessage.content).toContain("प्रकृति हाइट्स के लिए आपकी साइट विज़िट");
    expect(resultHI.aiMessage.content).toContain("कन्फर्म हो गई है");

    // Gujarati Test
    const slotPromptHistoryGU = [
      {
        id: "msg-1",
        conversationId: "conv-test-1",
        role: ChatMessageRole.AI,
        content: `પ્રકૃતિ હાઇટ્સ ની તમારી સાઇટ મુલાકાત માટે ઉપલબ્ધ સ્લોટ્સ અહીં છે:\n• 15 Nov 2026, 10:00 AM IST (ID: slot-ph-001)\n\nકૃપા કરીને મને જણાવો કે કયો સમય તમારા માટે શ્રેષ્ઠ છે જેથી હું તેની પુષ્ટિ કરી શકું!`,
        createdAt: new Date(Date.now() - 10000),
      },
    ];

    const mockDbGU = createMockPrisma({
      previousMessages: slotPromptHistoryGU,
      language: ConversationLanguage.GU,
    });
    const mockBookVisitGU = vi.fn().mockResolvedValue({
      visit: { id: "visit-gu-1", slotId: prakritiSlot1.id },
      slot: prakritiSlot1,
    });

    const mockBookingServiceGU = {
      getAvailableSlots: vi.fn().mockResolvedValue([prakritiSlot1]),
      bookVisit: mockBookVisitGU,
    } as unknown as BookingService;

    const aiServiceGU = new AIConciergeService(
      mockDbGU as unknown as PrismaClient,
      mockBookingServiceGU,
      { generate: vi.fn() },
      true
    );

    const resultGU = await aiServiceGU.sendMessage({
      conversationId: "conv-test-1",
      message: "10:00 AM",
      language: ConversationLanguage.GU,
    });

    expect(mockBookVisitGU).toHaveBeenCalledWith({
      slotId: "slot-ph-001",
      leadId: "lead-test-1",
    });
    expect(resultGU.aiMessage.content).toContain("પ્રકૃતિ હાઇટ્સ માટે તમારી સાઇટ મુલાકાત");
    expect(resultGU.aiMessage.content).toContain("કન્ફર્મ થઈ ગઈ છે");
  });
});
