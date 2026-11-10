/**
 * tests/unit/slot-dynamic-seeding.test.ts
 *
 * Comprehensive regression tests for ENQUIVO dynamic visit slot inventory:
 * 1. Dynamic future slot date generation in Asia/Kolkata relative to current date.
 * 2. Realistic morning and afternoon slots for BOTH projects:
 *    - Prakriti Heights: "Prakriti Heights Experience Gallery, SG Highway, Ahmedabad"
 *    - Vaastu Enclave: "Vaastu Enclave Site Office, Shela, Ahmedabad"
 * 3. Strict project-specific slot filtering & cross-project leakage prevention.
 * 4. Past slot exclusion (startsAt <= now excluded).
 * 5. Idempotent seeding (repeated runs create 0 duplicates and skip existing slots).
 * 6. Non-overwrite of BOOKED slots (BOOKED slots are never modified or reverted to AVAILABLE).
 * 7. Non-destructive safety guard validation.
 * 8. Slot viewing does NOT create a booking; booking occurs only on explicit confirmation.
 */

import { describe, it, expect, vi } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { VisitSlotStatus, BookingStatus } from "@prisma/client";
import {
  generateUpcomingSlotDates,
  generateUpcomingSlots,
  seedUpcomingSlots,
} from "../../prisma/seed";
import {
  BookingService,
  SlotUnavailableError,
} from "@/services/booking/booking.service";
import { validateSeedTarget } from "@/lib/seed-guard";

describe("1. Dynamic Future Slot Date & Slot Generation", () => {
  it("generates upcoming dates strictly in the future relative to Asia/Kolkata reference date", () => {
    // Simulated reference date: 10 Nov 2026 at 15:30 IST
    const referenceDate = new Date("2026-11-10T10:00:00.000Z"); // 15:30 IST

    const dates = generateUpcomingSlotDates(7, referenceDate);
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe("2026-11-11"); // Tomorrow in IST
    expect(dates[1]).toBe("2026-11-12");
    expect(dates[6]).toBe("2026-11-17");

    // All dates must be in strictly ascending order
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });

  it("handles month and year rollover correctly in Asia/Kolkata", () => {
    // End of year: 31 Dec 2026 at 20:00 IST
    const referenceDate = new Date("2026-12-31T14:30:00.000Z"); // 20:00 IST

    const dates = generateUpcomingSlotDates(3, referenceDate);
    expect(dates[0]).toBe("2027-01-01");
    expect(dates[1]).toBe("2027-01-02");
    expect(dates[2]).toBe("2027-01-03");
  });

  it("generates exactly 4 slots per day (2 Prakriti Heights, 2 Vaastu Enclave) with correct times in IST", () => {
    const referenceDate = new Date("2026-11-10T10:00:00.000Z");
    const slots = generateUpcomingSlots(7, referenceDate);

    // 7 days * 4 slots/day = 28 slots
    expect(slots).toHaveLength(28);

    const prakritiSlots = slots.filter((s) =>
      s.location.includes("Prakriti Heights Experience Gallery, SG Highway, Ahmedabad")
    );
    const vaastuSlots = slots.filter((s) =>
      s.location.includes("Vaastu Enclave Site Office, Shela, Ahmedabad")
    );

    expect(prakritiSlots).toHaveLength(14); // 2 per day * 7
    expect(vaastuSlots).toHaveLength(14); // 2 per day * 7

    // Verify Prakriti Heights times (10:00 AM IST and 02:30 PM IST)
    const firstPrakritiMorning = prakritiSlots[0];
    const firstPrakritiAfternoon = prakritiSlots[1];

    expect(formatInTimeZone(firstPrakritiMorning.startsAt, "Asia/Kolkata", "hh:mm a")).toBe("10:00 AM");
    expect(formatInTimeZone(firstPrakritiMorning.endsAt, "Asia/Kolkata", "hh:mm a")).toBe("11:00 AM");

    expect(formatInTimeZone(firstPrakritiAfternoon.startsAt, "Asia/Kolkata", "hh:mm a")).toBe("02:30 PM");
    expect(formatInTimeZone(firstPrakritiAfternoon.endsAt, "Asia/Kolkata", "hh:mm a")).toBe("03:30 PM");

    // Verify Vaastu Enclave times (11:30 AM IST and 04:00 PM IST)
    const firstVaastuMorning = vaastuSlots[0];
    const firstVaastuAfternoon = vaastuSlots[1];

    expect(formatInTimeZone(firstVaastuMorning.startsAt, "Asia/Kolkata", "hh:mm a")).toBe("11:30 AM");
    expect(formatInTimeZone(firstVaastuMorning.endsAt, "Asia/Kolkata", "hh:mm a")).toBe("12:30 PM");

    expect(formatInTimeZone(firstVaastuAfternoon.startsAt, "Asia/Kolkata", "hh:mm a")).toBe("04:00 PM");
    expect(formatInTimeZone(firstVaastuAfternoon.endsAt, "Asia/Kolkata", "hh:mm a")).toBe("05:00 PM");
  });
});

describe("2. Idempotent Seeding & Preservation of BOOKED Slots", () => {
  it("creates all slots on initial run and skips already existing slots on subsequent runs", async () => {
    const existingSlots: Array<{ startsAt: Date; location: string; status: VisitSlotStatus }> = [];

    const mockTx = {
      visitSlot: {
        findFirst: vi.fn().mockImplementation(({ where }) => {
          const match = existingSlots.find(
            (s) =>
              s.startsAt.getTime() === where.startsAt.getTime() &&
              s.location === where.location
          );
          return Promise.resolve(match || null);
        }),
        create: vi.fn().mockImplementation(({ data }) => {
          existingSlots.push(data);
          return Promise.resolve({ id: `slot-${existingSlots.length}`, ...data });
        }),
      },
    };

    const refDate = new Date("2026-11-10T10:00:00.000Z");

    // First run: should create all 28 slots
    const result1 = await seedUpcomingSlots(mockTx as never, 7, refDate);
    expect(result1.created).toBe(28);
    expect(result1.skipped).toBe(0);
    expect(existingSlots).toHaveLength(28);

    // Second run: should create 0 and skip all 28 slots (idempotent)
    const result2 = await seedUpcomingSlots(mockTx as never, 7, refDate);
    expect(result2.created).toBe(0);
    expect(result2.skipped).toBe(28);
    expect(existingSlots).toHaveLength(28); // No duplicates created
  });

  it("never alters or reverts existing BOOKED slots back to AVAILABLE", async () => {
    const refDate = new Date("2026-11-10T10:00:00.000Z");
    const tomorrowSlotStart = new Date("2026-11-11T04:30:00.000Z"); // Morning Prakriti slot

    // Pre-existing slot that has already been booked by a buyer
    const existingBookedSlot = {
      id: "booked-slot-1",
      startsAt: tomorrowSlotStart,
      endsAt: new Date("2026-11-11T05:30:00.000Z"),
      status: VisitSlotStatus.BOOKED,
      location: "Prakriti Heights Experience Gallery, SG Highway, Ahmedabad",
    };

    const updateSpy = vi.fn();
    const mockTx = {
      visitSlot: {
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (
            where.startsAt.getTime() === tomorrowSlotStart.getTime() &&
            where.location === existingBookedSlot.location
          ) {
            return Promise.resolve(existingBookedSlot);
          }
          return Promise.resolve(null);
        }),
        create: vi.fn().mockResolvedValue({ id: "new-slot" }),
        update: updateSpy,
      },
    };

    const result = await seedUpcomingSlots(mockTx as never, 7, refDate);

    // The booked slot was found and skipped; never updated or created
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(existingBookedSlot.status).toBe(VisitSlotStatus.BOOKED);
  });
});

describe("3. Strict Project-Specific Slot Filtering & Past-Slot Exclusion", () => {
  it("filters slots strictly by project name and prevents cross-project leakage", async () => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const dayAfter = new Date(Date.now() + 48 * 3600 * 1000);

    const mockDbSlots = [
      {
        id: "slot-ph-1",
        startsAt: tomorrow,
        endsAt: new Date(tomorrow.getTime() + 3600000),
        status: VisitSlotStatus.AVAILABLE,
        location: "Prakriti Heights Experience Gallery, SG Highway, Ahmedabad",
      },
      {
        id: "slot-ve-1",
        startsAt: tomorrow,
        endsAt: new Date(tomorrow.getTime() + 3600000),
        status: VisitSlotStatus.AVAILABLE,
        location: "Vaastu Enclave Site Office, Shela, Ahmedabad",
      },
      {
        id: "slot-ph-2",
        startsAt: dayAfter,
        endsAt: new Date(dayAfter.getTime() + 3600000),
        status: VisitSlotStatus.AVAILABLE,
        location: "Prakriti Heights Experience Gallery, SG Highway, Ahmedabad",
      },
    ];

    const mockDb = {
      visitSlot: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          return Promise.resolve(
            mockDbSlots.filter((s) => {
              if (where.status && s.status !== where.status) return false;
              if (where.location?.contains) {
                const target = where.location.contains.toLowerCase();
                return s.location.toLowerCase().includes(target);
              }
              return true;
            })
          );
        }),
      },
    };

    const service = new BookingService(mockDb as never);

    // 1. Query Prakriti Heights slots
    const prakritiSlots = await service.getAvailableSlots({ project: "Prakriti Heights" });
    expect(prakritiSlots).toHaveLength(2);
    expect(prakritiSlots.every((s) => s.location.includes("Prakriti Heights"))).toBe(true);
    expect(prakritiSlots.some((s) => s.location.includes("Vaastu Enclave"))).toBe(false);

    // 2. Query Vaastu Enclave slots
    const vaastuSlots = await service.getAvailableSlots({ project: "Vaastu Enclave" });
    expect(vaastuSlots).toHaveLength(1);
    expect(vaastuSlots[0].location).toContain("Vaastu Enclave");
    expect(vaastuSlots.some((s) => s.location.includes("Prakriti Heights"))).toBe(false);
  });

  it("strictly excludes past slots from getAvailableSlots", async () => {
    const mockDb = {
      visitSlot: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          // Verify that startsAt filter contains 'gt' pointing to now or future
          expect(where.startsAt.gt).toBeInstanceOf(Date);
          expect((where.startsAt.gt as Date).getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
          return Promise.resolve([]);
        }),
      },
    };

    const service = new BookingService(mockDb as never);
    await service.getAvailableSlots();
  });
});

describe("4. Booking Lifecycle & No-Booking on Display Guarantee", () => {
  it("viewing available slots never modifies slot status or creates a SiteVisit record", async () => {
    const findManySpy = vi.fn().mockResolvedValue([
      {
        id: "slot-available-1",
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        status: VisitSlotStatus.AVAILABLE,
        location: "Prakriti Heights Experience Gallery, SG Highway, Ahmedabad",
      },
    ]);
    const updateSpy = vi.fn();
    const siteVisitCreateSpy = vi.fn();

    const mockDb = {
      visitSlot: { findMany: findManySpy, update: updateSpy },
      siteVisit: { create: siteVisitCreateSpy },
    };

    const service = new BookingService(mockDb as never);
    const slots = await service.getAvailableSlots({ project: "Prakriti Heights" });

    expect(slots).toHaveLength(1);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(siteVisitCreateSpy).not.toHaveBeenCalled();
  });

  it("bookVisit atomically confirms a slot and prevents double booking", async () => {
    const futureSlot = {
      id: "slot-to-book-1",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
      status: VisitSlotStatus.AVAILABLE,
      location: "Prakriti Heights Experience Gallery, SG Highway, Ahmedabad",
    };

    const activeLead = {
      id: "lead-active-1",
      deletedAt: null,
    };

    const mockDb = {
      $transaction: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          lead: { findFirst: vi.fn().mockResolvedValue(activeLead) },
          visitSlot: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }), // Successful atomic reservation
            findUnique: vi.fn().mockResolvedValue({ ...futureSlot, status: VisitSlotStatus.BOOKED }),
            findUniqueOrThrow: vi.fn().mockResolvedValue({ ...futureSlot, status: VisitSlotStatus.BOOKED }),
          },
          siteVisit: {
            create: vi.fn().mockResolvedValue({
              id: "visit-confirmed-1",
              slotId: futureSlot.id,
              leadId: activeLead.id,
              bookingStatus: BookingStatus.CONFIRMED,
            }),
          },
          reminderJob: {
            createMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        };
        return callback(tx);
      }),
    };

    const service = new BookingService(mockDb as never);
    const result = await service.bookVisit({
      slotId: futureSlot.id,
      leadId: activeLead.id,
    });

    expect(result.visit.bookingStatus).toBe(BookingStatus.CONFIRMED);
    expect(result.slot.status).toBe(VisitSlotStatus.BOOKED);
  });

  it("rejects booking if the slot is no longer available (concurrency conflict)", async () => {
    const futureSlot = {
      id: "contested-slot",
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
      status: VisitSlotStatus.BOOKED,
      location: "Prakriti Heights Experience Gallery, SG Highway, Ahmedabad",
    };

    const mockDb = {
      $transaction: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          lead: { findFirst: vi.fn().mockResolvedValue({ id: "lead-1", deletedAt: null }) },
          visitSlot: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }), // Another buyer booked it simultaneously!
            findUnique: vi.fn().mockResolvedValue(futureSlot),
          },
        };
        return callback(tx);
      }),
    };

    const service = new BookingService(mockDb as never);
    await expect(
      service.bookVisit({
        slotId: "contested-slot",
        leadId: "lead-1",
      })
    ).rejects.toThrow(SlotUnavailableError);
  });
});

describe("5. Non-Destructive Seed Safety Guard Validation", () => {
  const approvedEndpoint =
    "postgresql://demo:pass@ep-frosty-tooth-b3446kf8.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

  it("permits non-destructive seed without ALLOW_DESTRUCTIVE_SEED on approved dev endpoint", () => {
    const result = validateSeedTarget({
      nodeEnv: "development",
      databaseUrl: approvedEndpoint,
      isDestructive: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.targetHost).toBe("ep-frosty-tooth-b3446kf8.c-4.ap-southeast-1.aws.neon.tech");
  });

  it("strictly blocks non-destructive seed if NODE_ENV is production", () => {
    const result = validateSeedTarget({
      nodeEnv: "production",
      databaseUrl: approvedEndpoint,
      isDestructive: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("prohibited in production");
  });

  it("strictly blocks non-destructive seed if targeting unapproved endpoint", () => {
    const result = validateSeedTarget({
      nodeEnv: "development",
      databaseUrl: "postgresql://user:pass@some-unknown-host.com/db",
      isDestructive: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not in the approved development allowlist");
  });
});
