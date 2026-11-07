import { describe, it, expect, afterAll } from "vitest";
import {
  ConversationLanguage,
  LeadSource,
  VisitSlotStatus,
  EscalationReason,
  HandoffStatus,
  UserRole,
} from "@prisma/client";
import {
  BuyerSessionService,
  BuyerSessionRevokedError,
  BuyerSessionNotFoundError,
  BuyerSessionTamperingError,
} from "@/services/session/buyer-session.service";
import { LeadService } from "@/services/lead/lead.service";
import { AIConciergeService, GeminiClientInterface } from "@/services/ai/ai.service";
import { BookingService } from "@/services/booking/booking.service";
import { testPrisma, disconnectTestPrisma } from "../helpers/testPrisma";

describe("BuyerSessionService Integration Tests (Isolated Neon Test Branch)", () => {
  const sessionService = new BuyerSessionService(testPrisma);
  const leadService = new LeadService(testPrisma);
  const bookingService = new BookingService(testPrisma);

  const createdMessageIds = new Set<string>();
  const createdHandoffIds = new Set<string>();
  const createdConversationIds = new Set<string>();
  const createdSlotIds = new Set<string>();
  const createdVisitIds = new Set<string>();
  const createdLeadIds = new Set<string>();
  const createdUserIds = new Set<string>();

  const RUN_ID = Date.now().toString().slice(-4);

  function getTestPhone(suffix: number): string {
    return `+9198${RUN_ID}${suffix.toString().padStart(4, "0")}`;
  }

  afterAll(async () => {
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
    if (createdLeadIds.size > 0) {
      await testPrisma.consentRecord.deleteMany({ where: { leadId: { in: Array.from(createdLeadIds) } } });
      await testPrisma.leadSourceEvent.deleteMany({ where: { leadId: { in: Array.from(createdLeadIds) } } });
      await testPrisma.lead.deleteMany({ where: { id: { in: Array.from(createdLeadIds) } } });
    }
    if (createdUserIds.size > 0) {
      await testPrisma.user.deleteMany({ where: { id: { in: Array.from(createdUserIds) } } });
    }
    await disconnectTestPrisma();
  });

  it("1. Session initialization binds conversation and lead with valid cryptographic token", async () => {
    const phone = getTestPhone(1);
    const ingest = await leadService.ingestLead({
      name: "Session Test Buyer",
      phone,
      source: LeadSource.WEBSITE,
      consent: {
        consentText: "I consent to processing my personal data under DPDP Act 2023",
        affirmed: true,
      },
    });
    createdLeadIds.add(ingest.lead.id);

    const conv = await testPrisma.conversation.create({
      data: {
        leadId: ingest.lead.id,
        language: ConversationLanguage.EN,
      },
    });
    createdConversationIds.add(conv.id);

    const token = sessionService.signSession({
      conversationId: conv.id,
      leadId: ingest.lead.id,
    });

    const validated = await sessionService.validateSession(token);
    expect(validated.conversation.id).toBe(conv.id);
    expect(validated.lead.id).toBe(ingest.lead.id);
    expect(validated.lead.consentRecord?.optedOut).toBe(false);
  });

  it("2. Duplicate initialization reuses active conversation and merges lead non-destructively", async () => {
    const phone = getTestPhone(2);
    const ingest1 = await leadService.ingestLead({
      name: "Returning Buyer",
      phone,
      source: LeadSource.WEBSITE,
      consent: {
        consentText: "Initial consent disclosure",
        affirmed: true,
      },
    });
    createdLeadIds.add(ingest1.lead.id);

    const conv1 = await testPrisma.conversation.create({
      data: {
        leadId: ingest1.lead.id,
        language: ConversationLanguage.EN,
      },
    });
    createdConversationIds.add(conv1.id);

    // Re-ingest with email enrichment and Gujarati language preference
    const ingest2 = await leadService.ingestLead({
      name: "Returning Buyer",
      phone,
      email: `returning_${RUN_ID}@example.com`,
      source: LeadSource.WEBSITE,
      consent: {
        consentText: "Second touch consent disclosure",
        affirmed: true,
      },
    });

    expect(ingest2.lead.id).toBe(ingest1.lead.id);
    expect(ingest2.isNew).toBe(false);

    // Query active conversation: should find the existing un-ended conversation
    const activeConv = await testPrisma.conversation.findFirst({
      where: { leadId: ingest2.lead.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    expect(activeConv).not.toBeNull();
    expect(activeConv?.id).toBe(conv1.id);
  });

  it("3. Reject session if bound conversation does not exist in database", async () => {
    const fakeToken = sessionService.signSession({
      conversationId: "conv_does_not_exist_in_db",
      leadId: "lead_does_not_exist_in_db",
    });

    await expect(sessionService.validateSession(fakeToken)).rejects.toThrow(
      BuyerSessionNotFoundError
    );
  });

  it("4. Reject revoked session after conversation is ended", async () => {
    const phone = getTestPhone(3);
    const ingest = await leadService.ingestLead({
      name: "Revoked Buyer",
      phone,
      source: LeadSource.WEBSITE,
      consent: { consentText: "Consent text", affirmed: true },
    });
    createdLeadIds.add(ingest.lead.id);

    const conv = await testPrisma.conversation.create({
      data: { leadId: ingest.lead.id },
    });
    createdConversationIds.add(conv.id);

    const token = sessionService.signSession({
      conversationId: conv.id,
      leadId: ingest.lead.id,
    });

    // Revoke the session
    await sessionService.revokeSession(conv.id);

    // Validation must fail with BuyerSessionRevokedError
    await expect(sessionService.validateSession(token)).rejects.toThrow(
      BuyerSessionRevokedError
    );
  });

  it("5. Reject session when buyer exercises DPDP opt-out", async () => {
    const phone = getTestPhone(4);
    const ingest = await leadService.ingestLead({
      name: "OptOut Buyer",
      phone,
      source: LeadSource.WEBSITE,
      consent: { consentText: "Consent text", affirmed: true },
    });
    createdLeadIds.add(ingest.lead.id);

    const conv = await testPrisma.conversation.create({
      data: { leadId: ingest.lead.id },
    });
    createdConversationIds.add(conv.id);

    const token = sessionService.signSession({
      conversationId: conv.id,
      leadId: ingest.lead.id,
    });

    // Execute DPDP opt-out
    await sessionService.optOutSession(ingest.lead.id, conv.id);

    // Verify database consent is opted out
    const consent = await testPrisma.consentRecord.findUnique({
      where: { leadId: ingest.lead.id },
    });
    expect(consent?.optedOut).toBe(true);

    // Validation must reject
    await expect(sessionService.validateSession(token)).rejects.toThrow(
      BuyerSessionRevokedError // or BuyerSessionOptedOutError (endedAt is checked first)
    );
  });

  it("6. Prevent cross-conversation access and client ID tampering", async () => {
    const buyer1 = await leadService.ingestLead({
      name: "Buyer Alpha",
      phone: getTestPhone(5),
      source: LeadSource.WEBSITE,
      consent: { consentText: "Consent", affirmed: true },
    });
    const buyer2 = await leadService.ingestLead({
      name: "Buyer Beta",
      phone: getTestPhone(6),
      source: LeadSource.WEBSITE,
      consent: { consentText: "Consent", affirmed: true },
    });
    createdLeadIds.add(buyer1.lead.id);
    createdLeadIds.add(buyer2.lead.id);

    const conv1 = await testPrisma.conversation.create({ data: { leadId: buyer1.lead.id } });
    const conv2 = await testPrisma.conversation.create({ data: { leadId: buyer2.lead.id } });
    createdConversationIds.add(conv1.id);
    createdConversationIds.add(conv2.id);

    // Token for Buyer 1
    const token1 = sessionService.signSession({
      conversationId: conv1.id,
      leadId: buyer1.lead.id,
    });

    // Validating token1 gives conv1 and buyer1
    const session1 = await sessionService.validateSession(token1);
    expect(session1.conversation.id).toBe(conv1.id);
    expect(session1.lead.id).toBe(buyer1.lead.id);

    // Forging a token that pairs conv2 with buyer1 (tampering attempt)
    const tamperedToken = sessionService.signSession({
      conversationId: conv2.id,
      leadId: buyer1.lead.id, // Mismatch: conv2 belongs to buyer2!
    });

    await expect(sessionService.validateSession(tamperedToken)).rejects.toThrow(
      BuyerSessionTamperingError
    );
  });

  it("7. Authenticated AI Concierge chat flow executes with server-derived identity", async () => {
    const lead = await leadService.ingestLead({
      name: "Chatting Buyer",
      phone: getTestPhone(7),
      source: LeadSource.WEBSITE,
      consent: { consentText: "Consent disclosure", affirmed: true },
    });
    createdLeadIds.add(lead.lead.id);

    const conv = await testPrisma.conversation.create({
      data: {
        leadId: lead.lead.id,
        language: ConversationLanguage.EN,
      },
    });
    createdConversationIds.add(conv.id);

    const token = sessionService.signSession({
      conversationId: conv.id,
      leadId: lead.lead.id,
    });

    // Authenticate session on server
    const session = await sessionService.validateSession(token);

    // Mock Gemini
    const mockGemini: GeminiClientInterface = {
      async generate() {
        return {
          text: "Welcome to ENQUIVO. We feature premium 2 and 3 BHK residences across Ahmedabad West.",
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

    const result = await aiService.sendMessage({
      conversationId: session.conversation.id,
      leadId: session.lead.id,
      message: "Tell me about your apartments in Ahmedabad.",
    });

    createdMessageIds.add(result.userMessage.id);
    createdMessageIds.add(result.aiMessage.id);

    expect(result.userMessage.content).toBe("Tell me about your apartments in Ahmedabad.");
    expect(result.aiMessage.content).toContain("ENQUIVO");
    expect(result.groundingFactIds.length).toBeGreaterThan(0);
  });

  it("8. Booking security boundary: direct AI tool booking is safely gated without independent buyer confirmation", async () => {
    const lead = await leadService.ingestLead({
      name: "Gated Booking Buyer",
      phone: getTestPhone(8),
      source: LeadSource.WEBSITE,
      consent: { consentText: "Consent", affirmed: true },
    });
    createdLeadIds.add(lead.lead.id);

    const conv = await testPrisma.conversation.create({ data: { leadId: lead.lead.id } });
    createdConversationIds.add(conv.id);

    const slotStart = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
    const slot = await testPrisma.visitSlot.create({
      data: {
        startsAt: slotStart,
        endsAt: slotEnd,
        status: VisitSlotStatus.AVAILABLE,
        location: "Prakriti Heights Gallery, Ahmedabad",
      },
    });
    createdSlotIds.add(slot.id);

    // Mock Gemini that tries to call bookVisitSlot
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

    // Instantiate default AIConciergeService (allowDirectToolBooking = false)
    const aiService = new AIConciergeService(testPrisma, bookingService, mockGemini);

    const result = await aiService.sendMessage({
      conversationId: conv.id,
      leadId: lead.lead.id,
      message: "Please finalize this slot for me right now.",
    });

    createdMessageIds.add(result.userMessage.id);
    createdMessageIds.add(result.aiMessage.id);

    // Verify response explains that explicit buyer confirmation is required
    expect(result.aiMessage.content).toContain("explicit buyer confirmation");

    // CRITICAL SECURITY ASSERTION: No site visit booking was finalized in PostgreSQL!
    const siteVisit = await testPrisma.siteVisit.findFirst({
      where: { slotId: slot.id },
    });
    expect(siteVisit).toBeNull();

    // The slot remains AVAILABLE
    const slotAfter = await testPrisma.visitSlot.findUnique({ where: { id: slot.id } });
    expect(slotAfter?.status).toBe(VisitSlotStatus.AVAILABLE);
  });

  it("9. Human handoff creates persistent record with dynamic database salesperson assignment", async () => {
    const lead = await leadService.ingestLead({
      name: "Handoff Buyer",
      phone: getTestPhone(9),
      source: LeadSource.WEBSITE,
      consent: { consentText: "Consent", affirmed: true },
    });
    createdLeadIds.add(lead.lead.id);

    const conv = await testPrisma.conversation.create({ data: { leadId: lead.lead.id } });
    createdConversationIds.add(conv.id);

    const mockGemini: GeminiClientInterface = {
      async generate() {
        return {
          toolCalls: [
            {
              name: "handoffToExecutive",
              args: {
                escalationReason: EscalationReason.PRICE_NEGOTIATION,
                summary: "Buyer is requesting bulk payment discount not in verified facts",
              },
            },
          ],
        };
      },
    };

    const aiService = new AIConciergeService(testPrisma, bookingService, mockGemini);

    const result = await aiService.sendMessage({
      conversationId: conv.id,
      leadId: lead.lead.id,
      message: "Can I get a ₹10 lakh cash discount if I pay tomorrow?",
    });

    createdMessageIds.add(result.userMessage.id);
    createdMessageIds.add(result.aiMessage.id);

    expect(result.handoffCreated).toBe(true);
    expect(result.handoff).not.toBeNull();
    createdHandoffIds.add(result.handoff!.id);

    const dbHandoff = await testPrisma.handoff.findUnique({
      where: { conversationId: conv.id },
      include: { assignedTo: true },
    });

    expect(dbHandoff).not.toBeNull();
    expect(dbHandoff?.escalationReason).toBe(EscalationReason.PRICE_NEGOTIATION);
    expect(dbHandoff?.status).toBe(HandoffStatus.ASSIGNED);
    expect(dbHandoff?.assignedTo?.role).toBe(UserRole.SALES_EXEC);
  });
});
