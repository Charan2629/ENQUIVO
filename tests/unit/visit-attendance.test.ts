import { describe, it, expect, vi } from "vitest";
import {
  UserRole,
  BookingStatus,
  AttendanceOutcome,
} from "@prisma/client";
import {
  visitQuerySchema,
  recordAttendanceSchema,
} from "@/lib/validations/booking";
import { BookingService } from "@/services/booking/booking.service";

describe("Site Visit & Attendance Validation Schemas", () => {
  describe("visitQuerySchema", () => {
    it("provides sensible defaults for all filter parameters", () => {
      const parsed = visitQuerySchema.parse({});
      expect(parsed.timeframe).toBe("ALL");
      expect(parsed.bookingStatus).toBe("ALL");
      expect(parsed.attendanceOutcome).toBe("ALL");
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(50);
    });

    it("accepts valid timeframe, booking status, and attendance filters", () => {
      const parsed = visitQuerySchema.parse({
        timeframe: "TODAY",
        bookingStatus: "CONFIRMED",
        attendanceOutcome: "UNRECORDED",
        search: "Hardik",
        page: 2,
        limit: 10,
      });

      expect(parsed.timeframe).toBe("TODAY");
      expect(parsed.bookingStatus).toBe("CONFIRMED");
      expect(parsed.attendanceOutcome).toBe("UNRECORDED");
      expect(parsed.search).toBe("Hardik");
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(10);
    });

    it("rejects invalid timeframe options", () => {
      expect(() =>
        visitQuerySchema.parse({
          timeframe: "NEXT_WEEK",
        })
      ).toThrow();
    });
  });

  describe("recordAttendanceSchema", () => {
    it("accepts ATTENDED and NO_SHOW outcomes", () => {
      expect(
        recordAttendanceSchema.parse({
          visitId: "visit-1",
          outcome: AttendanceOutcome.ATTENDED,
        })
      ).toEqual({
        visitId: "visit-1",
        outcome: AttendanceOutcome.ATTENDED,
      });

      expect(
        recordAttendanceSchema.parse({
          visitId: "visit-1",
          outcome: AttendanceOutcome.NO_SHOW,
        })
      ).toEqual({
        visitId: "visit-1",
        outcome: AttendanceOutcome.NO_SHOW,
      });
    });

    it("rejects invalid or empty outcomes", () => {
      expect(() =>
        recordAttendanceSchema.parse({
          visitId: "visit-1",
          outcome: "PRESENT",
        })
      ).toThrow();

      expect(() =>
        recordAttendanceSchema.parse({
          visitId: "visit-1",
        })
      ).toThrow();
    });
  });
});

describe("BookingService Attendance Recording Business Logic & Scoping", () => {
  const salesHeadUser = { id: "head-1", role: UserRole.SALES_HEAD };
  const assignedExecUser = { id: "exec-assigned", role: UserRole.SALES_EXEC };
  const unassignedExecUser = { id: "exec-other", role: UserRole.SALES_EXEC };

  const pastStart = new Date(Date.now() - 3600000);
  const futureStart = new Date(Date.now() + 3600000);

  it("rejects attendance recording when called by a SALES_EXEC for an unassigned lead (anti-IDOR)", async () => {
    const mockVisit = {
      id: "visit-1",
      leadId: "lead-1",
      bookingStatus: BookingStatus.CONFIRMED,
      attendanceOutcome: AttendanceOutcome.UNRECORDED,
      slot: { startsAt: pastStart },
      lead: {
        conversations: [
          {
            handoff: { assignedToId: "exec-assigned" },
          },
        ],
      },
    };

    const mockTx = {
      siteVisit: {
        findUnique: vi.fn().mockResolvedValue(mockVisit),
      },
    };

    const mockDb = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
    };

    const service = new BookingService(mockDb as never);

    await expect(
      service.recordAttendance(
        {
          visitId: "visit-1",
          outcome: AttendanceOutcome.ATTENDED,
        },
        unassignedExecUser
      )
    ).rejects.toThrow("You are not authorized to record attendance for a lead assigned to another executive");
  });

  it("allows SALES_EXEC to record attendance when lead is assigned to them", async () => {
    const mockVisit = {
      id: "visit-1",
      leadId: "lead-1",
      bookingStatus: BookingStatus.CONFIRMED,
      attendanceOutcome: AttendanceOutcome.UNRECORDED,
      slot: { startsAt: pastStart },
      lead: {
        conversations: [
          {
            handoff: { assignedToId: "exec-assigned" },
          },
        ],
      },
    };

    const mockTx = {
      siteVisit: {
        findUnique: vi.fn().mockResolvedValue(mockVisit),
        update: vi.fn().mockResolvedValue({
          id: "visit-1",
          bookingStatus: BookingStatus.COMPLETED,
          attendanceOutcome: AttendanceOutcome.ATTENDED,
        }),
      },
      reminderJob: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const mockDb = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
    };

    const service = new BookingService(mockDb as never);

    const result = await service.recordAttendance(
      {
        visitId: "visit-1",
        outcome: AttendanceOutcome.ATTENDED,
      },
      assignedExecUser
    );

    expect(mockTx.siteVisit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "visit-1" },
        data: expect.objectContaining({
          bookingStatus: BookingStatus.COMPLETED,
          attendanceOutcome: AttendanceOutcome.ATTENDED,
          attendedAt: expect.any(Date),
        }),
      })
    );
    expect(result.bookingStatus).toBe(BookingStatus.COMPLETED);
  });

  it("rejects recording attendance for a CANCELLED visit", async () => {
    const mockVisit = {
      id: "visit-cancelled",
      leadId: "lead-1",
      bookingStatus: BookingStatus.CANCELLED,
      attendanceOutcome: AttendanceOutcome.UNRECORDED,
      slot: { startsAt: pastStart },
      lead: { conversations: [] },
    };

    const mockTx = {
      siteVisit: {
        findUnique: vi.fn().mockResolvedValue(mockVisit),
      },
    };

    const mockDb = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
    };

    const service = new BookingService(mockDb as never);

    await expect(
      service.recordAttendance(
        {
          visitId: "visit-cancelled",
          outcome: AttendanceOutcome.ATTENDED,
        },
        salesHeadUser
      )
    ).rejects.toThrow("Cannot record attendance for a CANCELLED visit");
  });

  it("allows legitimate attendance correction: corrects from ATTENDED to NO_SHOW and clears attendedAt", async () => {
    const mockVisit = {
      id: "visit-already-attended",
      leadId: "lead-1",
      bookingStatus: BookingStatus.COMPLETED,
      attendanceOutcome: AttendanceOutcome.ATTENDED,
      attendedAt: new Date(Date.now() - 3600000),
      slot: { startsAt: pastStart },
      lead: { conversations: [] },
    };

    const mockTx = {
      siteVisit: {
        findUnique: vi.fn().mockResolvedValue(mockVisit),
        update: vi.fn().mockResolvedValue({
          id: "visit-already-attended",
          bookingStatus: BookingStatus.COMPLETED,
          attendanceOutcome: AttendanceOutcome.NO_SHOW,
          attendedAt: null,
        }),
      },
      reminderJob: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const mockDb = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
    };

    const service = new BookingService(mockDb as never);

    const result = await service.recordAttendance(
      {
        visitId: "visit-already-attended",
        outcome: AttendanceOutcome.NO_SHOW,
      },
      salesHeadUser
    );

    expect(mockTx.siteVisit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "visit-already-attended" },
        data: expect.objectContaining({
          bookingStatus: BookingStatus.COMPLETED,
          attendanceOutcome: AttendanceOutcome.NO_SHOW,
          attendedAt: null,
        }),
      })
    );
    expect(result.attendanceOutcome).toBe(AttendanceOutcome.NO_SHOW);
    expect(result.attendedAt).toBeNull();
  });

  it("allows legitimate attendance correction: corrects from NO_SHOW to ATTENDED and sets attendedAt", async () => {
    const mockVisit = {
      id: "visit-already-noshow",
      leadId: "lead-1",
      bookingStatus: BookingStatus.COMPLETED,
      attendanceOutcome: AttendanceOutcome.NO_SHOW,
      attendedAt: null,
      slot: { startsAt: pastStart },
      lead: { conversations: [] },
    };

    const mockTx = {
      siteVisit: {
        findUnique: vi.fn().mockResolvedValue(mockVisit),
        update: vi.fn().mockResolvedValue({
          id: "visit-already-noshow",
          bookingStatus: BookingStatus.COMPLETED,
          attendanceOutcome: AttendanceOutcome.ATTENDED,
          attendedAt: new Date(),
        }),
      },
      reminderJob: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const mockDb = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
    };

    const service = new BookingService(mockDb as never);

    const result = await service.recordAttendance(
      {
        visitId: "visit-already-noshow",
        outcome: AttendanceOutcome.ATTENDED,
      },
      salesHeadUser
    );

    expect(mockTx.siteVisit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "visit-already-noshow" },
        data: expect.objectContaining({
          bookingStatus: BookingStatus.COMPLETED,
          attendanceOutcome: AttendanceOutcome.ATTENDED,
          attendedAt: expect.any(Date),
        }),
      })
    );
    expect(result.attendanceOutcome).toBe(AttendanceOutcome.ATTENDED);
  });

  it("returns visit idempotently without updating if same outcome is submitted", async () => {
    const mockVisit = {
      id: "visit-same-outcome",
      leadId: "lead-1",
      bookingStatus: BookingStatus.COMPLETED,
      attendanceOutcome: AttendanceOutcome.ATTENDED,
      attendedAt: new Date(Date.now() - 3600000),
      slot: { startsAt: pastStart },
      lead: { conversations: [] },
    };

    const mockTx = {
      siteVisit: {
        findUnique: vi.fn().mockResolvedValue(mockVisit),
        update: vi.fn(),
      },
      reminderJob: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const mockDb = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
    };

    const service = new BookingService(mockDb as never);

    const result = await service.recordAttendance(
      {
        visitId: "visit-same-outcome",
        outcome: AttendanceOutcome.ATTENDED,
      },
      salesHeadUser
    );

    expect(mockTx.siteVisit.update).not.toHaveBeenCalled();
    expect(result.id).toBe("visit-same-outcome");
  });

  it("rejects recording attendance before scheduled visit start time", async () => {
    const mockVisit = {
      id: "visit-future",
      leadId: "lead-1",
      bookingStatus: BookingStatus.CONFIRMED,
      attendanceOutcome: AttendanceOutcome.UNRECORDED,
      slot: { startsAt: futureStart },
      lead: { conversations: [] },
    };

    const mockTx = {
      siteVisit: {
        findUnique: vi.fn().mockResolvedValue(mockVisit),
      },
      reminderJob: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const mockDb = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
    };

    const service = new BookingService(mockDb as never);

    await expect(
      service.recordAttendance(
        {
          visitId: "visit-future",
          outcome: AttendanceOutcome.ATTENDED,
        },
        salesHeadUser
      )
    ).rejects.toThrow("Cannot record attendance before the scheduled visit has started");
  });

  it("NO_SHOW outcome sets bookingStatus = COMPLETED and leaves attendedAt as null", async () => {
    const mockVisit = {
      id: "visit-no-show",
      leadId: "lead-1",
      bookingStatus: BookingStatus.CONFIRMED,
      attendanceOutcome: AttendanceOutcome.UNRECORDED,
      slot: { startsAt: pastStart },
      lead: { conversations: [] },
    };

    const mockTx = {
      siteVisit: {
        findUnique: vi.fn().mockResolvedValue(mockVisit),
        update: vi.fn().mockResolvedValue({
          id: "visit-no-show",
          bookingStatus: BookingStatus.COMPLETED,
          attendanceOutcome: AttendanceOutcome.NO_SHOW,
          attendedAt: null,
        }),
      },
      reminderJob: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const mockDb = {
      $transaction: vi.fn().mockImplementation(async (callback) => callback(mockTx)),
    };

    const service = new BookingService(mockDb as never);

    const result = await service.recordAttendance(
      {
        visitId: "visit-no-show",
        outcome: AttendanceOutcome.NO_SHOW,
      },
      salesHeadUser
    );

    expect(mockTx.siteVisit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "visit-no-show" },
        data: expect.objectContaining({
          bookingStatus: BookingStatus.COMPLETED,
          attendanceOutcome: AttendanceOutcome.NO_SHOW,
          attendedAt: null,
        }),
      })
    );
    expect(result.attendanceOutcome).toBe(AttendanceOutcome.NO_SHOW);
  });
});
