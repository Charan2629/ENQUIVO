import {
  PrismaClient,
  Prisma,
  VisitSlot,
  SiteVisit,
  VisitSlotStatus,
  BookingStatus,
  AttendanceOutcome,
  ReminderType,
  ReminderStatus,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  BookVisitInput,
  bookVisitSchema,
  CancelBookingInput,
  cancelBookingSchema,
  GetAvailableSlotsInput,
  getAvailableSlotsSchema,
  RecordAttendanceInput,
  recordAttendanceSchema,
} from "@/lib/validations/booking";

/**
 * Custom error thrown when a slot cannot be booked because it is already booked,
 * in the past, non-existent, or contested concurrently.
 */
export class SlotUnavailableError extends Error {
  constructor(message: string = "Slot is no longer available for booking") {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

/**
 * Custom error thrown when an entity is not found.
 */
export class BookingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingNotFoundError";
  }
}

/**
 * Custom error thrown when an operation violates booking business rules or temporal constraints.
 */
export class BookingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingConflictError";
  }
}

export class BookingService {
  /**
   * Constructor dependency injection allows passing an isolated test Prisma client
   * (e.g. testPrisma targeting an isolated test branch) during integration tests,
   * while defaulting to the application singleton in production route handlers.
   */
  constructor(private db: PrismaClient = defaultPrisma) {}

  /**
   * Retrieves all future slots that are currently AVAILABLE.
   * Can optionally be filtered by a date window [from, to].
   */
  async getAvailableSlots(input?: GetAvailableSlotsInput): Promise<VisitSlot[]> {
    const validated = getAvailableSlotsSchema.parse(input ?? {});
    const now = new Date();

    const startsAtFilter: Prisma.DateTimeFilter = {
      gt: validated.from && validated.from > now ? validated.from : now,
    };

    if (validated.to) {
      startsAtFilter.lte = validated.to;
    }

    return this.db.visitSlot.findMany({
      where: {
        status: VisitSlotStatus.AVAILABLE,
        startsAt: startsAtFilter,
      },
      orderBy: {
        startsAt: "asc",
      },
    });
  }

  /**
   * Atomically confirms a visit slot for an active lead.
   *
   * Guarantees:
   * 1. Validates input schema via Zod.
   * 2. Only active, non-deleted leads may book.
   * 3. Only future AVAILABLE slots may be booked.
   * 4. Atomic conditional update: `UPDATE visit_slots SET status = 'BOOKED' WHERE id = slotId AND status = 'AVAILABLE' AND startsAt > NOW()`.
   * 5. Inserts CONFIRMED SiteVisit.
   * 6. Schedules 24-hour and 2-hour pre-visit ReminderJobs if their execution times are still in the future.
   * 7. Concurrency-safe: maps conditional update failure or PostgreSQL partial unique index P2002 to SlotUnavailableError.
   */
  async bookVisit(input: BookVisitInput): Promise<{ visit: SiteVisit; slot: VisitSlot }> {
    const validated = bookVisitSchema.parse(input);
    const now = new Date();

    try {
      return await this.db.$transaction(
        async (tx) => {
          // 1. Verify that lead exists and is active
          const lead = await tx.lead.findFirst({
            where: {
              id: validated.leadId,
              deletedAt: null,
            },
          });

          if (!lead) {
            throw new BookingNotFoundError("Lead not found or has been deactivated");
          }

          // 2. Atomic conditional slot reservation
          // Only updates if the slot is currently AVAILABLE and its start time is in the future
          const updateResult = await tx.visitSlot.updateMany({
            where: {
              id: validated.slotId,
              status: VisitSlotStatus.AVAILABLE,
              startsAt: { gt: now },
            },
            data: {
              status: VisitSlotStatus.BOOKED,
            },
          });

          if (updateResult.count !== 1) {
            // Check why it failed: does the slot exist at all or is it in the past?
            const existingSlot = await tx.visitSlot.findUnique({
              where: { id: validated.slotId },
            });

            if (!existingSlot) {
              throw new BookingNotFoundError("Visit slot not found");
            }

            if (existingSlot.startsAt <= now) {
              throw new BookingConflictError("Cannot book a slot whose start time has already passed");
            }

            throw new SlotUnavailableError("Slot is no longer available for booking");
          }

          // Fetch the updated slot record
          const slot = await tx.visitSlot.findUniqueOrThrow({
            where: { id: validated.slotId },
          });

          // 3. Insert CONFIRMED SiteVisit
          const visit = await tx.siteVisit.create({
            data: {
              slotId: slot.id,
              leadId: lead.id,
              bookingStatus: BookingStatus.CONFIRMED,
              attendanceOutcome: AttendanceOutcome.UNRECORDED,
              bookedAt: now,
            },
          });

          // 4. Stage pre-visit ReminderJobs (24h and 2h relative to visit start time)
          const reminder24hTime = new Date(slot.startsAt.getTime() - 24 * 60 * 60 * 1000);
          const reminder2hTime = new Date(slot.startsAt.getTime() - 2 * 60 * 60 * 1000);

          const remindersToCreate: Prisma.ReminderJobCreateManyInput[] = [];

          // Only create reminder jobs whose scheduled time is still in the future
          if (reminder24hTime > now) {
            remindersToCreate.push({
              siteVisitId: visit.id,
              reminderType: ReminderType.REMINDER_24H,
              status: ReminderStatus.PENDING,
              idempotencyKey: `${visit.id}:${ReminderType.REMINDER_24H}`,
              scheduledFor: reminder24hTime,
            });
          }

          if (reminder2hTime > now) {
            remindersToCreate.push({
              siteVisitId: visit.id,
              reminderType: ReminderType.REMINDER_2H,
              status: ReminderStatus.PENDING,
              idempotencyKey: `${visit.id}:${ReminderType.REMINDER_2H}`,
              scheduledFor: reminder2hTime,
            });
          }

          if (remindersToCreate.length > 0) {
            await tx.reminderJob.createMany({
              data: remindersToCreate,
            });
          }

          return { visit, slot };
        },
        {
          maxWait: 10000, // 10s wait to acquire connection pool slot over cloud WAN
          timeout: 15000, // 15s execution timeout
        }
      );
    } catch (error) {
      // Catch partial unique index collision (P2002 on one_active_booking_per_slot)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new SlotUnavailableError("Slot is already booked by another confirmed visit");
      }
      throw error;
    }
  }

  /**
   * Atomically cancels an active confirmed booking.
   *
   * Guarantees:
   * 1. Only CONFIRMED visits can be cancelled.
   * 2. Marks SiteVisit as CANCELLED and sets cancelledAt.
   * 3. Releases the VisitSlot back to AVAILABLE only if its start time is still in the future.
   * 4. Deletes only PENDING reminder jobs belonging to that visit.
   * 5. Retains the historical SiteVisit record in PostgreSQL for attribution audits.
   */
  async cancelBooking(input: CancelBookingInput): Promise<SiteVisit> {
    const validated = cancelBookingSchema.parse(input);
    const now = new Date();

    return this.db.$transaction(
      async (tx) => {
        const visit = await tx.siteVisit.findUnique({
          where: { id: validated.visitId },
          include: { slot: true },
        });

        if (!visit) {
          throw new BookingNotFoundError("Site visit not found");
        }

        if (visit.bookingStatus !== BookingStatus.CONFIRMED) {
          throw new BookingConflictError(
            `Cannot cancel a visit with status ${visit.bookingStatus}. Only CONFIRMED visits can be cancelled.`
          );
        }

        // 1. Update SiteVisit to CANCELLED
        const updatedVisit = await tx.siteVisit.update({
          where: { id: visit.id },
          data: {
            bookingStatus: BookingStatus.CANCELLED,
            cancelledAt: now,
          },
        });

        // 2. Release slot only if start time is still in the future
        if (visit.slot.startsAt > now) {
          await tx.visitSlot.update({
            where: { id: visit.slotId },
            data: {
              status: VisitSlotStatus.AVAILABLE,
            },
          });
        }

        // 3. Clean up only PENDING reminder jobs for this visit
        await tx.reminderJob.deleteMany({
          where: {
            siteVisitId: visit.id,
            status: ReminderStatus.PENDING,
          },
        });

        return updatedVisit;
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    );
  }

  /**
   * Records attendance outcome for a visit (Sales Portal).
   *
   * Guarantees:
   * 1. Supports visits in (CONFIRMED + UNRECORDED) or (COMPLETED + UNRECORDED).
   * 2. Rejects CANCELLED visits.
   * 3. Rejects visits whose attendance has already been recorded (ATTENDED or NO_SHOW).
   * 4. For CONFIRMED visits, does not allow recording attendance before the scheduled visit start time.
   * 5. Transitions bookingStatus to COMPLETED.
   * 6. Sets attendedAt to NOW() for ATTENDED; keeps it null for NO_SHOW.
   * 7. Does NOT modify the VisitSlot status (it remains BOOKED).
   */
  async recordAttendance(input: RecordAttendanceInput): Promise<SiteVisit> {
    const validated = recordAttendanceSchema.parse(input);
    const now = new Date();

    return this.db.$transaction(
      async (tx) => {
        const visit = await tx.siteVisit.findUnique({
          where: { id: validated.visitId },
          include: { slot: true },
        });

        if (!visit) {
          throw new BookingNotFoundError("Site visit not found");
        }

        if (visit.bookingStatus === BookingStatus.CANCELLED) {
          throw new BookingConflictError("Cannot record attendance for a CANCELLED visit");
        }

        if (visit.attendanceOutcome !== AttendanceOutcome.UNRECORDED) {
          throw new BookingConflictError(
            `Attendance has already been recorded as ${visit.attendanceOutcome}`
          );
        }

        // Temporal check for CONFIRMED visits: cannot record attendance before visit begins
        if (visit.bookingStatus === BookingStatus.CONFIRMED && visit.slot.startsAt > now) {
          throw new BookingConflictError(
            "Cannot record attendance before the scheduled visit has started"
          );
        }

        return tx.siteVisit.update({
          where: { id: visit.id },
          data: {
            bookingStatus: BookingStatus.COMPLETED,
            attendanceOutcome: validated.outcome,
            attendedAt: validated.outcome === AttendanceOutcome.ATTENDED ? now : null,
          },
        });
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    );
  }
}

