import { describe, it, expect } from "vitest";
import { UserRole, BookingStatus, AttendanceOutcome, LeadSource } from "@prisma/client";
import {
  computeLeadLifecycleStatus,
  getStaffLeadScope,
  getLifecycleStatusFilter,
} from "@/services/lead/lead.service";
import { leadQuerySchema } from "@/lib/validations/lead";

describe("Lead Pipeline Unit Tests (Milestone 6.2)", () => {
  describe("computeLeadLifecycleStatus", () => {
    it("1. classifies as VISITED when attendanceOutcome is ATTENDED", () => {
      const status = computeLeadLifecycleStatus({
        firstResponseAt: new Date(),
        siteVisits: [
          {
            bookingStatus: BookingStatus.COMPLETED,
            attendanceOutcome: AttendanceOutcome.ATTENDED,
          },
        ],
        conversations: [{ handoff: { id: "h-1" } }],
      });
      expect(status).toBe("VISITED");
    });

    it("2. classifies as BOOKED when bookingStatus is CONFIRMED", () => {
      const status = computeLeadLifecycleStatus({
        firstResponseAt: new Date(),
        siteVisits: [
          {
            bookingStatus: BookingStatus.CONFIRMED,
            attendanceOutcome: AttendanceOutcome.UNRECORDED,
          },
        ],
      });
      expect(status).toBe("BOOKED");
    });

    it("3. classifies as BOOKED when bookingStatus is COMPLETED but unrecorded attendance", () => {
      const status = computeLeadLifecycleStatus({
        firstResponseAt: new Date(),
        siteVisits: [
          {
            bookingStatus: BookingStatus.COMPLETED,
            attendanceOutcome: AttendanceOutcome.UNRECORDED,
          },
        ],
      });
      expect(status).toBe("BOOKED");
    });

    it("4. classifies as ESCALATED when conversation has an active handoff without visits", () => {
      const status = computeLeadLifecycleStatus({
        firstResponseAt: new Date(),
        siteVisits: [],
        conversations: [{ handoff: { id: "handoff-123" } }],
      });
      expect(status).toBe("ESCALATED");
    });

    it("5. classifies as ENGAGED when firstResponseAt exists without handoff or visits", () => {
      const status = computeLeadLifecycleStatus({
        firstResponseAt: new Date("2026-11-02T08:33:00.000Z"),
        siteVisits: [],
        conversations: [{ handoff: null }],
      });
      expect(status).toBe("ENGAGED");
    });

    it("6. classifies as ENGAGED when conversations exist without firstResponseAt or visits", () => {
      const status = computeLeadLifecycleStatus({
        firstResponseAt: null,
        siteVisits: [],
        conversations: [{ handoff: null }],
      });
      expect(status).toBe("ENGAGED");
    });

    it("7. classifies as NEW when no response, conversations, or visits exist", () => {
      const status = computeLeadLifecycleStatus({
        firstResponseAt: null,
        siteVisits: [],
        conversations: [],
      });
      expect(status).toBe("NEW");
    });

    it("8. classifies multiple visits (ATTENDED + CONFIRMED) as VISITED by highest precedence", () => {
      const status = computeLeadLifecycleStatus({
        firstResponseAt: new Date(),
        siteVisits: [
          {
            bookingStatus: BookingStatus.COMPLETED,
            attendanceOutcome: AttendanceOutcome.ATTENDED,
          },
          {
            bookingStatus: BookingStatus.CONFIRMED,
            attendanceOutcome: AttendanceOutcome.UNRECORDED,
          },
        ],
      });
      expect(status).toBe("VISITED");
    });

    it("9. classifies multiple visits (CANCELLED + CONFIRMED) as BOOKED", () => {
      const status = computeLeadLifecycleStatus({
        firstResponseAt: new Date(),
        siteVisits: [
          {
            bookingStatus: BookingStatus.CANCELLED,
            attendanceOutcome: AttendanceOutcome.UNRECORDED,
          },
          {
            bookingStatus: BookingStatus.CONFIRMED,
            attendanceOutcome: AttendanceOutcome.UNRECORDED,
          },
        ],
      });
      expect(status).toBe("BOOKED");
    });

    it("10. classifies ONLY CANCELLED visits as ENGAGED (engaged with booking, not yet booked)", () => {
      const status = computeLeadLifecycleStatus({
        firstResponseAt: null,
        siteVisits: [
          {
            bookingStatus: BookingStatus.CANCELLED,
            attendanceOutcome: AttendanceOutcome.UNRECORDED,
          },
        ],
        conversations: [],
      });
      expect(status).toBe("ENGAGED");
    });

    it("11. classifies active handoff with cancelled visit as ESCALATED", () => {
      const status = computeLeadLifecycleStatus({
        firstResponseAt: new Date(),
        siteVisits: [
          {
            bookingStatus: BookingStatus.CANCELLED,
            attendanceOutcome: AttendanceOutcome.UNRECORDED,
          },
        ],
        conversations: [{ handoff: { id: "h-99" } }],
      });
      expect(status).toBe("ESCALATED");
    });

    it("12. verifies active handoff transitions from ESCALATED to BOOKED once a visit is confirmed (lifecycle metric accuracy)", () => {
      const statusWithHandoffOnly = computeLeadLifecycleStatus({
        firstResponseAt: new Date(),
        siteVisits: [],
        conversations: [{ handoff: { id: "h-1" } }],
      });
      expect(statusWithHandoffOnly).toBe("ESCALATED");

      const statusAfterVisitBooked = computeLeadLifecycleStatus({
        firstResponseAt: new Date(),
        siteVisits: [
          {
            bookingStatus: BookingStatus.CONFIRMED,
            attendanceOutcome: AttendanceOutcome.UNRECORDED,
          },
        ],
        conversations: [{ handoff: { id: "h-1" } }],
      });
      expect(statusAfterVisitBooked).toBe("BOOKED");
    });
  });

  describe("getStaffLeadScope", () => {
    it("1. returns unrestricted scope for SALES_HEAD", () => {
      const scope = getStaffLeadScope({
        id: "head-1",
        role: UserRole.SALES_HEAD,
      });
      expect(scope).toEqual({ deletedAt: null });
    });

    it("2. returns assigned handoff filter for SALES_EXEC", () => {
      const scope = getStaffLeadScope({
        id: "exec-99",
        role: UserRole.SALES_EXEC,
      });
      expect(scope).toEqual({
        deletedAt: null,
        conversations: {
          some: {
            handoff: {
              assignedToId: "exec-99",
            },
          },
        },
      });
    });

    it("3. throws error when non-staff role (e.g. BUYER) requests lead scope", () => {
      expect(() =>
        getStaffLeadScope({
          id: "buyer-1",
          role: UserRole.BUYER,
        })
      ).toThrow("Unauthorized: Staff permissions required");
    });
  });

  describe("getLifecycleStatusFilter", () => {
    it("1. maps ALL and empty inputs to an empty filter object", () => {
      expect(getLifecycleStatusFilter("ALL")).toEqual({});
      expect(getLifecycleStatusFilter()).toEqual({});
    });

    it("2. maps VISITED to attendanceOutcome ATTENDED", () => {
      expect(getLifecycleStatusFilter("VISITED")).toEqual({
        siteVisits: {
          some: { attendanceOutcome: AttendanceOutcome.ATTENDED },
        },
      });
    });

    it("3. maps BOOKED to confirmed or completed visits without attended", () => {
      expect(getLifecycleStatusFilter("BOOKED")).toEqual({
        siteVisits: {
          some: {
            bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          },
          none: {
            attendanceOutcome: AttendanceOutcome.ATTENDED,
          },
        },
      });
    });

    it("4. maps ESCALATED to active handoff and no booked or attended visits", () => {
      expect(getLifecycleStatusFilter("ESCALATED")).toEqual({
        conversations: {
          some: { handoff: { isNot: null } },
        },
        siteVisits: {
          none: {
            OR: [
              { attendanceOutcome: AttendanceOutcome.ATTENDED },
              { bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
            ],
          },
        },
      });
    });

    it("5. maps ENGAGED to response/conversations/cancelled visits with no bookings or handoffs", () => {
      expect(getLifecycleStatusFilter("ENGAGED")).toEqual({
        OR: [
          { firstResponseAt: { not: null } },
          { conversations: { some: {} } },
          { siteVisits: { some: {} } },
        ],
        siteVisits: {
          none: {
            OR: [
              { attendanceOutcome: AttendanceOutcome.ATTENDED },
              { bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
            ],
          },
        },
        conversations: {
          none: { handoff: { isNot: null } },
        },
      });
    });

    it("6. maps NEW to null firstResponse, no conversations, and no site visits", () => {
      expect(getLifecycleStatusFilter("NEW")).toEqual({
        firstResponseAt: null,
        conversations: { none: {} },
        siteVisits: { none: {} },
      });
    });
  });

  describe("leadQuerySchema Zod Validation", () => {
    it("1. parses valid query parameters with standard defaults", () => {
      const result = leadQuerySchema.parse({});
      expect(result).toEqual({
        page: 1,
        limit: 10,
        status: "ALL",
        sortBy: "createdAt",
        sortOrder: "desc",
      });
    });

    it("2. coerces string numbers for page and limit", () => {
      const result = leadQuerySchema.parse({
        page: "3",
        limit: "25",
        search: "  Hardik Patel  ",
        source: LeadSource.PROPERTY_PORTAL,
        status: "BOOKED",
        sortBy: "name",
        sortOrder: "asc",
      });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
      expect(result.search).toBe("Hardik Patel");
      expect(result.source).toBe(LeadSource.PROPERTY_PORTAL);
      expect(result.status).toBe("BOOKED");
      expect(result.sortBy).toBe("name");
      expect(result.sortOrder).toBe("asc");
    });

    it("3. rejects page < 1 and limit > 50", () => {
      expect(() => leadQuerySchema.parse({ page: 0 })).toThrow();
      expect(() => leadQuerySchema.parse({ limit: 100 })).toThrow();
    });

    it("4. rejects invalid status and invalid source enums", () => {
      expect(() => leadQuerySchema.parse({ status: "INVALID_STATUS" })).toThrow();
      expect(() => leadQuerySchema.parse({ source: "TELEVISION_AD" })).toThrow();
    });
  });
});
