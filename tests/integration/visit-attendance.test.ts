import { describe, it, expect, afterAll } from "vitest";
import {
  UserRole,
  VisitSlotStatus,
  BookingStatus,
  AttendanceOutcome,
  LeadSource,
  HandoffStatus,
  EscalationReason,
} from "@prisma/client";
import { BookingService } from "@/services/booking/booking.service";
import { LeadService } from "@/services/lead/lead.service";
import { testPrisma, disconnectTestPrisma } from "../helpers/testPrisma";

describe("Site Visits & Attendance Integration Tests (Isolated Neon Test Branch)", () => {
  const bookingService = new BookingService(testPrisma);
  const leadService = new LeadService(testPrisma);

  const createdSlotIds = new Set<string>();
  const createdVisitIds = new Set<string>();
  const createdLeadIds = new Set<string>();
  const createdUserIds = new Set<string>();

  const TEST_RUN_ID = Date.now().toString().slice(-6);

  let salesHead: { id: string; role: UserRole };
  let assignedExec: { id: string; role: UserRole };
  let unassignedExec: { id: string; role: UserRole };

  let testSlotId: string;
  let testLeadId: string;
  let testVisitId: string;

  afterAll(async () => {
    // 1. Delete reminders
    if (createdVisitIds.size > 0) {
      await testPrisma.reminderJob.deleteMany({
        where: { siteVisitId: { in: Array.from(createdVisitIds) } },
      });
      // 2. Delete site visits
      await testPrisma.siteVisit.deleteMany({
        where: { id: { in: Array.from(createdVisitIds) } },
      });
    }

    // 3. Delete slots
    if (createdSlotIds.size > 0) {
      await testPrisma.visitSlot.deleteMany({
        where: { id: { in: Array.from(createdSlotIds) } },
      });
    }

    // 4. Delete handoffs, messages, conversations, and leads
    if (createdLeadIds.size > 0) {
      const convos = await testPrisma.conversation.findMany({
        where: { leadId: { in: Array.from(createdLeadIds) } },
        select: { id: true },
      });
      const convoIds = convos.map((c) => c.id);

      if (convoIds.length > 0) {
        await testPrisma.handoff.deleteMany({
          where: { conversationId: { in: convoIds } },
        });
        await testPrisma.chatMessage.deleteMany({
          where: { conversationId: { in: convoIds } },
        });
        await testPrisma.conversation.deleteMany({
          where: { id: { in: convoIds } },
        });
      }

      await testPrisma.leadSourceEvent.deleteMany({
        where: { leadId: { in: Array.from(createdLeadIds) } },
      });
      await testPrisma.lead.deleteMany({
        where: { id: { in: Array.from(createdLeadIds) } },
      });
    }

    // 5. Delete test staff users
    if (createdUserIds.size > 0) {
      await testPrisma.staffSession.deleteMany({
        where: { userId: { in: Array.from(createdUserIds) } },
      });
      await testPrisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
    }

    await disconnectTestPrisma();
  });

  it("0. Prepares test staff users and assigned buyer lead", async () => {
    // Create Sales Head
    const head = await testPrisma.user.create({
      data: {
        email: `visit-head-${TEST_RUN_ID}@enquivo.test`,
        name: "Test Visit Head",
        role: UserRole.SALES_HEAD,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
    });
    createdUserIds.add(head.id);
    salesHead = { id: head.id, role: head.role };

    // Create Assigned Sales Executive
    const exec1 = await testPrisma.user.create({
      data: {
        email: `visit-exec1-${TEST_RUN_ID}@enquivo.test`,
        name: "Assigned Exec",
        role: UserRole.SALES_EXEC,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
    });
    createdUserIds.add(exec1.id);
    assignedExec = { id: exec1.id, role: exec1.role };

    // Create Rival Unassigned Sales Executive
    const exec2 = await testPrisma.user.create({
      data: {
        email: `visit-exec2-${TEST_RUN_ID}@enquivo.test`,
        name: "Unassigned Exec",
        role: UserRole.SALES_EXEC,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
    });
    createdUserIds.add(exec2.id);
    unassignedExec = { id: exec2.id, role: exec2.role };

    // Create Buyer Lead
    const lead = await testPrisma.lead.create({
      data: {
        leadCode: `LD-VT-${TEST_RUN_ID}`,
        name: "Darshan Mehta",
        phone: `+9199${TEST_RUN_ID}0001`,
        source: LeadSource.WEBSITE,
      },
    });
    createdLeadIds.add(lead.id);
    testLeadId = lead.id;

    // Create Conversation with Handoff assigned to assignedExec
    const convo = await testPrisma.conversation.create({
      data: {
        leadId: lead.id,
      },
    });

    await testPrisma.handoff.create({
      data: {
        conversationId: convo.id,
        escalationReason: EscalationReason.PRICE_NEGOTIATION,
        summary: "Lead negotiated price, assigned to Executive 1",
        status: HandoffStatus.ASSIGNED,
        assignedToId: assignedExec.id,
      },
    });

    expect(lead.id).toBeDefined();
  });

  it("1. SALES_HEAD creates a future site-visit slot with 1-capacity reservation", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startsAt = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);
    const endsAt = new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000);

    const slot = await bookingService.createSlot(
      {
        startsAt,
        endsAt,
        location: "Enquivo Sales Gallery, Ahmedabad",
      },
      salesHead
    );

    createdSlotIds.add(slot.id);
    testSlotId = slot.id;

    expect(slot.status).toBe(VisitSlotStatus.AVAILABLE);
    expect(slot.hasConfirmedBooking).toBe(false);
    expect(slot.startsAtIST).toContain("IST");
  });

  it("2. Modifying an unbooked slot succeeds; modifying when confirmed booking exists is blocked", async () => {
    // 2a. Modify unbooked slot
    const updated = await bookingService.updateSlot(
      testSlotId,
      { location: "Enquivo Experience Lounge, Ahmedabad" },
      salesHead
    );
    expect(updated.location).toBe("Enquivo Experience Lounge, Ahmedabad");

    // 2b. Book the slot
    const { visit } = await bookingService.bookVisit({
      slotId: testSlotId,
      leadId: testLeadId,
    });
    createdVisitIds.add(visit.id);
    testVisitId = visit.id;

    // 2c. Now try modifying the booked slot -> should fail with BookingConflictError
    await expect(
      bookingService.updateSlot(
        testSlotId,
        { location: "Unauthorized Relocation" },
        salesHead
      )
    ).rejects.toThrow("Cannot modify an appointment slot with an active confirmed booking");
  });

  it("3. Slot deletion is rejected when booking history exists", async () => {
    await expect(
      bookingService.deleteSlot(testSlotId, salesHead)
    ).rejects.toThrow("Cannot delete an appointment slot with booking history");
  });

  it("4. Anti-IDOR attendance scoping: unassigned SALES_EXEC is forbidden from recording attendance", async () => {
    // Attempting to record attendance by unassignedExec on lead assigned to assignedExec
    await expect(
      bookingService.recordAttendance(
        {
          visitId: testVisitId,
          outcome: AttendanceOutcome.ATTENDED,
        },
        unassignedExec
      )
    ).rejects.toThrow("You are not authorized to record attendance for a lead assigned to another executive");
  });

  it("5. Assigned SALES_EXEC successfully records attendance as ATTENDED", async () => {
    // Update the visit slot to past start time in isolated database so temporal guard passes
    const pastTime = new Date(Date.now() - 3600000);
    await testPrisma.visitSlot.update({
      where: { id: testSlotId },
      data: { startsAt: pastTime },
    });

    const recorded = await bookingService.recordAttendance(
      {
        visitId: testVisitId,
        outcome: AttendanceOutcome.ATTENDED,
      },
      assignedExec
    );

    expect(recorded.bookingStatus).toBe(BookingStatus.COMPLETED);
    expect(recorded.attendanceOutcome).toBe(AttendanceOutcome.ATTENDED);
    expect(recorded.attendedAt).not.toBeNull();

    // Verify in database
    const dbVisit = await testPrisma.siteVisit.findUnique({
      where: { id: testVisitId },
    });
    expect(dbVisit?.bookingStatus).toBe(BookingStatus.COMPLETED);
    expect(dbVisit?.attendanceOutcome).toBe(AttendanceOutcome.ATTENDED);
  });

  it("6. Dynamic lifecycle verification: lead lifecycle stage automatically transitions to VISITED", async () => {
    const result = await leadService.getLeads(
      {
        search: TEST_RUN_ID,
        page: 1,
        limit: 10,
        status: "ALL",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      salesHead
    );

    const leadItem = result.leads.find((l) => l.id === testLeadId);
    expect(leadItem).toBeDefined();
    expect(leadItem?.status).toBe("VISITED");
  });

  it("7. Legitimate attendance corrections: allows correcting between ATTENDED and NO_SHOW with consistent timestamp semantics", async () => {
    // 1. Correct from ATTENDED (from Test 5) to NO_SHOW: attendedAt must become null
    const correctedToNoShow = await bookingService.recordAttendance(
      {
        visitId: testVisitId,
        outcome: AttendanceOutcome.NO_SHOW,
      },
      salesHead
    );

    expect(correctedToNoShow.bookingStatus).toBe(BookingStatus.COMPLETED);
    expect(correctedToNoShow.attendanceOutcome).toBe(AttendanceOutcome.NO_SHOW);
    expect(correctedToNoShow.attendedAt).toBeNull();

    // Verify in database directly
    const dbNoShow = await testPrisma.siteVisit.findUniqueOrThrow({
      where: { id: testVisitId },
    });
    expect(dbNoShow.attendanceOutcome).toBe(AttendanceOutcome.NO_SHOW);
    expect(dbNoShow.attendedAt).toBeNull();

    // 2. Correct back from NO_SHOW to ATTENDED: attendedAt must be set to current timestamp
    const correctedToAttended = await bookingService.recordAttendance(
      {
        visitId: testVisitId,
        outcome: AttendanceOutcome.ATTENDED,
      },
      salesHead
    );

    expect(correctedToAttended.bookingStatus).toBe(BookingStatus.COMPLETED);
    expect(correctedToAttended.attendanceOutcome).toBe(AttendanceOutcome.ATTENDED);
    expect(correctedToAttended.attendedAt).not.toBeNull();

    // Verify in database directly
    const dbAttended = await testPrisma.siteVisit.findUniqueOrThrow({
      where: { id: testVisitId },
    });
    expect(dbAttended.attendanceOutcome).toBe(AttendanceOutcome.ATTENDED);
    expect(dbAttended.attendedAt).not.toBeNull();

    // 3. Idempotent submission: submitting same outcome succeeds and preserves existing timestamp
    const idempotentResult = await bookingService.recordAttendance(
      {
        visitId: testVisitId,
        outcome: AttendanceOutcome.ATTENDED,
      },
      salesHead
    );
    expect(idempotentResult.id).toBe(testVisitId);
    expect(idempotentResult.attendanceOutcome).toBe(AttendanceOutcome.ATTENDED);
  });

  it("8. Role scoping in getVisits: SALES_HEAD sees all visits, SALES_EXEC only sees assigned leads", async () => {
    // SALES_HEAD queries
    const headResult = await bookingService.getVisits(
      {
        timeframe: "ALL",
        bookingStatus: "ALL",
        attendanceOutcome: "ALL",
        search: TEST_RUN_ID,
        page: 1,
        limit: 10,
      },
      salesHead
    );
    expect(headResult.visits.some((v) => v.id === testVisitId)).toBe(true);

    // Assigned executive queries
    const assignedResult = await bookingService.getVisits(
      {
        timeframe: "ALL",
        bookingStatus: "ALL",
        attendanceOutcome: "ALL",
        search: TEST_RUN_ID,
        page: 1,
        limit: 10,
      },
      assignedExec
    );
    expect(assignedResult.visits.some((v) => v.id === testVisitId)).toBe(true);

    // Unassigned executive queries -> should NOT find this visit
    const unassignedResult = await bookingService.getVisits(
      {
        timeframe: "ALL",
        bookingStatus: "ALL",
        attendanceOutcome: "ALL",
        search: TEST_RUN_ID,
        page: 1,
        limit: 10,
      },
      unassignedExec
    );
    expect(unassignedResult.visits.some((v) => v.id === testVisitId)).toBe(false);
  });
});
