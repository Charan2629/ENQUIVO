import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  UserRole,
  LeadSource,
  BookingStatus,
  AttendanceOutcome,
  VisitSlotStatus,
  EscalationReason,
  HandoffStatus,
} from "@prisma/client";
import { LeadService } from "@/services/lead/lead.service";
import { testPrisma, disconnectTestPrisma } from "../helpers/testPrisma";
import { hash } from "@node-rs/argon2";

describe("Lead Pipeline Integration Tests (Isolated Neon Test Branch)", () => {
  const leadService = new LeadService(testPrisma);

  const createdUserIds = new Set<string>();
  const createdLeadIds = new Set<string>();
  const createdSlotIds = new Set<string>();
  const createdVisitIds = new Set<string>();
  const createdConvIds = new Set<string>();
  const createdHandoffIds = new Set<string>();

  const RUN_ID = Date.now().toString().slice(-6);
  const phoneFor = (suffix: number) => `+9198${RUN_ID}${suffix.toString().padStart(2, "0")}`;

  let headUser: { id: string; role: UserRole };
  let exec1User: { id: string; role: UserRole };
  let exec2User: { id: string; role: UserRole };
  let testProject: { id: string; name: string };

  let leadAssigned: { id: string; leadCode: string };
  let leadUnassigned: { id: string; leadCode: string };
  let leadBooked: { id: string; leadCode: string };
  let leadVisited: { id: string; leadCode: string };

  beforeAll(async () => {
    const dummyPasswordHash = await hash("TestPass#2026!");

    // 1. Create Test Staff Users
    const head = await testPrisma.user.create({
      data: {
        email: `head-${RUN_ID}@enquivo.test`,
        name: `Test Head ${RUN_ID}`,
        passwordHash: dummyPasswordHash,
        role: UserRole.SALES_HEAD,
      },
    });
    createdUserIds.add(head.id);
    headUser = { id: head.id, role: head.role };

    const exec1 = await testPrisma.user.create({
      data: {
        email: `exec1-${RUN_ID}@enquivo.test`,
        name: `Test Exec 1 ${RUN_ID}`,
        passwordHash: dummyPasswordHash,
        role: UserRole.SALES_EXEC,
      },
    });
    createdUserIds.add(exec1.id);
    exec1User = { id: exec1.id, role: exec1.role };

    const exec2 = await testPrisma.user.create({
      data: {
        email: `exec2-${RUN_ID}@enquivo.test`,
        name: `Test Exec 2 ${RUN_ID}`,
        passwordHash: dummyPasswordHash,
        role: UserRole.SALES_EXEC,
      },
    });
    createdUserIds.add(exec2.id);
    exec2User = { id: exec2.id, role: exec2.role };

    // 2. Fetch or create test project
    let proj = await testPrisma.project.findFirst();
    if (!proj) {
      proj = await testPrisma.project.create({
        data: {
          name: `Pipeline Heights ${RUN_ID}`,
          location: "SG Highway, Ahmedabad",
          totalUnits: 150,
        },
      });
    }
    testProject = { id: proj.id, name: proj.name };

    // 3. Create 4 Test Leads in distinct lifecycle stages
    // Lead A: Assigned to Exec 1 via Handoff (Status: ESCALATED)
    const lA = await testPrisma.lead.create({
      data: {
        leadCode: `LD-TEST-${RUN_ID}-A`,
        name: `Assigned Buyer ${RUN_ID}`,
        phone: phoneFor(1),
        email: `assigned-${RUN_ID}@test.com`,
        source: LeadSource.PROPERTY_PORTAL,
        projectId: testProject.id,
        configuration: "3 BHK",
        firstResponseAt: new Date(),
      },
    });
    createdLeadIds.add(lA.id);
    leadAssigned = { id: lA.id, leadCode: lA.leadCode };

    await testPrisma.leadSourceEvent.create({
      data: {
        leadId: lA.id,
        source: LeadSource.PROPERTY_PORTAL,
        campaign: "Housing Oct Premium",
      },
    });

    const convA = await testPrisma.conversation.create({
      data: {
        leadId: lA.id,
      },
    });
    createdConvIds.add(convA.id);

    const handoffA = await testPrisma.handoff.create({
      data: {
        conversationId: convA.id,
        escalationReason: EscalationReason.PRICE_NEGOTIATION,
        summary: "Buyer requested discount discussion",
        status: HandoffStatus.ASSIGNED,
        assignedToId: exec1User.id,
      },
    });
    createdHandoffIds.add(handoffA.id);

    // Lead B: Unassigned, new inquiry without conversation or visits (Status: NEW)
    const lB = await testPrisma.lead.create({
      data: {
        leadCode: `LD-TEST-${RUN_ID}-B`,
        name: `Unassigned Buyer ${RUN_ID}`,
        phone: phoneFor(2),
        email: `unassigned-${RUN_ID}@test.com`,
        source: LeadSource.WEBSITE,
        projectId: testProject.id,
        configuration: "2 BHK",
        firstResponseAt: null,
      },
    });
    createdLeadIds.add(lB.id);
    leadUnassigned = { id: lB.id, leadCode: lB.leadCode };

    await testPrisma.leadSourceEvent.create({
      data: {
        leadId: lB.id,
        source: LeadSource.WEBSITE,
        campaign: "Organic Direct",
      },
    });

    // Lead C: Booked Site Visit (Status: BOOKED)
    const lC = await testPrisma.lead.create({
      data: {
        leadCode: `LD-TEST-${RUN_ID}-C`,
        name: `Booked Buyer ${RUN_ID}`,
        phone: phoneFor(3),
        email: `booked-${RUN_ID}@test.com`,
        source: LeadSource.SOCIAL_MEDIA_AD,
        projectId: testProject.id,
        configuration: "3 BHK",
        firstResponseAt: new Date(),
      },
    });
    createdLeadIds.add(lC.id);
    leadBooked = { id: lC.id, leadCode: lC.leadCode };

    const slotC = await testPrisma.visitSlot.create({
      data: {
        startsAt: new Date(Date.now() + 86400000), // tomorrow
        endsAt: new Date(Date.now() + 90000000),
        status: VisitSlotStatus.BOOKED,
      },
    });
    createdSlotIds.add(slotC.id);

    const visitC = await testPrisma.siteVisit.create({
      data: {
        slotId: slotC.id,
        leadId: lC.id,
        bookingStatus: BookingStatus.CONFIRMED,
        attendanceOutcome: AttendanceOutcome.UNRECORDED,
      },
    });
    createdVisitIds.add(visitC.id);

    // Lead D: Attended Site Visit (Status: VISITED)
    const lD = await testPrisma.lead.create({
      data: {
        leadCode: `LD-TEST-${RUN_ID}-D`,
        name: `Visited Buyer ${RUN_ID}`,
        phone: phoneFor(4),
        email: `visited-${RUN_ID}@test.com`,
        source: LeadSource.HOARDING_CALL,
        projectId: testProject.id,
        configuration: "2 BHK",
        firstResponseAt: new Date(),
      },
    });
    createdLeadIds.add(lD.id);
    leadVisited = { id: lD.id, leadCode: lD.leadCode };

    const slotD = await testPrisma.visitSlot.create({
      data: {
        startsAt: new Date(Date.now() - 86400000), // yesterday
        endsAt: new Date(Date.now() - 82800000),
        status: VisitSlotStatus.BOOKED,
      },
    });
    createdSlotIds.add(slotD.id);

    const visitD = await testPrisma.siteVisit.create({
      data: {
        slotId: slotD.id,
        leadId: lD.id,
        bookingStatus: BookingStatus.COMPLETED,
        attendanceOutcome: AttendanceOutcome.ATTENDED,
        attendedAt: new Date(Date.now() - 85000000),
      },
    });
    createdVisitIds.add(visitD.id);
  });

  afterAll(async () => {
    // Teardown in foreign key dependency order
    const leadIds = Array.from(createdLeadIds);
    const visitIds = Array.from(createdVisitIds);
    const slotIds = Array.from(createdSlotIds);
    const handoffIds = Array.from(createdHandoffIds);
    const convIds = Array.from(createdConvIds);
    const userIds = Array.from(createdUserIds);

    if (visitIds.length > 0) {
      await testPrisma.reminderJob.deleteMany({ where: { siteVisitId: { in: visitIds } } });
      await testPrisma.siteVisit.deleteMany({ where: { id: { in: visitIds } } });
    }
    if (slotIds.length > 0) {
      await testPrisma.visitSlot.deleteMany({ where: { id: { in: slotIds } } });
    }
    if (handoffIds.length > 0) {
      await testPrisma.handoff.deleteMany({ where: { id: { in: handoffIds } } });
    }
    if (convIds.length > 0) {
      await testPrisma.chatMessage.deleteMany({ where: { conversationId: { in: convIds } } });
      await testPrisma.conversation.deleteMany({ where: { id: { in: convIds } } });
    }
    if (leadIds.length > 0) {
      await testPrisma.consentRecord.deleteMany({ where: { leadId: { in: leadIds } } });
      await testPrisma.leadSourceEvent.deleteMany({ where: { leadId: { in: leadIds } } });
      await testPrisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    }
    if (userIds.length > 0) {
      await testPrisma.staffSession.deleteMany({ where: { userId: { in: userIds } } });
      await testPrisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await disconnectTestPrisma();
  });

  it("1. SALES_HEAD retrieves all leads with pagination metadata", async () => {
    const result = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        status: "ALL",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );

    expect(result.leads.length).toBeGreaterThanOrEqual(4);
    expect(result.pagination.total).toBeGreaterThanOrEqual(4);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(10);
    expect(result.pagination.totalPages).toBeGreaterThanOrEqual(1);

    const leadCodes = result.leads.map((l) => l.leadCode);
    expect(leadCodes).toContain(leadAssigned.leadCode);
    expect(leadCodes).toContain(leadUnassigned.leadCode);
    expect(leadCodes).toContain(leadBooked.leadCode);
    expect(leadCodes).toContain(leadVisited.leadCode);
  });

  it("2. SALES_EXEC record scoping strictly restricts results to assigned leads", async () => {
    // Exec 1 has Lead A assigned via Handoff
    const resultExec1 = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        status: "ALL",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      exec1User
    );

    expect(resultExec1.pagination.total).toBe(1);
    expect(resultExec1.leads.length).toBe(1);
    expect(resultExec1.leads[0].id).toBe(leadAssigned.id);
    expect(resultExec1.leads[0].leadCode).toBe(leadAssigned.leadCode);

    // Exec 2 has NO leads assigned
    const resultExec2 = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        status: "ALL",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      exec2User
    );

    expect(resultExec2.pagination.total).toBe(0);
    expect(resultExec2.leads.length).toBe(0);
  });

  it("3. keyword search filters by leadCode, name, phone, or email", async () => {
    // Search by leadCode
    const resByCode = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: leadAssigned.leadCode,
        status: "ALL",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resByCode.leads.length).toBe(1);
    expect(resByCode.leads[0].id).toBe(leadAssigned.id);

    // Search by phone substring
    const resByPhone = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: phoneFor(3),
        status: "ALL",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resByPhone.leads.length).toBe(1);
    expect(resByPhone.leads[0].id).toBe(leadBooked.id);

    // Case-insensitive name search
    const resByName = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: `visited buyer ${RUN_ID}`.toLowerCase(),
        status: "ALL",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resByName.leads.length).toBe(1);
    expect(resByName.leads[0].id).toBe(leadVisited.id);
  });

  it("4. filters by lifecycle status correctly across all 5 stages", async () => {
    // Filter VISITED
    const resVisited = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: RUN_ID,
        status: "VISITED",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resVisited.leads.length).toBe(1);
    expect(resVisited.leads[0].status).toBe("VISITED");
    expect(resVisited.leads[0].id).toBe(leadVisited.id);

    // Filter BOOKED
    const resBooked = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: RUN_ID,
        status: "BOOKED",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resBooked.leads.length).toBe(1);
    expect(resBooked.leads[0].status).toBe("BOOKED");
    expect(resBooked.leads[0].id).toBe(leadBooked.id);

    // Filter ESCALATED
    const resEscalated = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: RUN_ID,
        status: "ESCALATED",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resEscalated.leads.length).toBe(1);
    expect(resEscalated.leads[0].status).toBe("ESCALATED");
    expect(resEscalated.leads[0].id).toBe(leadAssigned.id);

    // Filter NEW
    const resNew = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: RUN_ID,
        status: "NEW",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resNew.leads.length).toBe(1);
    expect(resNew.leads[0].status).toBe("NEW");
    expect(resNew.leads[0].id).toBe(leadUnassigned.id);
  });

  it("5. filters by acquisition channel (source)", async () => {
    const resPortal = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: RUN_ID,
        source: LeadSource.PROPERTY_PORTAL,
        status: "ALL",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );

    expect(resPortal.leads.length).toBe(1);
    expect(resPortal.leads[0].source).toBe(LeadSource.PROPERTY_PORTAL);
    expect(resPortal.leads[0].id).toBe(leadAssigned.id);
  });

  it("6. lead detail retrieval enforces server-side role scoping and IDOR prevention", async () => {
    // SALES_HEAD can fetch any lead detail
    const detailHead = await leadService.getLeadDetail(leadUnassigned.id, headUser);
    expect(detailHead).not.toBeNull();
    expect(detailHead?.id).toBe(leadUnassigned.id);
    expect(detailHead?.leadCode).toBe(leadUnassigned.leadCode);
    expect(detailHead?.sourceEvents.length).toBeGreaterThanOrEqual(1);

    // SALES_EXEC_1 can fetch their assigned lead
    const detailExecAssigned = await leadService.getLeadDetail(leadAssigned.id, exec1User);
    expect(detailExecAssigned).not.toBeNull();
    expect(detailExecAssigned?.id).toBe(leadAssigned.id);
    expect(detailExecAssigned?.conversations[0]?.handoff?.assignedToId).toBe(exec1User.id);

    // SALES_EXEC_1 attempting to access unassigned lead returns null (404 behavior, zero info leak)
    const detailExecForbidden = await leadService.getLeadDetail(leadUnassigned.id, exec1User);
    expect(detailExecForbidden).toBeNull();

    // Non-existent ID returns null
    const detailMissing = await leadService.getLeadDetail("non-existent-id-9999", headUser);
    expect(detailMissing).toBeNull();
  });

  it("7. getLeadMetrics computes live database figures without hardcoding", async () => {
    const headMetrics = await leadService.getLeadMetrics(headUser);

    expect(headMetrics.totalLeads).toBeGreaterThanOrEqual(4);
    expect(headMetrics.byStatus.VISITED).toBeGreaterThanOrEqual(1);
    expect(headMetrics.byStatus.BOOKED).toBeGreaterThanOrEqual(1);
    expect(headMetrics.byStatus.ESCALATED).toBeGreaterThanOrEqual(1);
    expect(headMetrics.byStatus.NEW).toBeGreaterThanOrEqual(1);

    expect(headMetrics.bySource[LeadSource.PROPERTY_PORTAL]).toBeGreaterThanOrEqual(1);
    expect(headMetrics.bySource[LeadSource.WEBSITE]).toBeGreaterThanOrEqual(1);
    expect(headMetrics.bySource[LeadSource.SOCIAL_MEDIA_AD]).toBeGreaterThanOrEqual(1);
    expect(headMetrics.bySource[LeadSource.HOARDING_CALL]).toBeGreaterThanOrEqual(1);

    // Scoped metrics for Exec 1 (only 1 assigned lead)
    const execMetrics = await leadService.getLeadMetrics(exec1User);
    expect(execMetrics.totalLeads).toBe(1);
    expect(execMetrics.byStatus.ESCALATED).toBe(1);
    expect(execMetrics.byStatus.VISITED).toBe(0);
    expect(execMetrics.byStatus.BOOKED).toBe(0);
  });

  it("8. handles cancelled visits and multi-visit transitions accurately", async () => {
    // Create Lead E with only a CANCELLED visit
    const leadE = await testPrisma.lead.create({
      data: {
        leadCode: `LD-TEST-${RUN_ID}-E`,
        name: `Cancelled Lead ${RUN_ID}`,
        phone: phoneFor(5),
        source: LeadSource.WEBSITE,
        projectId: testProject.id,
        firstResponseAt: null,
      },
    });
    createdLeadIds.add(leadE.id);

    const slotE1 = await testPrisma.visitSlot.create({
      data: {
        startsAt: new Date(Date.now() + 172800000),
        endsAt: new Date(Date.now() + 176400000),
        status: VisitSlotStatus.AVAILABLE,
      },
    });
    createdSlotIds.add(slotE1.id);

    const visitE1 = await testPrisma.siteVisit.create({
      data: {
        slotId: slotE1.id,
        leadId: leadE.id,
        bookingStatus: BookingStatus.CANCELLED,
        attendanceOutcome: AttendanceOutcome.UNRECORDED,
      },
    });
    createdVisitIds.add(visitE1.id);

    // Filter ENGAGED: should find Lead E
    const resEngaged = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: `Cancelled Lead ${RUN_ID}`,
        status: "ENGAGED",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resEngaged.leads.length).toBe(1);
    expect(resEngaged.leads[0].id).toBe(leadE.id);
    expect(resEngaged.leads[0].status).toBe("ENGAGED");

    // Filter BOOKED: should NOT include Lead E
    const resBooked = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: `Cancelled Lead ${RUN_ID}`,
        status: "BOOKED",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resBooked.leads.length).toBe(0);

    // Now re-book Lead E with a second CONFIRMED visit
    const slotE2 = await testPrisma.visitSlot.create({
      data: {
        startsAt: new Date(Date.now() + 259200000),
        endsAt: new Date(Date.now() + 262800000),
        status: VisitSlotStatus.BOOKED,
      },
    });
    createdSlotIds.add(slotE2.id);

    const visitE2 = await testPrisma.siteVisit.create({
      data: {
        slotId: slotE2.id,
        leadId: leadE.id,
        bookingStatus: BookingStatus.CONFIRMED,
        attendanceOutcome: AttendanceOutcome.UNRECORDED,
      },
    });
    createdVisitIds.add(visitE2.id);

    // Now Lead E should be classified and filtered as BOOKED
    const resRebooked = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: `Cancelled Lead ${RUN_ID}`,
        status: "BOOKED",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resRebooked.leads.length).toBe(1);
    expect(resRebooked.leads[0].id).toBe(leadE.id);
    expect(resRebooked.leads[0].status).toBe("BOOKED");
  });

  it("9. verifies getLeadMetrics byStatus.ESCALATED counts currently escalated leads and excludes leads that subsequently booked a visit", async () => {
    // 1. Initial baseline
    const metricsBase = await leadService.getLeadMetrics(headUser);

    // 2. Create Lead F with Conversation and Handoff (Status: ESCALATED)
    const leadF = await testPrisma.lead.create({
      data: {
        leadCode: `LD-TEST-${RUN_ID}-F`,
        name: `Escalated Buyer ${RUN_ID}`,
        phone: phoneFor(6),
        source: LeadSource.WEBSITE,
        projectId: testProject.id,
        firstResponseAt: new Date(),
      },
    });
    createdLeadIds.add(leadF.id);

    const convF = await testPrisma.conversation.create({
      data: {
        leadId: leadF.id,
      },
    });
    createdConvIds.add(convF.id);

    const handoffF = await testPrisma.handoff.create({
      data: {
        conversationId: convF.id,
        status: HandoffStatus.ASSIGNED,
        escalationReason: EscalationReason.PRICE_NEGOTIATION,
        summary: "Inquiring about 3 BHK pricing discounts",
        assignedToId: exec1User.id,
      },
    });
    createdHandoffIds.add(handoffF.id);

    // Verify Escalated Leads metric increments by 1
    const metricsWithHandoff = await leadService.getLeadMetrics(headUser);
    expect(metricsWithHandoff.byStatus.ESCALATED).toBe(metricsBase.byStatus.ESCALATED + 1);

    // Verify leadF matches ESCALATED filter and does not match BOOKED filter
    const resEscBefore = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: leadF.leadCode,
        status: "ESCALATED",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resEscBefore.leads.length).toBe(1);
    expect(resEscBefore.leads[0].id).toBe(leadF.id);

    const resBookBefore = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: leadF.leadCode,
        status: "BOOKED",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resBookBefore.leads.length).toBe(0);

    // 3. Buyer subsequently books a visit (Status transitions: ESCALATED -> BOOKED)
    const slotF = await testPrisma.visitSlot.create({
      data: {
        startsAt: new Date(Date.now() + 345600000),
        endsAt: new Date(Date.now() + 349200000),
        status: VisitSlotStatus.BOOKED,
      },
    });
    createdSlotIds.add(slotF.id);

    const visitF = await testPrisma.siteVisit.create({
      data: {
        slotId: slotF.id,
        leadId: leadF.id,
        bookingStatus: BookingStatus.CONFIRMED,
        attendanceOutcome: AttendanceOutcome.UNRECORDED,
      },
    });
    createdVisitIds.add(visitF.id);

    // Verify Escalated Leads metric decrements back to base (lead is no longer in ESCALATED lifecycle stage)
    const metricsAfterBooking = await leadService.getLeadMetrics(headUser);
    expect(metricsAfterBooking.byStatus.ESCALATED).toBe(metricsBase.byStatus.ESCALATED);
    expect(metricsAfterBooking.byStatus.BOOKED).toBeGreaterThanOrEqual(metricsBase.byStatus.BOOKED + 1);

    // Verify leadF now matches BOOKED filter and NO LONGER matches ESCALATED filter
    const resEscAfter = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: leadF.leadCode,
        status: "ESCALATED",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resEscAfter.leads.length).toBe(0);

    const resBookAfter = await leadService.getLeads(
      {
        page: 1,
        limit: 10,
        search: leadF.leadCode,
        status: "BOOKED",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      headUser
    );
    expect(resBookAfter.leads.length).toBe(1);
    expect(resBookAfter.leads[0].id).toBe(leadF.id);
    expect(resBookAfter.leads[0].status).toBe("BOOKED");
  });
});
