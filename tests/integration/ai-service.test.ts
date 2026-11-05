import { describe, it, expect, afterAll } from "vitest";
import {
  ConversationLanguage,
  FactSheetScope,
  FactSheetStatus,
  EscalationReason,
  HandoffStatus,
  UserRole,
  LeadSource,
  VisitSlotStatus,
  BookingStatus,
  ChatMessageRole,
} from "@prisma/client";
import {
  AIConciergeService,
  AISecurityError,
  AIConversationNotFoundError,
  GeminiClientInterface,
  buildSystemInstruction,
} from "@/services/ai/ai.service";
import { BookingService } from "@/services/booking/booking.service";
import { testPrisma, disconnectTestPrisma } from "../helpers/testPrisma";

describe("AIConciergeService Integration Tests (Isolated Neon Test Branch)", () => {
  const bookingService = new BookingService(testPrisma);

  // Track entities for clean teardown
  const createdMessageIds = new Set<string>();
  const createdHandoffIds = new Set<string>();
  const createdConversationIds = new Set<string>();
  const createdSlotIds = new Set<string>();
  const createdVisitIds = new Set<string>();
  const createdFactIds = new Set<string>();
  const createdProjectIds = new Set<string>();
  const createdLeadIds = new Set<string>();
  const createdUserIds = new Set<string>();

  const RUN_ID = Date.now().toString().slice(-6);

  afterAll(async () => {
    // Teardown in reverse dependency order
    if (createdMessageIds.size > 0) {
      await testPrisma.chatMessage.deleteMany({ where: { id: { in: Array.from(createdMessageIds) } } });
    }
    if (createdHandoffIds.size > 0) {
      await testPrisma.handoff.deleteMany({ where: { id: { in: Array.from(createdHandoffIds) } } });
    }
    if (createdConversationIds.size > 0) {
      await testPrisma.conversation.deleteMany({ where: { id: { in: Array.from(createdConversationIds) } } });
    }
    if (createdVisitIds.size > 0) {
      await testPrisma.reminderJob.deleteMany({ where: { siteVisitId: { in: Array.from(createdVisitIds) } } });
      await testPrisma.siteVisit.deleteMany({ where: { id: { in: Array.from(createdVisitIds) } } });
    }
    if (createdSlotIds.size > 0) {
      await testPrisma.visitSlot.deleteMany({ where: { id: { in: Array.from(createdSlotIds) } } });
    }
    if (createdFactIds.size > 0) {
      await testPrisma.factSheet.deleteMany({ where: { id: { in: Array.from(createdFactIds) } } });
    }
    if (createdLeadIds.size > 0) {
      await testPrisma.consentRecord.deleteMany({ where: { leadId: { in: Array.from(createdLeadIds) } } });
      await testPrisma.leadSourceEvent.deleteMany({ where: { leadId: { in: Array.from(createdLeadIds) } } });
      await testPrisma.lead.deleteMany({ where: { id: { in: Array.from(createdLeadIds) } } });
    }
    if (createdProjectIds.size > 0) {
      await testPrisma.project.deleteMany({ where: { id: { in: Array.from(createdProjectIds) } } });
    }
    if (createdUserIds.size > 0) {
      await testPrisma.user.deleteMany({ where: { id: { in: Array.from(createdUserIds) } } });
    }
    await disconnectTestPrisma();
  });

  // Helpers
  async function createLead(name: string, phoneSuffix: number) {
    const lead = await testPrisma.lead.create({
      data: {
        leadCode: `LD-AI-${RUN_ID}-${phoneSuffix.toString().padStart(4, "0")}`,
        name,
        phone: `+9196${RUN_ID}${phoneSuffix.toString().padStart(4, "0")}`,
        source: LeadSource.WEBSITE,
        consentRecord: {
          create: {
            consentText: "I agree to receive communications per DPDP Act 2023",
            consentedAt: new Date(),
            optedOut: false,
          },
        },
      },
    });
    createdLeadIds.add(lead.id);
    return lead;
  }

  async function createConversation(leadId: string, language: ConversationLanguage = ConversationLanguage.EN) {
    const conversation = await testPrisma.conversation.create({
      data: {
        leadId,
        language,
      },
    });
    createdConversationIds.add(conversation.id);
    return conversation;
  }

  it("1. Verified facts only: dual-flag and project scoping exclusion", async () => {
    // Create an admin user for factSheet creator FK
    const adminUser = await testPrisma.user.create({
      data: {
        email: `admin-${RUN_ID}@enquivo.test`,
        name: "Admin Tester",
        role: UserRole.SALES_HEAD,
        passwordHash: "argon2id$mock-hash",
      },
    });
    createdUserIds.add(adminUser.id);

    // Create Project A and Project B
    const projectA = await testPrisma.project.create({
      data: { name: `Project Alpha ${RUN_ID}`, location: "Ahmedabad West", totalUnits: 100 },
    });
    createdProjectIds.add(projectA.id);

    const projectB = await testPrisma.project.create({
      data: { name: `Project Beta ${RUN_ID}`, location: "Ahmedabad East", totalUnits: 100 },
    });
    createdProjectIds.add(projectB.id);

    // Fact 1: Portfolio, Verified, Active
    const factPortfolio = await testPrisma.factSheet.create({
      data: {
        key: `portfolio_pricing_${RUN_ID}`,
        value: "₹65L to ₹1.2Cr portfolio range",
        scope: FactSheetScope.PORTFOLIO,
        status: FactSheetStatus.VERIFIED,
        isActive: true,
        createdById: adminUser.id,
      },
    });
    createdFactIds.add(factPortfolio.id);

    // Fact 2: Project A, Verified, Active
    const factProjectA = await testPrisma.factSheet.create({
      data: {
        key: `project_a_units_${RUN_ID}`,
        value: "Project Alpha has 100 luxury units",
        scope: FactSheetScope.PROJECT_1,
        status: FactSheetStatus.VERIFIED,
        isActive: true,
        projectId: projectA.id,
        createdById: adminUser.id,
      },
    });
    createdFactIds.add(factProjectA.id);

    // Fact 3: Project A, DRAFT (Must be excluded!)
    const factDraft = await testPrisma.factSheet.create({
      data: {
        key: `project_a_penthouse_${RUN_ID}`,
        value: "Unapproved penthouse with private pool",
        scope: FactSheetScope.PROJECT_1,
        status: FactSheetStatus.DRAFT,
        isActive: false,
        projectId: projectA.id,
        createdById: adminUser.id,
      },
    });
    createdFactIds.add(factDraft.id);

    // Fact 4: Project B, Verified, Active (Must be excluded when querying Project A!)
    const factProjectB = await testPrisma.factSheet.create({
      data: {
        key: `project_b_units_${RUN_ID}`,
        value: "Project Beta verified details",
        scope: FactSheetScope.PROJECT_2,
        status: FactSheetStatus.VERIFIED,
        isActive: true,
        projectId: projectB.id,
        createdById: adminUser.id,
      },
    });
    createdFactIds.add(factProjectB.id);

    const aiService = new AIConciergeService(testPrisma, bookingService);

    // Query facts for Project A
    const retrieved = await aiService.getVerifiedFacts({ projectId: projectA.id });

    const retrievedIds = retrieved.map((f) => f.id);
    expect(retrievedIds).toContain(factPortfolio.id);
    expect(retrievedIds).toContain(factProjectA.id);
    expect(retrievedIds).not.toContain(factDraft.id); // DRAFT excluded!
    expect(retrievedIds).not.toContain(factProjectB.id); // Other project excluded!
  });

  it("2. GroundingFactIds persistence and firstResponseAt behaviour", async () => {
    const lead = await createLead("Hardik Test", 101);
    expect(lead.firstResponseAt).toBeNull();

    const conversation = await createConversation(lead.id, ConversationLanguage.EN);

    // Mock Gemini client that calls getVerifiedFacts
    const mockGemini: GeminiClientInterface = {
      async generate() {
        return {
          text: "Enquivo offers premium 2 & 3 BHK homes in prime Ahmedabad locations.",
          toolCalls: [
            {
              name: "getVerifiedFacts",
              args: { scope: "PORTFOLIO" },
            },
          ],
        };
      },
    };

    const aiService = new AIConciergeService(testPrisma, bookingService, mockGemini);

    // Turn 1
    const result = await aiService.sendMessage({
      conversationId: conversation.id,
      message: "What kind of properties do you have in Ahmedabad?",
    });

    createdMessageIds.add(result.userMessage.id);
    createdMessageIds.add(result.aiMessage.id);

    expect(result.groundingFactIds.length).toBeGreaterThan(0);
    expect(result.aiMessage.groundingFactIds.length).toBeGreaterThan(0);

    // Check firstResponseAt was set
    const updatedLead = await testPrisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.firstResponseAt).not.toBeNull();
    const firstResponseTime = updatedLead?.firstResponseAt;

    // Turn 2: verify firstResponseAt is not overwritten
    const result2 = await aiService.sendMessage({
      conversationId: conversation.id,
      message: "Can you tell me more about pricing?",
    });
    createdMessageIds.add(result2.userMessage.id);
    createdMessageIds.add(result2.aiMessage.id);

    const leadTurn2 = await testPrisma.lead.findUnique({ where: { id: lead.id } });
    expect(leadTurn2?.firstResponseAt?.getTime()).toEqual(firstResponseTime?.getTime());
  });

  it("3. Conversation and lead identity validation enforces security", async () => {
    const lead1 = await createLead("Buyer One", 102);
    const lead2 = await createLead("Buyer Two", 103);

    const conv1 = await createConversation(lead1.id);

    const aiService = new AIConciergeService(testPrisma, bookingService);

    // Attempting to send message to conv1 pretending to be lead2 must fail
    await expect(
      aiService.sendMessage({
        conversationId: conv1.id,
        leadId: lead2.id,
        message: "Hacking attempt",
      })
    ).rejects.toThrow(AISecurityError);

    // Attempting to send message to non-existent conversation
    await expect(
      aiService.sendMessage({
        conversationId: "non-existent-conv-id",
        message: "Hello",
      })
    ).rejects.toThrow(AIConversationNotFoundError);
  });

  it("4. Slot checking and booking via BookingService with server-derived leadId", async () => {
    const lead = await createLead("Booking Buyer", 104);
    const conv = await createConversation(lead.id);

    const slotStart = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h future
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
    const slot = await testPrisma.visitSlot.create({
      data: {
        startsAt: slotStart,
        endsAt: slotEnd,
        status: VisitSlotStatus.AVAILABLE,
        location: "Enquivo Sales Gallery, Ahmedabad",
      },
    });
    createdSlotIds.add(slot.id);

    // Mock Gemini client that calls bookVisitSlot WITHOUT providing leadId
    const mockGemini: GeminiClientInterface = {
      async generate() {
        return {
          toolCalls: [
            {
              name: "bookVisitSlot",
              args: { slotId: slot.id, confirmed: true },
            },
          ],
        };
      },
    };

    const aiService = new AIConciergeService(testPrisma, bookingService, mockGemini);

    const result = await aiService.sendMessage({
      conversationId: conv.id,
      message: "Please book the appointment for me.",
    });

    createdMessageIds.add(result.userMessage.id);
    createdMessageIds.add(result.aiMessage.id);

    expect(result.aiMessage.content).toContain("confirmed");

    // Verify booking in database has the server-derived leadId
    const siteVisit = await testPrisma.siteVisit.findFirst({
      where: { slotId: slot.id, bookingStatus: BookingStatus.CONFIRMED },
    });
    expect(siteVisit).not.toBeNull();
    expect(siteVisit?.leadId).toBe(lead.id);
    createdVisitIds.add(siteVisit!.id);

    // Verify slot is now BOOKED
    const updatedSlot = await testPrisma.visitSlot.findUnique({ where: { id: slot.id } });
    expect(updatedSlot?.status).toBe(VisitSlotStatus.BOOKED);
  });

  it("5. Human handoff creates persistent record with database sales executive assignment", async () => {
    // Query the database's first active SALES_EXEC (seeded or test)
    let salesExec = await testPrisma.user.findFirst({
      where: { role: UserRole.SALES_EXEC },
      orderBy: { createdAt: "asc" },
    });

    // If none exists, create one
    if (!salesExec) {
      salesExec = await testPrisma.user.create({
        data: {
          email: `exec-${RUN_ID}@enquivo.test`,
          name: "Vikram Tester",
          role: UserRole.SALES_EXEC,
          passwordHash: "argon2id$mock-hash",
        },
      });
      createdUserIds.add(salesExec.id);
    }

    const lead = await createLead("Handoff Buyer", 105);
    const conv = await createConversation(lead.id);

    // Mock Gemini client that calls handoffToExecutive
    const mockGemini: GeminiClientInterface = {
      async generate() {
        return {
          toolCalls: [
            {
              name: "handoffToExecutive",
              args: {
                escalationReason: "PRICE_NEGOTIATION",
                summary: "Buyer is asking for a 10% discount on 3 BHK",
              },
            },
          ],
        };
      },
    };

    const aiService = new AIConciergeService(testPrisma, bookingService, mockGemini);

    const result = await aiService.sendMessage({
      conversationId: conv.id,
      message: "Can I get a discount if I pay full cash upfront?",
    });

    createdMessageIds.add(result.userMessage.id);
    createdMessageIds.add(result.aiMessage.id);

    expect(result.handoffCreated).toBe(true);

    // Verify handoff record in database
    const handoff = await testPrisma.handoff.findUnique({
      where: { conversationId: conv.id },
      include: { assignedTo: true },
    });

    expect(handoff).not.toBeNull();
    createdHandoffIds.add(handoff!.id);

    expect(handoff?.escalationReason).toBe(EscalationReason.PRICE_NEGOTIATION);
    expect(handoff?.summary).toContain("discount");
    expect(handoff?.assignedToId).toBe(salesExec.id);
    expect(handoff?.assignedTo?.name).toBe(salesExec.name);
    expect(handoff?.status).toBe(HandoffStatus.ASSIGNED);

    // AI message should dynamically include the salesperson's name from database
    expect(result.aiMessage.content).toContain(salesExec.name);
  });

  it("6. Multilingual system prompt configuration and RERA disclaimer", () => {
    const enPrompt = buildSystemInstruction(ConversationLanguage.EN, "Prakriti Heights");
    expect(enPrompt).toContain("clear, professional English");
    expect(enPrompt).toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
    expect(enPrompt).toContain("Prakriti Heights");

    const hiPrompt = buildSystemInstruction(ConversationLanguage.HI);
    expect(hiPrompt).toContain("हिन्दी");
    expect(hiPrompt).toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");

    const guPrompt = buildSystemInstruction(ConversationLanguage.GU);
    expect(guPrompt).toContain("ગુજરાતી");
    expect(guPrompt).toContain("RERA Reg: DEMO-ONLY-NOT-VERIFIED");
  });

  it("7. Model error does not lose already persisted user message", async () => {
    const lead = await createLead("Error Test Buyer", 106);
    const conv = await createConversation(lead.id);

    // Mock Gemini client that throws an error
    const failingGemini: GeminiClientInterface = {
      async generate() {
        throw new Error("Simulated Gemini API 503 Overloaded");
      },
    };

    const aiService = new AIConciergeService(testPrisma, bookingService, failingGemini);

    await expect(
      aiService.sendMessage({
        conversationId: conv.id,
        message: "Hello, this message must not be lost",
      })
    ).rejects.toThrow("Simulated Gemini API 503 Overloaded");

    // Verify user message was still persisted in the database!
    const userMsg = await testPrisma.chatMessage.findFirst({
      where: { conversationId: conv.id, role: ChatMessageRole.USER },
    });

    expect(userMsg).not.toBeNull();
    expect(userMsg?.content).toBe("Hello, this message must not be lost");
    createdMessageIds.add(userMsg!.id);

    // firstResponseAt must remain null because no AI response succeeded
    const leadAfterFailure = await testPrisma.lead.findUnique({ where: { id: lead.id } });
    expect(leadAfterFailure?.firstResponseAt).toBeNull();
  });
});
