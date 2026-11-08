import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  UserRole,
  LeadSource,
  EscalationReason,
  HandoffStatus,
  ConversationLanguage,
  ChatMessageRole,
} from "@prisma/client";
import {
  HandoffService,
  HandoffForbiddenError,
  InvalidAssigneeError,
  HandoffNotFoundError,
} from "@/services/handoff/handoff.service";
import { handoffQuerySchema } from "@/lib/validations/handoff";
import {
  isInternalAuditMessage,
  filterBuyerFacingMessages,
} from "@/lib/chat-message";
import { testPrisma, disconnectTestPrisma } from "../helpers/testPrisma";
import { hash } from "@node-rs/argon2";

describe("Handoff Queue & Assignment Integration Tests (Isolated Neon Test Branch)", () => {
  const handoffService = new HandoffService(testPrisma);

  const createdUserIds = new Set<string>();
  const createdLeadIds = new Set<string>();
  const createdConvIds = new Set<string>();
  const createdHandoffIds = new Set<string>();

  const RUN_ID = Date.now().toString().slice(-6);
  const phoneFor = (suffix: number) => `+9197${RUN_ID}${suffix.toString().padStart(2, "0")}`;

  let headUser: { id: string; role: UserRole; name: string };
  let exec1User: { id: string; role: UserRole; name: string };
  let exec2User: { id: string; role: UserRole; name: string };
  let buyerUser: { id: string; role: UserRole; name: string };
  let testProject: { id: string; name: string };

  let unassignedHandoffId: string;
  let assignedHandoffId: string;
  let resolvedHandoffId: string;

  beforeAll(async () => {
    const dummyPasswordHash = await hash("TestPass#2026!");

    // 1. Create Staff Users
    const head = await testPrisma.user.create({
      data: {
        email: `head-hnd-${RUN_ID}@enquivo.test`,
        name: `Handoff Head ${RUN_ID}`,
        passwordHash: dummyPasswordHash,
        role: UserRole.SALES_HEAD,
      },
    });
    createdUserIds.add(head.id);
    headUser = { id: head.id, role: head.role, name: head.name };

    const exec1 = await testPrisma.user.create({
      data: {
        email: `exec1-hnd-${RUN_ID}@enquivo.test`,
        name: `Handoff Exec 1 ${RUN_ID}`,
        passwordHash: dummyPasswordHash,
        role: UserRole.SALES_EXEC,
      },
    });
    createdUserIds.add(exec1.id);
    exec1User = { id: exec1.id, role: exec1.role, name: exec1.name };

    const exec2 = await testPrisma.user.create({
      data: {
        email: `exec2-hnd-${RUN_ID}@enquivo.test`,
        name: `Handoff Exec 2 ${RUN_ID}`,
        passwordHash: dummyPasswordHash,
        role: UserRole.SALES_EXEC,
      },
    });
    createdUserIds.add(exec2.id);
    exec2User = { id: exec2.id, role: exec2.role, name: exec2.name };

    const buyer = await testPrisma.user.create({
      data: {
        email: `buyer-hnd-${RUN_ID}@enquivo.test`,
        name: `Handoff Buyer ${RUN_ID}`,
        passwordHash: dummyPasswordHash,
        role: UserRole.BUYER,
      },
    });
    createdUserIds.add(buyer.id);
    buyerUser = { id: buyer.id, role: buyer.role, name: buyer.name };

    // 2. Fetch or create test project
    let project = await testPrisma.project.findFirst({
      select: { id: true, name: true },
    });
    if (!project) {
      project = await testPrisma.project.create({
        data: {
          name: `Handoff Project ${RUN_ID}`,
          location: "SG Highway, Ahmedabad",
          reraNumber: "DEMO-ONLY-NOT-VERIFIED",
          totalUnits: 100,
        },
        select: { id: true, name: true },
      });
    }
    testProject = project;

    // 3. Create Lead Alpha & Unassigned Handoff (Status: PENDING, assignedToId: null)
    const lA = await testPrisma.lead.create({
      data: {
        leadCode: `LD-HND-${RUN_ID}-A`,
        name: `Alpha Buyer ${RUN_ID}`,
        phone: phoneFor(1),
        email: `alpha-${RUN_ID}@test.com`,
        source: LeadSource.PROPERTY_PORTAL,
        projectId: testProject.id,
        configuration: "3 BHK",
        firstResponseAt: new Date(),
      },
    });
    createdLeadIds.add(lA.id);

    const convA = await testPrisma.conversation.create({
      data: {
        leadId: lA.id,
        language: ConversationLanguage.EN,
      },
    });
    createdConvIds.add(convA.id);

    await testPrisma.chatMessage.createMany({
      data: [
        {
          conversationId: convA.id,
          role: ChatMessageRole.USER,
          content: "Can you provide a discount on the 3 BHK unit?",
        },
        {
          conversationId: convA.id,
          role: ChatMessageRole.AI,
          content: "Our price is fixed, but let me connect you with an executive.",
        },
      ],
    });

    const handoffA = await testPrisma.handoff.create({
      data: {
        conversationId: convA.id,
        escalationReason: EscalationReason.PRICE_NEGOTIATION,
        summary: `Buyer Alpha ${RUN_ID} requesting price discount negotiation.`,
        status: HandoffStatus.PENDING,
        assignedToId: null,
      },
    });
    createdHandoffIds.add(handoffA.id);
    unassignedHandoffId = handoffA.id;

    // 4. Create Lead Beta & Assigned Handoff (Status: ASSIGNED, assignedToId: exec1User.id)
    const lB = await testPrisma.lead.create({
      data: {
        leadCode: `LD-HND-${RUN_ID}-B`,
        name: `Beta Buyer ${RUN_ID}`,
        phone: phoneFor(2),
        email: `beta-${RUN_ID}@test.com`,
        source: LeadSource.SOCIAL_MEDIA_AD,
        projectId: testProject.id,
        configuration: "2 BHK",
        firstResponseAt: new Date(),
      },
    });
    createdLeadIds.add(lB.id);

    const convB = await testPrisma.conversation.create({
      data: {
        leadId: lB.id,
        language: ConversationLanguage.EN,
      },
    });
    createdConvIds.add(convB.id);

    await testPrisma.chatMessage.createMany({
      data: [
        {
          conversationId: convB.id,
          role: ChatMessageRole.USER,
          content: "Is there an infinity pool on the terrace?",
        },
        {
          conversationId: convB.id,
          role: ChatMessageRole.AI,
          content: "That amenity is unlisted. Connecting to executive.",
        },
      ],
    });

    const handoffB = await testPrisma.handoff.create({
      data: {
        conversationId: convB.id,
        escalationReason: EscalationReason.UNLISTED_AMENITY,
        summary: `Buyer Beta ${RUN_ID} asking about infinity pool.`,
        status: HandoffStatus.ASSIGNED,
        assignedToId: exec1User.id,
      },
    });
    createdHandoffIds.add(handoffB.id);
    assignedHandoffId = handoffB.id;

    // 5. Create Lead Gamma & Resolved Handoff (Status: RESOLVED, assignedToId: exec2User.id)
    const lG = await testPrisma.lead.create({
      data: {
        leadCode: `LD-HND-${RUN_ID}-G`,
        name: `Gamma Buyer ${RUN_ID}`,
        phone: phoneFor(3),
        email: `gamma-${RUN_ID}@test.com`,
        source: LeadSource.WEBSITE,
        projectId: testProject.id,
        configuration: "2 BHK",
        firstResponseAt: new Date(),
      },
    });
    createdLeadIds.add(lG.id);

    const convG = await testPrisma.conversation.create({
      data: {
        leadId: lG.id,
        language: ConversationLanguage.EN,
      },
    });
    createdConvIds.add(convG.id);

    const handoffG = await testPrisma.handoff.create({
      data: {
        conversationId: convG.id,
        escalationReason: EscalationReason.MISSING_PROJECT_INFO,
        summary: `Buyer Gamma ${RUN_ID} inquiry resolved.`,
        status: HandoffStatus.RESOLVED,
        assignedToId: exec2User.id,
        resolvedAt: new Date(),
      },
    });
    createdHandoffIds.add(handoffG.id);
    resolvedHandoffId = handoffG.id;
  });

  afterAll(async () => {
    // Teardown test records
    const convIds = Array.from(createdConvIds);
    const handoffIds = Array.from(createdHandoffIds);
    const leadIds = Array.from(createdLeadIds);
    const userIds = Array.from(createdUserIds);

    if (convIds.length > 0) {
      await testPrisma.chatMessage.deleteMany({
        where: { conversationId: { in: convIds } },
      });
    }
    if (handoffIds.length > 0) {
      await testPrisma.handoff.deleteMany({
        where: { id: { in: handoffIds } },
      });
    }
    if (convIds.length > 0) {
      await testPrisma.conversation.deleteMany({
        where: { id: { in: convIds } },
      });
    }
    if (leadIds.length > 0) {
      await testPrisma.lead.deleteMany({
        where: { id: { in: leadIds } },
      });
    }
    if (userIds.length > 0) {
      await testPrisma.staffSession.deleteMany({
        where: { userId: { in: userIds } },
      });
      await testPrisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    await disconnectTestPrisma();
  });

  // ---------------------------------------------------------------------------
  // Test Cases
  // ---------------------------------------------------------------------------

  it("1. SALES_HEAD retrieves all portfolio handoffs with pagination metadata", async () => {
    const result = await handoffService.getHandoffs(
      handoffQuerySchema.parse({ page: 1, limit: 10 }),
      headUser
    );

    expect(result.handoffs).toBeDefined();
    expect(result.pagination.total).toBeGreaterThanOrEqual(3);

    const ids = result.handoffs.map((h) => h.id);
    expect(ids).toContain(unassignedHandoffId);
    expect(ids).toContain(assignedHandoffId);
    expect(ids).toContain(resolvedHandoffId);
  });

  it("2. SALES_EXEC record scoping strictly restricts queue to their assigned handoffs", async () => {
    const exec1Result = await handoffService.getHandoffs(
      handoffQuerySchema.parse({ page: 1, limit: 10 }),
      exec1User
    );

    const exec1Ids = exec1Result.handoffs.map((h) => h.id);
    expect(exec1Ids).toContain(assignedHandoffId);
    expect(exec1Ids).not.toContain(unassignedHandoffId);
    expect(exec1Ids).not.toContain(resolvedHandoffId);

    // Verify all returned handoffs belong to exec1
    for (const h of exec1Result.handoffs) {
      expect(h.assignedTo?.id).toBe(exec1User.id);
    }
  });

  it("3. Search filters handoffs by buyer name, phone, or leadCode", async () => {
    const searchByName = await handoffService.getHandoffs(
      handoffQuerySchema.parse({ search: `Alpha Buyer ${RUN_ID}` }),
      headUser
    );
    expect(searchByName.handoffs.length).toBe(1);
    expect(searchByName.handoffs[0].id).toBe(unassignedHandoffId);

    const searchByPhone = await handoffService.getHandoffs(
      handoffQuerySchema.parse({ search: phoneFor(2) }),
      headUser
    );
    expect(searchByPhone.handoffs.length).toBe(1);
    expect(searchByPhone.handoffs[0].id).toBe(assignedHandoffId);
  });

  it("4. Filter by assignment state and escalation reason", async () => {
    // Filter UNASSIGNED
    const unassignedOnly = await handoffService.getHandoffs(
      handoffQuerySchema.parse({ status: "UNASSIGNED" }),
      headUser
    );
    const unassignedIds = unassignedOnly.handoffs.map((h) => h.id);
    expect(unassignedIds).toContain(unassignedHandoffId);
    expect(unassignedIds).not.toContain(assignedHandoffId);

    // Filter by Reason: PRICE_NEGOTIATION
    const priceReasonOnly = await handoffService.getHandoffs(
      handoffQuerySchema.parse({ reason: EscalationReason.PRICE_NEGOTIATION }),
      headUser
    );
    for (const h of priceReasonOnly.handoffs) {
      expect(h.escalationReason).toBe(EscalationReason.PRICE_NEGOTIATION);
    }
  });

  it("5. Single handoff detail retrieval enforces anti-IDOR role scoping", async () => {
    // SALES_HEAD can inspect any handoff
    const headDetail = await handoffService.getHandoffDetail(
      assignedHandoffId,
      headUser
    );
    expect(headDetail).not.toBeNull();
    expect(headDetail?.id).toBe(assignedHandoffId);
    expect(headDetail?.conversation.messages.length).toBeGreaterThan(0);

    // Assigned SALES_EXEC can inspect their own handoff
    const exec1Detail = await handoffService.getHandoffDetail(
      assignedHandoffId,
      exec1User
    );
    expect(exec1Detail).not.toBeNull();
    expect(exec1Detail?.id).toBe(assignedHandoffId);

    // Unassigned or rival SALES_EXEC receives null (anti-IDOR 404)
    const exec2Detail = await handoffService.getHandoffDetail(
      assignedHandoffId,
      exec2User
    );
    expect(exec2Detail).toBeNull();

    // Non-existent handoff returns null
    const nonExistent = await handoffService.getHandoffDetail(
      "cuid_non_existent_123",
      headUser
    );
    expect(nonExistent).toBeNull();
  });

  it("6. SALES_HEAD assigns unassigned handoff to SALES_EXEC atomically with audit message", async () => {
    const updated = await handoffService.assignHandoff(
      unassignedHandoffId,
      exec1User.id,
      headUser
    );

    expect(updated.status).toBe(HandoffStatus.ASSIGNED);
    expect(updated.assignedTo?.id).toBe(exec1User.id);

    // Verify database reflection
    const dbRecord = await testPrisma.handoff.findUnique({
      where: { id: unassignedHandoffId },
      include: {
        conversation: {
          include: { messages: { orderBy: { createdAt: "desc" } } },
        },
      },
    });

    expect(dbRecord?.status).toBe(HandoffStatus.ASSIGNED);
    expect(dbRecord?.assignedToId).toBe(exec1User.id);

    // Verify system audit message appended in conversation history
    const latestMsg = dbRecord?.conversation.messages[0];
    expect(latestMsg?.role).toBe(ChatMessageRole.AI);
    expect(latestMsg?.content).toContain("[Ownership Assigned]");
    expect(latestMsg?.content).toContain(exec1User.name);
  });

  it("7. SALES_HEAD reassigns handoff from Executive 1 to Executive 2 with ownership update", async () => {
    const reassigned = await handoffService.assignHandoff(
      unassignedHandoffId,
      exec2User.id,
      headUser
    );

    expect(reassigned.status).toBe(HandoffStatus.ASSIGNED);
    expect(reassigned.assignedTo?.id).toBe(exec2User.id);

    // Verify Executive 2 now sees it and Executive 1 no longer sees it
    const exec2List = await handoffService.getHandoffs(
      handoffQuerySchema.parse({ page: 1, limit: 10 }),
      exec2User
    );
    const exec1List = await handoffService.getHandoffs(
      handoffQuerySchema.parse({ page: 1, limit: 10 }),
      exec1User
    );

    expect(exec2List.handoffs.some((h) => h.id === unassignedHandoffId)).toBe(true);
    expect(exec1List.handoffs.some((h) => h.id === unassignedHandoffId)).toBe(false);

    // Verify reassignment audit note
    const dbRecord = await testPrisma.handoff.findUnique({
      where: { id: unassignedHandoffId },
      include: {
        conversation: {
          include: { messages: { orderBy: { createdAt: "desc" } } },
        },
      },
    });
    const latestMsg = dbRecord?.conversation.messages[0];
    expect(latestMsg?.content).toContain("[Ownership Reassigned]");
    expect(latestMsg?.content).toContain(exec2User.name);
  });

  it("8. SALES_EXEC attempting to assign or reassign throws HandoffForbiddenError (403)", async () => {
    await expect(
      handoffService.assignHandoff(unassignedHandoffId, exec1User.id, exec1User)
    ).rejects.toThrow(HandoffForbiddenError);

    await expect(
      handoffService.assignHandoff(unassignedHandoffId, exec2User.id, exec2User)
    ).rejects.toThrow(HandoffForbiddenError);
  });

  it("9. Assigning to non-existent or ineligible user role throws InvalidAssigneeError", async () => {
    // Non-existent user
    await expect(
      handoffService.assignHandoff(unassignedHandoffId, "cuid_ghost_exec", headUser)
    ).rejects.toThrow(InvalidAssigneeError);

    // Ineligible user role (BUYER)
    await expect(
      handoffService.assignHandoff(unassignedHandoffId, buyerUser.id, headUser)
    ).rejects.toThrow(InvalidAssigneeError);
  });

  it("10. Concurrent assignment attempts execute atomically under serialized last-write-wins (LWW)", async () => {
    // Record baseline audit turn count before concurrent execution
    const initialHandoff = await testPrisma.handoff.findUnique({
      where: { id: assignedHandoffId },
      include: { conversation: { include: { messages: true } } },
    });
    const baselineMessageCount = initialHandoff?.conversation.messages.length ?? 0;

    // Run two simultaneous reassignments from Sales Head targeting different executives
    const [res1, res2] = await Promise.all([
      handoffService.assignHandoff(assignedHandoffId, exec1User.id, headUser),
      handoffService.assignHandoff(assignedHandoffId, exec2User.id, headUser),
    ]);

    expect(res1.status).toBe(HandoffStatus.ASSIGNED);
    expect(res2.status).toBe(HandoffStatus.ASSIGNED);

    // Database record must have exactly one consistent, valid assignee (exec1 or exec2)
    const finalRecord = await testPrisma.handoff.findUnique({
      where: { id: assignedHandoffId },
      include: {
        conversation: {
          include: { messages: { orderBy: { createdAt: "desc" } } },
        },
      },
    });

    const finalAssigneeId = finalRecord?.assignedToId;
    expect([exec1User.id, exec2User.id]).toContain(finalAssigneeId);

    // Concurrency semantics: Serialized Last-Write-Wins (LWW)
    // Both transactions succeed atomically within prisma.$transaction without deadlock or P2002.
    // The final database ownership matches the winning transaction, and exactly 2 audit messages were appended.
    const messagesAfter = finalRecord?.conversation.messages ?? [];
    expect(messagesAfter.length).toBe(baselineMessageCount + 2);

    // Verify both audit records were persisted atomically without partial updates or orphaned records
    const auditNotes = messagesAfter.filter((m) =>
      m.content.startsWith("[Ownership")
    );
    expect(auditNotes.length).toBeGreaterThanOrEqual(2);

    // The most recent audit record in the transcript matches the final assignee
    const winningExec = finalAssigneeId === exec1User.id ? exec1User : exec2User;
    expect(auditNotes[0].content).toContain(winningExec.name);
  });

  it("11. getHandoffMetrics calculates accurate live counts and executive workload", async () => {
    const metrics = await handoffService.getHandoffMetrics(headUser);

    expect(metrics.totalHandoffs).toBeGreaterThanOrEqual(3);
    expect(typeof metrics.unassignedCount).toBe("number");
    expect(typeof metrics.assignedCount).toBe("number");
    expect(typeof metrics.resolvedCount).toBe("number");
    expect(metrics.eligibleExecutives.length).toBeGreaterThanOrEqual(2);

    const exec1Workload = metrics.eligibleExecutives.find((e) => e.id === exec1User.id);
    expect(exec1Workload).toBeDefined();
    expect(exec1Workload?.name).toBe(exec1User.name);
    expect(typeof exec1Workload?.activeLeadCount).toBe("number");
  });

  it("12. updateHandoffStatus resolves escalation for authorized staff and enforces anti-IDOR scoping", async () => {
    // SALES_HEAD can resolve any handoff
    const resolvedByHead = await handoffService.updateHandoffStatus(
      assignedHandoffId,
      HandoffStatus.RESOLVED,
      headUser
    );
    expect(resolvedByHead.status).toBe(HandoffStatus.RESOLVED);
    expect(resolvedByHead.resolvedAt).not.toBeNull();

    // Unauthorized executive (exec1 is not assigned to unassignedHandoffId) gets HandoffNotFoundError (anti-IDOR 404)
    await expect(
      handoffService.updateHandoffStatus(
        unassignedHandoffId,
        HandoffStatus.RESOLVED,
        exec1User
      )
    ).rejects.toThrow(HandoffNotFoundError);

    // Non-staff user (BUYER) throws HandoffForbiddenError (403)
    await expect(
      handoffService.updateHandoffStatus(
        unassignedHandoffId,
        HandoffStatus.RESOLVED,
        buyerUser
      )
    ).rejects.toThrow(HandoffForbiddenError);
  });

  it("13. regression test: internal audit messages are isolated from buyer/API/AI but visible to staff; USER messages with audit prefixes remain unsuppressed", async () => {
    // Retrieve conversation for the assigned handoff
    const handoffRecord = await testPrisma.handoff.findUnique({
      where: { id: assignedHandoffId },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
    expect(handoffRecord).not.toBeNull();

    // Insert a buyer turn that happens to start with an audit prefix (anti-spoofing regression test)
    const buyerMessageWithPrefix = await testPrisma.chatMessage.create({
      data: {
        conversationId: handoffRecord!.conversationId,
        role: ChatMessageRole.USER,
        content: "[Ownership Assigned] Can you confirm who my assigned advisor is?",
      },
    });

    const refreshedMessages = await testPrisma.chatMessage.findMany({
      where: { conversationId: handoffRecord!.conversationId },
      orderBy: { createdAt: "asc" },
    });

    // Verify genuine AI audit messages exist in database
    const genuineAuditMessages = refreshedMessages.filter((m) =>
      isInternalAuditMessage(m)
    );
    expect(genuineAuditMessages.length).toBeGreaterThanOrEqual(1);

    // Verify the buyer message with the same prefix is NOT classified as an audit record
    expect(isInternalAuditMessage(buyerMessageWithPrefix)).toBe(false);

    // 1. Buyer API & Interface isolation:
    // Calling filterBuyerFacingMessages (used by /api/chat/session and concierge-chat UI)
    // strictly strips genuine AI audit notes, but PRESERVES the buyer's message
    const buyerFacingMessages = filterBuyerFacingMessages(refreshedMessages);
    expect(buyerFacingMessages.some((m) => isInternalAuditMessage(m))).toBe(false);
    expect(buyerFacingMessages.some((m) => m.id === buyerMessageWithPrefix.id)).toBe(true);

    // 2. Staff Visibility:
    // Authorized staff inspecting transcript via getHandoffDetail receives all turns
    // including internal audit records and buyer turns for operational oversight
    const staffDetail = await handoffService.getHandoffDetail(
      assignedHandoffId,
      headUser
    );
    expect(staffDetail).not.toBeNull();
    const staffAuditMessages = staffDetail?.conversation.messages.filter((m) =>
      isInternalAuditMessage(m)
    );
    expect(staffAuditMessages && staffAuditMessages.length).toBeGreaterThanOrEqual(1);
    expect(staffDetail?.conversation.messages.some((m) => m.id === buyerMessageWithPrefix.id)).toBe(true);

    // 3. AI Context Isolation:
    // Simulating AIConciergeService history generation: AI audit messages are excluded
    // so Gemini is never prompted with internal reassignment notes, while buyer turns are retained
    const geminiHistory = refreshedMessages
      .filter((m) => !isInternalAuditMessage(m))
      .map((m) => ({
        role: m.role === ChatMessageRole.USER ? "user" : "model",
        text: m.content,
      }));

    expect(geminiHistory.some((h) => h.role === "model" && h.text.startsWith("[Ownership"))).toBe(false);
    expect(geminiHistory.some((h) => h.role === "user" && h.text.includes("assigned advisor"))).toBe(true);
  });
});
