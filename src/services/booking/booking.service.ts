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
  UserRole,
} from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
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
  ValidatedVisitQuery,
  visitQuerySchema,
} from "@/lib/validations/booking";
import {
  CreateSlotInput,
  createSlotSchema,
  UpdateSlotInput,
  updateSlotSchema,
  ValidatedSlotQuery,
  slotQuerySchema,
} from "@/lib/validations/slot";
import {
  VisitSlotItem,
  SiteVisitItem,
  VisitPagination,
  SiteVisitMetrics,
} from "@/types";

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

    const where: Prisma.VisitSlotWhereInput = {
      status: VisitSlotStatus.AVAILABLE,
      startsAt: startsAtFilter,
    };

    const searchTarget = (validated.project || validated.location)?.trim();
    if (searchTarget) {
      where.location = {
        contains: searchTarget,
        mode: "insensitive",
      };
    }

    return this.db.visitSlot.findMany({
      where,
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

        // 3. Clean up PENDING and in-flight PROCESSING reminder jobs for this visit
        await tx.reminderJob.deleteMany({
          where: {
            siteVisitId: visit.id,
            status: { in: [ReminderStatus.PENDING, ReminderStatus.PROCESSING] },
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
  /**
   * Records or corrects attendance outcome for a visit (Sales Portal).
   *
   * Guarantees:
   * 1. Supports visits in (CONFIRMED + UNRECORDED) or (COMPLETED + UNRECORDED), as well as legitimate attendance corrections.
   * 2. Rejects CANCELLED visits.
   * 3. For CONFIRMED visits, does not allow recording attendance before the scheduled visit start time.
   * 4. Transitions bookingStatus to COMPLETED.
   * 5. Sets attendedAt to NOW() for ATTENDED; clears it to null for NO_SHOW.
   * 6. Deletes any remaining PENDING reminder jobs for this visit.
   * 7. RBAC / IDOR defense: When called by a SALES_EXEC, asserts that the lead is assigned to that executive.
   */
  async recordAttendance(
    input: RecordAttendanceInput,
    staffUser?: { id: string; role: UserRole }
  ): Promise<SiteVisit> {
    const validated = recordAttendanceSchema.parse(input);
    const now = new Date();

    return this.db.$transaction(
      async (tx) => {
        const visit = await tx.siteVisit.findUnique({
          where: { id: validated.visitId },
          include: {
            slot: true,
            lead: {
              include: {
                conversations: {
                  include: {
                    handoff: true,
                  },
                },
              },
            },
          },
        });

        if (!visit) {
          throw new BookingNotFoundError("Site visit not found");
        }

        // Anti-IDOR check for Sales Executives: must be assigned to this lead
        if (staffUser && staffUser.role === UserRole.SALES_EXEC) {
          const isAssigned = visit.lead.conversations.some(
            (c) => c.handoff?.assignedToId === staffUser.id
          );
          if (!isAssigned) {
            throw new BookingConflictError(
              "You are not authorized to record attendance for a lead assigned to another executive"
            );
          }
        }

        if (visit.bookingStatus === BookingStatus.CANCELLED) {
          throw new BookingConflictError("Cannot record attendance for a CANCELLED visit");
        }

        // Temporal check for CONFIRMED visits: cannot record attendance before visit begins
        if (visit.bookingStatus === BookingStatus.CONFIRMED && visit.slot.startsAt > now) {
          throw new BookingConflictError(
            "Cannot record attendance before the scheduled visit has started"
          );
        }

        // Clean up any remaining PENDING or in-flight PROCESSING reminder jobs for this visit
        await tx.reminderJob.deleteMany({
          where: {
            siteVisitId: visit.id,
            status: { in: [ReminderStatus.PENDING, ReminderStatus.PROCESSING] },
          },
        });

        // Idempotent: if outcome and status already match, return existing visit
        if (visit.attendanceOutcome === validated.outcome && visit.bookingStatus === BookingStatus.COMPLETED) {
          return visit;
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

  // ============================================================================
  // Slot Management Methods (M6.4)
  // ============================================================================

  /**
   * Creates a new site visit slot. Restricted to SALES_HEAD.
   */
  async createSlot(
    input: CreateSlotInput,
    staffUser: { id: string; role: UserRole }
  ): Promise<VisitSlotItem> {
    if (staffUser.role !== UserRole.SALES_HEAD) {
      throw new BookingConflictError("Only Sales Head can create appointment slots");
    }

    const validated = createSlotSchema.parse(input);
    const now = new Date();

    if (validated.startsAt <= now) {
      throw new BookingConflictError("Slot start time must be in the future");
    }

    const slot = await this.db.visitSlot.create({
      data: {
        startsAt: validated.startsAt,
        endsAt: validated.endsAt,
        location: validated.location,
        status: VisitSlotStatus.AVAILABLE,
      },
    });

    return {
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      startsAtIST: formatInTimeZone(slot.startsAt, "Asia/Kolkata", "dd MMM yyyy, hh:mm a 'IST'"),
      endsAtIST: formatInTimeZone(slot.endsAt, "Asia/Kolkata", "hh:mm a 'IST'"),
      status: slot.status,
      location: slot.location,
      hasConfirmedBooking: false,
      activeBooking: null,
      totalVisitsCount: 0,
    };
  }

  /**
   * Updates an existing appointment slot. Restricted to SALES_HEAD.
   * Modifying slots with an active CONFIRMED booking is rejected to prevent appointment corruption.
   */
  async updateSlot(
    id: string,
    input: UpdateSlotInput,
    staffUser: { id: string; role: UserRole }
  ): Promise<VisitSlotItem> {
    if (staffUser.role !== UserRole.SALES_HEAD) {
      throw new BookingConflictError("Only Sales Head can modify appointment slots");
    }

    const validated = updateSlotSchema.parse(input);
    const now = new Date();

    const existing = await this.db.visitSlot.findUnique({
      where: { id },
      include: {
        siteVisits: {
          where: { bookingStatus: BookingStatus.CONFIRMED },
          include: { lead: true },
        },
      },
    });

    if (!existing) {
      throw new BookingNotFoundError(`Appointment slot ${id} not found`);
    }

    if (existing.siteVisits.length > 0) {
      throw new BookingConflictError(
        "Cannot modify an appointment slot with an active confirmed booking"
      );
    }

    const newStartsAt = validated.startsAt ?? existing.startsAt;
    const newEndsAt = validated.endsAt ?? existing.endsAt;

    if (newEndsAt <= newStartsAt) {
      throw new BookingConflictError("End time must be after start time");
    }

    if (validated.startsAt && validated.startsAt <= now) {
      throw new BookingConflictError("Updated start time must be in the future");
    }

    const updated = await this.db.visitSlot.update({
      where: { id },
      data: {
        startsAt: newStartsAt,
        endsAt: newEndsAt,
        location: validated.location ?? existing.location,
      },
      include: {
        _count: {
          select: { siteVisits: true },
        },
      },
    });

    return {
      id: updated.id,
      startsAt: updated.startsAt,
      endsAt: updated.endsAt,
      startsAtIST: formatInTimeZone(updated.startsAt, "Asia/Kolkata", "dd MMM yyyy, hh:mm a 'IST'"),
      endsAtIST: formatInTimeZone(updated.endsAt, "Asia/Kolkata", "hh:mm a 'IST'"),
      status: updated.status,
      location: updated.location,
      hasConfirmedBooking: false,
      activeBooking: null,
      totalVisitsCount: updated._count.siteVisits,
    };
  }

  /**
   * Deletes an appointment slot. Restricted to SALES_HEAD.
   * Slots with any booking history (even cancelled visits) are preserved for attribution integrity.
   */
  async deleteSlot(
    id: string,
    staffUser: { id: string; role: UserRole }
  ): Promise<{ success: boolean; id: string }> {
    if (staffUser.role !== UserRole.SALES_HEAD) {
      throw new BookingConflictError("Only Sales Head can delete appointment slots");
    }

    const existing = await this.db.visitSlot.findUnique({
      where: { id },
      include: {
        _count: {
          select: { siteVisits: true },
        },
      },
    });

    if (!existing) {
      throw new BookingNotFoundError(`Appointment slot ${id} not found`);
    }

    if (existing._count.siteVisits > 0) {
      throw new BookingConflictError(
        "Cannot delete an appointment slot with booking history. Records are preserved for attribution audits."
      );
    }

    await this.db.visitSlot.delete({
      where: { id },
    });

    return { success: true, id };
  }

  /**
   * Retrieves all slots matching query filters for the Slot Calendar view.
   */
  async getAllSlots(input?: ValidatedSlotQuery): Promise<VisitSlotItem[]> {
    const validated = slotQuerySchema.parse(input ?? {});
    const now = new Date();

    const where: Prisma.VisitSlotWhereInput = {};

    if (validated.status !== "ALL") {
      where.status = validated.status;
    }

    if (!validated.includePast) {
      where.startsAt = { gt: now };
    }

    const searchTarget = (validated.project || validated.search)?.trim();
    if (searchTarget && searchTarget !== "ALL") {
      where.location = {
        contains: searchTarget,
        mode: "insensitive",
      };
    }

    if (validated.from || validated.to) {
      where.startsAt = {
        ...(where.startsAt && typeof where.startsAt === "object" ? where.startsAt : {}),
        ...(validated.from ? { gte: validated.from } : {}),
        ...(validated.to ? { lte: validated.to } : {}),
      };
    }

    const rows = await this.db.visitSlot.findMany({
      where,
      orderBy: { startsAt: "asc" },
      take: validated.limit,
      include: {
        siteVisits: {
          where: { bookingStatus: BookingStatus.CONFIRMED },
          include: {
            lead: {
              select: {
                id: true,
                name: true,
                phone: true,
                leadCode: true,
              },
            },
          },
        },
        _count: {
          select: { siteVisits: true },
        },
      },
    });

    return rows.map((slot) => {
      const activeVisit = slot.siteVisits[0] ?? null;
      return {
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        startsAtIST: formatInTimeZone(slot.startsAt, "Asia/Kolkata", "dd MMM yyyy, hh:mm a 'IST'"),
        endsAtIST: formatInTimeZone(slot.endsAt, "Asia/Kolkata", "hh:mm a 'IST'"),
        status: slot.status,
        location: slot.location,
        hasConfirmedBooking: Boolean(activeVisit),
        activeBooking: activeVisit
          ? {
              visitId: activeVisit.id,
              leadId: activeVisit.lead.id,
              leadName: activeVisit.lead.name,
              leadPhone: activeVisit.lead.phone,
              leadCode: activeVisit.lead.leadCode,
              bookingStatus: activeVisit.bookingStatus,
            }
          : null,
        totalVisitsCount: slot._count.siteVisits,
      };
    });
  }

  /**
   * Live slot metrics for dashboard counters.
   */
  async getSlotMetrics(): Promise<{
    totalSlots: number;
    availableSlots: number;
    bookedSlots: number;
    upcomingSlots: number;
  }> {
    const now = new Date();
    const [totalSlots, availableSlots, bookedSlots, upcomingSlots] = await Promise.all([
      this.db.visitSlot.count(),
      this.db.visitSlot.count({
        where: { status: VisitSlotStatus.AVAILABLE, startsAt: { gt: now } },
      }),
      this.db.visitSlot.count({
        where: { status: VisitSlotStatus.BOOKED },
      }),
      this.db.visitSlot.count({
        where: { startsAt: { gt: now } },
      }),
    ]);

    return { totalSlots, availableSlots, bookedSlots, upcomingSlots };
  }

  // ============================================================================
  // Site Visit & Attendance Methods (M6.4)
  // ============================================================================

  /**
   * Retrieves a paginated list of site visits with server-side role scoping,
   * timeframe filtering, status filtering, and keyword search.
   */
  async getVisits(
    input: ValidatedVisitQuery,
    staffUser: { id: string; role: UserRole }
  ): Promise<{ visits: SiteVisitItem[]; pagination: VisitPagination }> {
    const validated = visitQuerySchema.parse(input);
    const now = new Date();

    const andConditions: Prisma.SiteVisitWhereInput[] = [];

    // 1. Role-based scoping (IDOR defense)
    if (staffUser.role === UserRole.SALES_EXEC) {
      andConditions.push({
        lead: {
          conversations: {
            some: {
              handoff: {
                assignedToId: staffUser.id,
              },
            },
          },
        },
      });
    } else if (staffUser.role !== UserRole.SALES_HEAD) {
      throw new BookingConflictError("Staff permissions required to access site visits");
    }

    // 2. Booking status filter
    if (validated.bookingStatus !== "ALL") {
      andConditions.push({
        bookingStatus: validated.bookingStatus as BookingStatus,
      });
    }

    // 3. Attendance outcome filter
    if (validated.attendanceOutcome !== "ALL") {
      andConditions.push({
        attendanceOutcome: validated.attendanceOutcome as AttendanceOutcome,
      });
    }

    // 4. Timeframe filter (computed relative to Slot.startsAt)
    if (validated.timeframe === "UPCOMING") {
      andConditions.push({
        slot: { startsAt: { gt: now } },
      });
    } else if (validated.timeframe === "PAST") {
      andConditions.push({
        slot: { startsAt: { lte: now } },
      });
    } else if (validated.timeframe === "TODAY") {
      const todayISTStr = formatInTimeZone(now, "Asia/Kolkata", "yyyy-MM-dd");
      const startOfTodayIST = new Date(`${todayISTStr}T00:00:00+05:30`);
      const endOfTodayIST = new Date(`${todayISTStr}T23:59:59.999+05:30`);
      andConditions.push({
        slot: {
          startsAt: {
            gte: startOfTodayIST,
            lte: endOfTodayIST,
          },
        },
      });
    }

    // 5. Keyword search (lead name, phone, or leadCode)
    if (validated.search && validated.search.trim() !== "") {
      const q = validated.search.trim();
      andConditions.push({
        lead: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { leadCode: { contains: q, mode: "insensitive" } },
          ],
        },
      });
    }

    const where: Prisma.SiteVisitWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const [total, rows] = await Promise.all([
      this.db.siteVisit.count({ where }),
      this.db.siteVisit.findMany({
        where,
        skip: (validated.page - 1) * validated.limit,
        take: validated.limit,
        orderBy: {
          slot: {
            startsAt: validated.timeframe === "UPCOMING" ? "asc" : "desc",
          },
        },
        include: {
          slot: true,
          lead: {
            include: {
              project: { select: { name: true } },
              conversations: {
                orderBy: { startedAt: "desc" },
                include: {
                  handoff: {
                    include: {
                      assignedTo: { select: { id: true, name: true, email: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const visits: SiteVisitItem[] = rows.map((v) => {
      const isPast = v.slot.startsAt <= now;
      const isEligibleForAttendance =
        (v.bookingStatus === BookingStatus.CONFIRMED && isPast) ||
        (v.bookingStatus === BookingStatus.COMPLETED);

      // Find assigned salesperson from conversations handoff
      const assignedTo =
        v.lead.conversations.find((c) => c.handoff?.assignedTo)?.handoff?.assignedTo ?? null;

      return {
        id: v.id,
        slotId: v.slotId,
        leadId: v.leadId,
        bookingStatus: v.bookingStatus,
        attendanceOutcome: v.attendanceOutcome,
        bookedAt: v.bookedAt,
        cancelledAt: v.cancelledAt,
        attendedAt: v.attendedAt,
        startsAt: v.slot.startsAt,
        endsAt: v.slot.endsAt,
        startsAtIST: formatInTimeZone(v.slot.startsAt, "Asia/Kolkata", "dd MMM yyyy, hh:mm a 'IST'"),
        endsAtIST: formatInTimeZone(v.slot.endsAt, "Asia/Kolkata", "hh:mm a 'IST'"),
        location: v.slot.location,
        isPast,
        isEligibleForAttendance,
        lead: {
          id: v.lead.id,
          leadCode: v.lead.leadCode,
          name: v.lead.name,
          phone: v.lead.phone,
          email: v.lead.email,
          projectName: v.lead.project?.name ?? null,
        },
        assignedTo,
      };
    });

    return {
      visits,
      pagination: {
        total,
        page: validated.page,
        limit: validated.limit,
        totalPages: Math.max(1, Math.ceil(total / validated.limit)),
      },
    };
  }

  /**
   * Computes role-scoped site visit metrics.
   */
  async getVisitMetrics(
    staffUser: { id: string; role: UserRole }
  ): Promise<SiteVisitMetrics> {
    const now = new Date();
    const baseWhere: Prisma.SiteVisitWhereInput = {};

    if (staffUser.role === UserRole.SALES_EXEC) {
      baseWhere.lead = {
        conversations: {
          some: {
            handoff: {
              assignedToId: staffUser.id,
            },
          },
        },
      };
    }

    const [totalVisits, confirmedCount, attendedCount, noShowCount, cancelledCount, pendingAttendanceCount] =
      await Promise.all([
        this.db.siteVisit.count({ where: baseWhere }),
        this.db.siteVisit.count({
          where: { ...baseWhere, bookingStatus: BookingStatus.CONFIRMED },
        }),
        this.db.siteVisit.count({
          where: { ...baseWhere, attendanceOutcome: AttendanceOutcome.ATTENDED },
        }),
        this.db.siteVisit.count({
          where: { ...baseWhere, attendanceOutcome: AttendanceOutcome.NO_SHOW },
        }),
        this.db.siteVisit.count({
          where: { ...baseWhere, bookingStatus: BookingStatus.CANCELLED },
        }),
        this.db.siteVisit.count({
          where: {
            ...baseWhere,
            bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
            attendanceOutcome: AttendanceOutcome.UNRECORDED,
            slot: { startsAt: { lte: now } },
          },
        }),
      ]);

    return {
      totalVisits,
      confirmedCount,
      attendedCount,
      noShowCount,
      cancelledCount,
      pendingAttendanceCount,
    };
  }

  /**
   * Staff-initiated cancellation of a site visit with role-based scoping.
   */
  async cancelVisitByStaff(
    visitId: string,
    staffUser: { id: string; role: UserRole }
  ): Promise<SiteVisit> {
    if (staffUser.role === UserRole.SALES_EXEC) {
      const visit = await this.db.siteVisit.findUnique({
        where: { id: visitId },
        include: {
          lead: {
            include: {
              conversations: {
                include: { handoff: true },
              },
            },
          },
        },
      });

      if (!visit) {
        throw new BookingNotFoundError("Site visit not found");
      }

      const isAssigned = visit.lead.conversations.some(
        (c) => c.handoff?.assignedToId === staffUser.id
      );

      if (!isAssigned) {
        throw new BookingConflictError(
          "You are not authorized to cancel a visit for a lead assigned to another executive"
        );
      }
    }

    return this.cancelBooking({ visitId });
  }
}

export const bookingService = new BookingService();
