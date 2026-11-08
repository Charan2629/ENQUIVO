import { describe, it, expect, vi } from "vitest";
import { UserRole, VisitSlotStatus } from "@prisma/client";
import {
  createSlotSchema,
  updateSlotSchema,
  slotQuerySchema,
} from "@/lib/validations/slot";
import {
  BookingService,
  BookingConflictError,
  BookingNotFoundError,
} from "@/services/booking/booking.service";

describe("Slot Management Validation Schemas", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  describe("createSlotSchema", () => {
    it("accepts valid start and end times with duration >= 15 min", () => {
      const startsAt = new Date(`${tomorrowStr}T10:00:00Z`);
      const endsAt = new Date(`${tomorrowStr}T11:00:00Z`);

      const parsed = createSlotSchema.parse({
        startsAt,
        endsAt,
      });

      expect(parsed.startsAt).toEqual(startsAt);
      expect(parsed.endsAt).toEqual(endsAt);
      expect(parsed.location).toBe("Enquivo Sales Gallery, Ahmedabad");
    });

    it("rejects end time earlier than start time", () => {
      const startsAt = new Date(`${tomorrowStr}T11:00:00Z`);
      const endsAt = new Date(`${tomorrowStr}T10:00:00Z`);

      expect(() =>
        createSlotSchema.parse({
          startsAt,
          endsAt,
        })
      ).toThrow("End time must be after start time");
    });

    it("rejects duration less than 15 minutes", () => {
      const startsAt = new Date(`${tomorrowStr}T10:00:00Z`);
      const endsAt = new Date(`${tomorrowStr}T10:10:00Z`); // 10 mins

      expect(() =>
        createSlotSchema.parse({
          startsAt,
          endsAt,
        })
      ).toThrow("Slot duration must be at least 15 minutes");
    });
  });

  describe("updateSlotSchema", () => {
    it("accepts valid updates", () => {
      const parsed = updateSlotSchema.parse({
        location: "Enquivo Experience Center, SG Highway",
      });
      expect(parsed.location).toBe("Enquivo Experience Center, SG Highway");
    });

    it("rejects invalid end time when both start and end are provided", () => {
      const startsAt = new Date(`${tomorrowStr}T11:00:00Z`);
      const endsAt = new Date(`${tomorrowStr}T10:00:00Z`);

      expect(() =>
        updateSlotSchema.parse({
          startsAt,
          endsAt,
        })
      ).toThrow("End time must be after start time");
    });
  });

  describe("slotQuerySchema", () => {
    it("provides sensible defaults", () => {
      const parsed = slotQuerySchema.parse({});
      expect(parsed.status).toBe("ALL");
      expect(parsed.includePast).toBe(false);
      expect(parsed.limit).toBe(100);
    });

    it("coerces includePast true string to boolean", () => {
      const parsed = slotQuerySchema.parse({ includePast: "true" });
      expect(parsed.includePast).toBe(true);
    });
  });
});

describe("BookingService Slot Management Business Logic", () => {
  const salesHeadUser = { id: "head-1", role: UserRole.SALES_HEAD };
  const salesExecUser = { id: "exec-1", role: UserRole.SALES_EXEC };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startsAt = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);
  const endsAt = new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000);

  describe("createSlot", () => {
    it("rejects non-SALES_HEAD from creating appointment slots", async () => {
      const service = new BookingService({} as never);

      await expect(
        service.createSlot(
          {
            startsAt,
            endsAt,
            location: "Enquivo Sales Gallery, Ahmedabad",
          },
          salesExecUser
        )
      ).rejects.toThrow(BookingConflictError);
    });

    it("rejects slots scheduled in the past", async () => {
      const pastStart = new Date(Date.now() - 3600000);
      const pastEnd = new Date(Date.now() - 1800000);

      const service = new BookingService({} as never);

      await expect(
        service.createSlot(
          {
            startsAt: pastStart,
            endsAt: pastEnd,
            location: "Enquivo Gallery",
          },
          salesHeadUser
        )
      ).rejects.toThrow("Slot start time must be in the future");
    });

    it("successfully creates slot and formats IST strings", async () => {
      const mockDb = {
        visitSlot: {
          create: vi.fn().mockResolvedValue({
            id: "slot-new-1",
            startsAt,
            endsAt,
            status: VisitSlotStatus.AVAILABLE,
            location: "Enquivo Sales Gallery, Ahmedabad",
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      const service = new BookingService(mockDb as never);
      const result = await service.createSlot(
        {
          startsAt,
          endsAt,
          location: "Enquivo Sales Gallery, Ahmedabad",
        },
        salesHeadUser
      );

      expect(mockDb.visitSlot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: VisitSlotStatus.AVAILABLE,
          }),
        })
      );
      expect(result.id).toBe("slot-new-1");
      expect(result.startsAtIST).toContain("IST");
      expect(result.hasConfirmedBooking).toBe(false);
    });
  });

  describe("updateSlot", () => {
    it("rejects modifying a slot that has an active CONFIRMED booking", async () => {
      const mockDb = {
        visitSlot: {
          findUnique: vi.fn().mockResolvedValue({
            id: "slot-booked-1",
            startsAt,
            endsAt,
            status: VisitSlotStatus.BOOKED,
            location: "Enquivo Gallery",
            siteVisits: [{ id: "visit-1", bookingStatus: "CONFIRMED" }],
          }),
        },
      };

      const service = new BookingService(mockDb as never);
      await expect(
        service.updateSlot(
          "slot-booked-1",
          { location: "New Location" },
          salesHeadUser
        )
      ).rejects.toThrow("Cannot modify an appointment slot with an active confirmed booking");
    });

    it("throws BookingNotFoundError if slot does not exist", async () => {
      const mockDb = {
        visitSlot: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      const service = new BookingService(mockDb as never);
      await expect(
        service.updateSlot("nonexistent", { location: "New" }, salesHeadUser)
      ).rejects.toThrow(BookingNotFoundError);
    });
  });

  describe("deleteSlot", () => {
    it("rejects non-SALES_HEAD from deleting slots", async () => {
      const service = new BookingService({} as never);

      await expect(
        service.deleteSlot("slot-1", salesExecUser)
      ).rejects.toThrow(BookingConflictError);
    });

    it("rejects deleting a slot with historical bookings to preserve attribution audits", async () => {
      const mockDb = {
        visitSlot: {
          findUnique: vi.fn().mockResolvedValue({
            id: "slot-history-1",
            _count: { siteVisits: 1 },
          }),
        },
      };

      const service = new BookingService(mockDb as never);
      await expect(
        service.deleteSlot("slot-history-1", salesHeadUser)
      ).rejects.toThrow("Cannot delete an appointment slot with booking history");
    });

    it("deletes unbooked slot when no visits exist", async () => {
      const mockDb = {
        visitSlot: {
          findUnique: vi.fn().mockResolvedValue({
            id: "slot-clean-1",
            _count: { siteVisits: 0 },
          }),
          delete: vi.fn().mockResolvedValue({ id: "slot-clean-1" }),
        },
      };

      const service = new BookingService(mockDb as never);
      const result = await service.deleteSlot("slot-clean-1", salesHeadUser);

      expect(mockDb.visitSlot.delete).toHaveBeenCalledWith({
        where: { id: "slot-clean-1" },
      });
      expect(result.success).toBe(true);
    });
  });
});
