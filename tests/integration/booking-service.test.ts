import { describe, it, expect, afterAll } from "vitest";
import {
  BookingStatus,
  AttendanceOutcome,
  VisitSlotStatus,
  ReminderType,
  ReminderStatus,
  LeadSource,
} from "@prisma/client";
import {
  BookingService,
  SlotUnavailableError,
  BookingConflictError,
} from "@/services/booking/booking.service";
import { testPrisma, disconnectTestPrisma } from "../helpers/testPrisma";

describe("BookingService Integration Tests (Isolated Neon Test Branch)", () => {
  const bookingService = new BookingService(testPrisma);

  // Track created entity IDs for deterministic, safe cleanup
  const createdSlotIds = new Set<string>();
  const createdVisitIds = new Set<string>();
  const createdLeadIds = new Set<string>();

  // Unique run identifier for test data
  const TEST_RUN_ID = Date.now().toString().slice(-6);

  // Helper to create a test lead
  async function createTestLead(name: string, phoneSuffix: number) {
    const lead = await testPrisma.lead.create({
      data: {
        leadCode: `LD-BK-${TEST_RUN_ID}-${phoneSuffix.toString().padStart(4, "0")}`,
        name,
        phone: `+9198${TEST_RUN_ID}${phoneSuffix.toString().padStart(4, "0")}`,
        source: LeadSource.WEBSITE,
      },
    });
    createdLeadIds.add(lead.id);
    return lead;
  }

  // Helper to create a test slot
  async function createTestSlot(startsAt: Date, endsAt: Date, status: VisitSlotStatus = VisitSlotStatus.AVAILABLE) {
    const slot = await testPrisma.visitSlot.create({
      data: {
        startsAt,
        endsAt,
        status,
        location: "Enquivo Test Sales Gallery",
      },
    });
    createdSlotIds.add(slot.id);
    return slot;
  }

  afterAll(async () => {
    const visitIds = Array.from(createdVisitIds);
    const slotIds = Array.from(createdSlotIds);
    const leadIds = Array.from(createdLeadIds);

    // Respect foreign key hierarchy during teardown: reminders -> visits -> slots/leads
    if (visitIds.length > 0) {
      await testPrisma.reminderJob.deleteMany({ where: { siteVisitId: { in: visitIds } } });
      await testPrisma.siteVisit.deleteMany({ where: { id: { in: visitIds } } });
    }

    if (slotIds.length > 0) {
      await testPrisma.visitSlot.deleteMany({ where: { id: { in: slotIds } } });
    }

    if (leadIds.length > 0) {
      await testPrisma.leadSourceEvent.deleteMany({ where: { leadId: { in: leadIds } } });
      await testPrisma.consentRecord.deleteMany({ where: { leadId: { in: leadIds } } });
      await testPrisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    }

    await disconnectTestPrisma();
  });

  it("1. successfully books an available slot, sets status to BOOKED, creates SiteVisit, and stages ReminderJobs", async () => {
    const lead = await createTestLead("Booking Buyer 1", 1);

    // Slot 48 hours in the future -> both 24h and 2h reminders should be scheduled in the future
    const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const slot = await createTestSlot(startsAt, endsAt);

    const result = await bookingService.bookVisit({
      slotId: slot.id,
      leadId: lead.id,
    });

    createdVisitIds.add(result.visit.id);

    expect(result.visit.bookingStatus).toBe(BookingStatus.CONFIRMED);
    expect(result.visit.attendanceOutcome).toBe(AttendanceOutcome.UNRECORDED);
    expect(result.visit.slotId).toBe(slot.id);
    expect(result.visit.leadId).toBe(lead.id);

    // Verify VisitSlot updated to BOOKED in DB
    const dbSlot = await testPrisma.visitSlot.findUniqueOrThrow({
      where: { id: slot.id },
    });
    expect(dbSlot.status).toBe(VisitSlotStatus.BOOKED);

    // Verify 24h and 2h reminders were created
    const reminders = await testPrisma.reminderJob.findMany({
      where: { siteVisitId: result.visit.id },
      orderBy: { scheduledFor: "asc" },
    });

    expect(reminders).toHaveLength(2);
    expect(reminders[0].reminderType).toBe(ReminderType.REMINDER_24H);
    expect(reminders[0].status).toBe(ReminderStatus.PENDING);
    expect(reminders[1].reminderType).toBe(ReminderType.REMINDER_2H);
    expect(reminders[1].status).toBe(ReminderStatus.PENDING);
  });

  it("2. handles concurrent booking requests against the same slot via Promise.all (1 succeeds, 1 gets SlotUnavailableError)", async () => {
    const leadA = await createTestLead("Concurrent Lead A", 2);
    const leadB = await createTestLead("Concurrent Lead B", 3);

    const startsAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const slot = await createTestSlot(startsAt, endsAt);

    // Concurrently trigger both booking attempts
    const results = await Promise.allSettled([
      bookingService.bookVisit({ slotId: slot.id, leadId: leadA.id }),
      bookingService.bookVisit({ slotId: slot.id, leadId: leadB.id }),
    ]);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bookingService.bookVisit>>> =>
        r.status === "fulfilled"
    );
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    createdVisitIds.add(fulfilled[0].value.visit.id);

    // Verify rejection error type
    expect(rejected[0].reason).toBeInstanceOf(SlotUnavailableError);

    // Verify database integrity: exactly 1 CONFIRMED visit for this slot
    const visits = await testPrisma.siteVisit.findMany({
      where: { slotId: slot.id, bookingStatus: BookingStatus.CONFIRMED },
    });
    expect(visits).toHaveLength(1);
  });

  it("3. cancels a confirmed booking, marks CANCELLED, releases slot to AVAILABLE, and deletes PENDING reminders", async () => {
    const lead = await createTestLead("Cancellation Lead", 4);

    const startsAt = new Date(Date.now() + 96 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const slot = await createTestSlot(startsAt, endsAt);

    const { visit } = await bookingService.bookVisit({
      slotId: slot.id,
      leadId: lead.id,
    });
    createdVisitIds.add(visit.id);

    // Verify reminders exist before cancellation
    const preReminders = await testPrisma.reminderJob.findMany({
      where: { siteVisitId: visit.id },
    });
    expect(preReminders).toHaveLength(2);

    // Action: Cancel the booking
    const cancelledVisit = await bookingService.cancelBooking({
      visitId: visit.id,
    });

    expect(cancelledVisit.bookingStatus).toBe(BookingStatus.CANCELLED);
    expect(cancelledVisit.cancelledAt).not.toBeNull();

    // Verify slot released back to AVAILABLE
    const dbSlot = await testPrisma.visitSlot.findUniqueOrThrow({
      where: { id: slot.id },
    });
    expect(dbSlot.status).toBe(VisitSlotStatus.AVAILABLE);

    // Verify PENDING reminders were completely removed
    const postReminders = await testPrisma.reminderJob.findMany({
      where: { siteVisitId: visit.id },
    });
    expect(postReminders).toHaveLength(0);

    // Verify the historical SiteVisit record is preserved in database
    const preservedVisit = await testPrisma.siteVisit.findUniqueOrThrow({
      where: { id: visit.id },
    });
    expect(preservedVisit.bookingStatus).toBe(BookingStatus.CANCELLED);
  });

  it("4. supports rebooking a slot after cancellation while preserving historical cancelled visit", async () => {
    const leadA = await createTestLead("Rebook Lead A", 5);
    const leadB = await createTestLead("Rebook Lead B", 6);

    const startsAt = new Date(Date.now() + 120 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const slot = await createTestSlot(startsAt, endsAt);

    // 1. Lead A books
    const resA = await bookingService.bookVisit({
      slotId: slot.id,
      leadId: leadA.id,
    });
    createdVisitIds.add(resA.visit.id);

    // 2. Lead A cancels
    await bookingService.cancelBooking({ visitId: resA.visit.id });

    // 3. Lead B rebooks the same slot
    const resB = await bookingService.bookVisit({
      slotId: slot.id,
      leadId: leadB.id,
    });
    createdVisitIds.add(resB.visit.id);

    expect(resB.visit.bookingStatus).toBe(BookingStatus.CONFIRMED);
    expect(resB.visit.leadId).toBe(leadB.id);

    // Verify in database: exactly 2 SiteVisits for this slot (1 CANCELLED, 1 CONFIRMED)
    const slotVisits = await testPrisma.siteVisit.findMany({
      where: { slotId: slot.id },
      orderBy: { bookedAt: "asc" },
    });

    expect(slotVisits).toHaveLength(2);
    expect(slotVisits[0].id).toBe(resA.visit.id);
    expect(slotVisits[0].bookingStatus).toBe(BookingStatus.CANCELLED);
    expect(slotVisits[1].id).toBe(resB.visit.id);
    expect(slotVisits[1].bookingStatus).toBe(BookingStatus.CONFIRMED);
  });

  it("5. validates past slots, attendance recording (ATTENDED vs NO_SHOW), and handles COMPLETED + UNRECORDED visits", async () => {
    const lead = await createTestLead("Attendance Lead", 7);

    // 5A. Past slot booking rejection
    const pastStartsAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const pastEndsAt = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const pastSlot = await createTestSlot(pastStartsAt, pastEndsAt);

    await expect(
      bookingService.bookVisit({ slotId: pastSlot.id, leadId: lead.id })
    ).rejects.toThrow(BookingConflictError);

    // 5B. Record attendance on a visit whose time has arrived
    // Create a slot that started 30 minutes ago
    const startedSlot = await createTestSlot(
      new Date(Date.now() - 30 * 60 * 1000),
      new Date(Date.now() + 30 * 60 * 1000),
      VisitSlotStatus.BOOKED
    );

    // Create a CONFIRMED visit for this started slot
    const activeVisit = await testPrisma.siteVisit.create({
      data: {
        slotId: startedSlot.id,
        leadId: lead.id,
        bookingStatus: BookingStatus.CONFIRMED,
        attendanceOutcome: AttendanceOutcome.UNRECORDED,
      },
    });
    createdVisitIds.add(activeVisit.id);

    // Record attendance: ATTENDED
    const attendedVisit = await bookingService.recordAttendance({
      visitId: activeVisit.id,
      outcome: AttendanceOutcome.ATTENDED,
    });

    expect(attendedVisit.bookingStatus).toBe(BookingStatus.COMPLETED);
    expect(attendedVisit.attendanceOutcome).toBe(AttendanceOutcome.ATTENDED);
    expect(attendedVisit.attendedAt).not.toBeNull();

    // Verify slot remains BOOKED
    const dbSlot = await testPrisma.visitSlot.findUniqueOrThrow({
      where: { id: startedSlot.id },
    });
    expect(dbSlot.status).toBe(VisitSlotStatus.BOOKED);

    // Verify cannot record attendance twice
    await expect(
      bookingService.recordAttendance({
        visitId: activeVisit.id,
        outcome: AttendanceOutcome.NO_SHOW,
      })
    ).rejects.toThrow("Attendance has already been recorded");

    // 5C. Verify an already COMPLETED + UNRECORDED visit (like Hardik Patel's historical seed) can have attendance recorded
    const completedSlot = await createTestSlot(
      new Date(Date.now() - 48 * 60 * 1000),
      new Date(Date.now() - 18 * 60 * 1000),
      VisitSlotStatus.BOOKED
    );

    const completedUnrecordedVisit = await testPrisma.siteVisit.create({
      data: {
        slotId: completedSlot.id,
        leadId: lead.id,
        bookingStatus: BookingStatus.COMPLETED,
        attendanceOutcome: AttendanceOutcome.UNRECORDED,
      },
    });
    createdVisitIds.add(completedUnrecordedVisit.id);

    const recordedNoShow = await bookingService.recordAttendance({
      visitId: completedUnrecordedVisit.id,
      outcome: AttendanceOutcome.NO_SHOW,
    });

    expect(recordedNoShow.bookingStatus).toBe(BookingStatus.COMPLETED);
    expect(recordedNoShow.attendanceOutcome).toBe(AttendanceOutcome.NO_SHOW);
    expect(recordedNoShow.attendedAt).toBeNull();
  });
});
