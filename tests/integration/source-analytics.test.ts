import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  UserRole,
  LeadSource,
  BookingStatus,
  AttendanceOutcome,
  VisitSlotStatus,
  HandoffStatus,
  EscalationReason,
  ConversationLanguage,
} from "@prisma/client";
import { SourceAnalyticsService } from "@/services/analytics/source-analytics.service";
import { testPrisma, disconnectTestPrisma } from "../helpers/testPrisma";

describe("Source Attribution & ROI Analytics Integration Tests (Isolated Neon Test Branch)", () => {
  const service = new SourceAnalyticsService(testPrisma);

  const createdSpendIds = new Set<string>();
  const createdVisitIds = new Set<string>();
  const createdSlotIds = new Set<string>();
  const createdEventIds = new Set<string>();
  const createdHandoffIds = new Set<string>();
  const createdConvoIds = new Set<string>();
  const createdLeadIds = new Set<string>();
  const createdUserIds = new Set<string>();

  const RUN_TAG = `test-analytics-${Date.now().toString().slice(-6)}`;
  const TEST_MONTH = "2026-11";

  let salesHead: { id: string; role: UserRole };
  let assignedExec: { id: string; role: UserRole };
  let unassignedExec: { id: string; role: UserRole };

  beforeAll(async () => {
    // 1. Create test users
    const head = await testPrisma.user.create({
      data: {
        email: `${RUN_TAG}-head@example.com`,
        name: "Test Sales Head",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
        role: UserRole.SALES_HEAD,
      },
    });
    createdUserIds.add(head.id);
    salesHead = { id: head.id, role: head.role };

    const exec1 = await testPrisma.user.create({
      data: {
        email: `${RUN_TAG}-exec1@example.com`,
        name: "Assigned Executive",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
        role: UserRole.SALES_EXEC,
      },
    });
    createdUserIds.add(exec1.id);
    assignedExec = { id: exec1.id, role: exec1.role };

    const exec2 = await testPrisma.user.create({
      data: {
        email: `${RUN_TAG}-exec2@example.com`,
        name: "Unassigned Executive",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
        role: UserRole.SALES_EXEC,
      },
    });
    createdUserIds.add(exec2.id);
    unassignedExec = { id: exec2.id, role: exec2.role };
  });

  afterAll(async () => {
    // Teardown in reverse dependency order
    if (createdSpendIds.size > 0) {
      await testPrisma.sourceSpend.deleteMany({
        where: { id: { in: Array.from(createdSpendIds) } },
      });
    }

    if (createdVisitIds.size > 0) {
      await testPrisma.reminderJob.deleteMany({
        where: { siteVisitId: { in: Array.from(createdVisitIds) } },
      });
      await testPrisma.siteVisit.deleteMany({
        where: { id: { in: Array.from(createdVisitIds) } },
      });
    }

    if (createdSlotIds.size > 0) {
      await testPrisma.visitSlot.deleteMany({
        where: { id: { in: Array.from(createdSlotIds) } },
      });
    }

    if (createdEventIds.size > 0) {
      await testPrisma.leadSourceEvent.deleteMany({
        where: { id: { in: Array.from(createdEventIds) } },
      });
    }

    if (createdHandoffIds.size > 0) {
      await testPrisma.handoff.deleteMany({
        where: { id: { in: Array.from(createdHandoffIds) } },
      });
    }

    if (createdConvoIds.size > 0) {
      await testPrisma.chatMessage.deleteMany({
        where: { conversationId: { in: Array.from(createdConvoIds) } },
      });
      await testPrisma.conversation.deleteMany({
        where: { id: { in: Array.from(createdConvoIds) } },
      });
    }

    if (createdLeadIds.size > 0) {
      await testPrisma.lead.deleteMany({
        where: { id: { in: Array.from(createdLeadIds) } },
      });
    }

    if (createdUserIds.size > 0) {
      await testPrisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
    }

    await disconnectTestPrisma();
  });

  it("aggregates live database spend, first-touch leads, and conversion metrics for SALES_HEAD", async () => {
    // Create spend for Website channel
    const spend = await testPrisma.sourceSpend.upsert({
      where: {
        unique_source_month: {
          source: LeadSource.WEBSITE,
          monthYear: TEST_MONTH,
        },
      },
      update: {
        amountPaise: BigInt(50000000), // ₹5,00,000
      },
      create: {
        source: LeadSource.WEBSITE,
        monthYear: TEST_MONTH,
        amountPaise: BigInt(50000000),
        note: "Integration test spend",
      },
    });
    createdSpendIds.add(spend.id);

    // Create Lead 1: First-touch Website, with 1 attended visit
    const lead1 = await testPrisma.lead.create({
      data: {
        leadCode: `LD-${RUN_TAG}-1`,
        name: "Test Lead One",
        phone: `+919999${RUN_TAG.slice(-6)}`,
        source: LeadSource.WEBSITE,
        createdAt: new Date("2026-11-05T10:00:00Z"),
        firstResponseAt: new Date("2026-11-05T10:03:00Z"), // 3 min
      },
    });
    createdLeadIds.add(lead1.id);

    // Add multi-touch events to Lead 1 (Initial Website + subsequent Social Media touch)
    const event1 = await testPrisma.leadSourceEvent.create({
      data: {
        leadId: lead1.id,
        source: LeadSource.WEBSITE,
        occurredAt: new Date("2026-11-05T10:00:00Z"),
      },
    });
    createdEventIds.add(event1.id);

    const event2 = await testPrisma.leadSourceEvent.create({
      data: {
        leadId: lead1.id,
        source: LeadSource.SOCIAL_MEDIA_AD,
        occurredAt: new Date("2026-11-06T14:00:00Z"),
      },
    });
    createdEventIds.add(event2.id);

    // Create slot & attended visit for Lead 1
    const slot1 = await testPrisma.visitSlot.create({
      data: {
        startsAt: new Date("2026-11-07T11:00:00Z"),
        endsAt: new Date("2026-11-07T11:45:00Z"),
        status: VisitSlotStatus.BOOKED,
      },
    });
    createdSlotIds.add(slot1.id);

    const visit1 = await testPrisma.siteVisit.create({
      data: {
        leadId: lead1.id,
        slotId: slot1.id,
        bookingStatus: BookingStatus.COMPLETED,
        attendanceOutcome: AttendanceOutcome.ATTENDED,
        attendedAt: new Date("2026-11-07T11:15:00Z"),
      },
    });
    createdVisitIds.add(visit1.id);

    // Query analytics as Sales Head
    const analytics = await service.getSourceAnalytics(
      { monthYear: TEST_MONTH },
      salesHead
    );

    expect(analytics.summary.isSpendRestricted).toBe(false);
    expect(analytics.summary.totalDistinctLeads).toBeGreaterThanOrEqual(1);

    const websiteSource = analytics.sources.find((s) => s.source === LeadSource.WEBSITE)!;
    expect(websiteSource).toBeDefined();
    expect(websiteSource.totalLeads).toBeGreaterThanOrEqual(1);
    expect(websiteSource.attendedVisitsCount).toBeGreaterThanOrEqual(1);
    expect(websiteSource.spendRupees).toBeGreaterThanOrEqual(500000);

    // Multi-touch breakdown includes both Website and Social Media touches
    const websiteEvents = analytics.multiTouchBreakdown.find((m) => m.source === LeadSource.WEBSITE)!;
    const socialEvents = analytics.multiTouchBreakdown.find((m) => m.source === LeadSource.SOCIAL_MEDIA_AD)!;
    expect(websiteEvents.count).toBeGreaterThanOrEqual(1);
    expect(socialEvents.count).toBeGreaterThanOrEqual(1);
  });

  it("enforces relational scoping and spend privacy when queried by SALES_EXEC", async () => {
    // Create Lead 2: Assigned to assignedExec via Handoff
    const lead2 = await testPrisma.lead.create({
      data: {
        leadCode: `LD-${RUN_TAG}-2`,
        name: "Assigned Lead Two",
        phone: `+919888${RUN_TAG.slice(-6)}`,
        source: LeadSource.HOARDING_CALL,
        createdAt: new Date("2026-11-08T10:00:00Z"),
        firstResponseAt: new Date("2026-11-08T10:02:00Z"),
      },
    });
    createdLeadIds.add(lead2.id);

    const convo2 = await testPrisma.conversation.create({
      data: {
        leadId: lead2.id,
        language: ConversationLanguage.EN,
        startedAt: new Date("2026-11-08T10:00:00Z"),
      },
    });
    createdConvoIds.add(convo2.id);

    const handoff2 = await testPrisma.handoff.create({
      data: {
        conversationId: convo2.id,
        status: HandoffStatus.ASSIGNED,
        escalationReason: EscalationReason.PRICE_NEGOTIATION,
        summary: "Lead negotiated price on Hoarding billboard promo",
        assignedToId: assignedExec.id,
      },
    });
    createdHandoffIds.add(handoff2.id);

    // Query analytics as assignedExec
    const execAnalytics = await service.getSourceAnalytics(
      { monthYear: TEST_MONTH },
      assignedExec
    );

    // Spend must be completely restricted
    expect(execAnalytics.summary.isSpendRestricted).toBe(true);
    expect(execAnalytics.summary.totalSpendRupees).toBeNull();
    expect(execAnalytics.summary.overallCPLRupees).toBeNull();
    expect(execAnalytics.summary.overallCPVAttendedRupees).toBeNull();

    for (const s of execAnalytics.sources) {
      expect(s.spendRupees).toBeNull();
      expect(s.spendPaise).toBeNull();
      expect(s.costPerLeadRupees).toBeNull();
    }

    // Lead 2 is assigned, so Hoarding Call has at least 1 lead
    const hoardingSource = execAnalytics.sources.find((s) => s.source === LeadSource.HOARDING_CALL)!;
    expect(hoardingSource.totalLeads).toBeGreaterThanOrEqual(1);

    // Query analytics as unassignedExec (who has 0 assigned leads)
    const otherExecAnalytics = await service.getSourceAnalytics(
      { monthYear: TEST_MONTH },
      unassignedExec
    );

    expect(otherExecAnalytics.summary.isSpendRestricted).toBe(true);
    expect(otherExecAnalytics.summary.totalDistinctLeads).toBe(0);
    expect(otherExecAnalytics.summary.totalBookedVisits).toBe(0);
    expect(otherExecAnalytics.summary.totalAttendedVisits).toBe(0);
  });
});
