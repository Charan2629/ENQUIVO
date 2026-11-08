import { describe, it, expect, vi } from "vitest";
import {
  UserRole,
  LeadSource,
  BookingStatus,
  AttendanceOutcome,
} from "@prisma/client";
import {
  sourceAnalyticsQuerySchema,
  LEAD_SOURCE_META,
} from "@/lib/validations/analytics";
import {
  SourceAnalyticsService,
  UnauthorizedAnalyticsAccessError,
  getStaffAnalyticsLeadScope,
} from "@/services/analytics/source-analytics.service";

describe("Source Analytics Query Validation", () => {
  it("accepts valid query parameters", () => {
    const parsed = sourceAnalyticsQuerySchema.parse({
      monthYear: "2026-11",
      projectId: "proj-123",
    });
    expect(parsed.monthYear).toBe("2026-11");
    expect(parsed.projectId).toBe("proj-123");
  });

  it("accepts monthYear='ALL' and projectId='ALL'", () => {
    const parsed = sourceAnalyticsQuerySchema.parse({
      monthYear: "ALL",
      projectId: "ALL",
    });
    expect(parsed.monthYear).toBe("ALL");
    expect(parsed.projectId).toBe("ALL");
  });

  it("rejects invalid monthYear format", () => {
    expect(() =>
      sourceAnalyticsQuerySchema.parse({
        monthYear: "2026-1", // Must be YYYY-MM
      })
    ).toThrow();

    expect(() =>
      sourceAnalyticsQuerySchema.parse({
        monthYear: "invalid-month",
      })
    ).toThrow();
  });

  it("accepts valid date range strings", () => {
    const parsed = sourceAnalyticsQuerySchema.parse({
      startDate: "2026-11-01T00:00:00.000Z",
      endDate: "2026-11-30T23:59:59.999Z",
    });
    expect(parsed.startDate).toBe("2026-11-01T00:00:00.000Z");
    expect(parsed.endDate).toBe("2026-11-30T23:59:59.999Z");
  });
});

describe("Lead Source Metadata", () => {
  it("defines metadata for all 6 LeadSource enum values", () => {
    const allSources = Object.values(LeadSource);
    expect(allSources).toHaveLength(6);

    for (const source of allSources) {
      const meta = LEAD_SOURCE_META[source];
      expect(meta).toBeDefined();
      expect(meta.label).toBeTypeOf("string");
      expect(meta.description).toBeTypeOf("string");
      expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("Staff Scoping Rules for Analytics", () => {
  it("returns unrestricted lead scope for SALES_HEAD", () => {
    const scope = getStaffAnalyticsLeadScope({
      id: "head-1",
      role: UserRole.SALES_HEAD,
    });
    expect(scope).toEqual({ deletedAt: null });
  });

  it("returns scoped query filtering by assigned executive for SALES_EXEC", () => {
    const scope = getStaffAnalyticsLeadScope({
      id: "exec-42",
      role: UserRole.SALES_EXEC,
    });
    expect(scope).toEqual({
      deletedAt: null,
      conversations: {
        some: {
          handoff: {
            assignedToId: "exec-42",
          },
        },
      },
    });
  });

  it("returns non-matching condition for other roles", () => {
    const scope = getStaffAnalyticsLeadScope({
      id: "buyer-1",
      role: UserRole.BUYER,
    });
    expect(scope).toEqual({ id: "UNAUTHORIZED_NO_MATCH" });
  });
});

describe("SourceAnalyticsService Calculations & Policy Enforcements", () => {
  const mockStaffHead = { id: "head-1", role: UserRole.SALES_HEAD };
  const mockStaffExec = { id: "exec-1", role: UserRole.SALES_EXEC };
  const mockBuyer = { id: "buyer-1", role: UserRole.BUYER };

  it("rejects unauthorized access for non-staff roles", async () => {
    const service = new SourceAnalyticsService({} as never);
    await expect(
      service.getSourceAnalytics({}, mockBuyer)
    ).rejects.toThrow(UnauthorizedAnalyticsAccessError);
  });

  it("computes accurate first-touch metrics, CPL, CPV, and conversion rates for SALES_HEAD", async () => {
    const mockDb = {
      sourceSpend: {
        findMany: vi.fn().mockImplementation(async (args?: { select?: { monthYear?: boolean } }) => {
          if (args?.select?.monthYear) {
            return [{ monthYear: "2026-11" }];
          }
          return [
            {
              source: LeadSource.PROPERTY_PORTAL,
              monthYear: "2026-11",
              amountPaise: BigInt(120000000), // ₹12,00,000
            },
            {
              source: LeadSource.SOCIAL_MEDIA_AD,
              monthYear: "2026-11",
              amountPaise: BigInt(80000000), // ₹8,00,000
            },
          ];
        }),
      },
      lead: {
        findMany: vi.fn().mockResolvedValue([
          // Lead 1: Property Portal, has 1 confirmed visit that was attended
          {
            id: "lead-1",
            source: LeadSource.PROPERTY_PORTAL,
            createdAt: new Date("2026-11-01T10:00:00Z"),
            firstResponseAt: new Date("2026-11-01T10:02:00Z"), // 2 min
            siteVisits: [
              {
                id: "visit-1",
                bookingStatus: BookingStatus.COMPLETED,
                attendanceOutcome: AttendanceOutcome.ATTENDED,
              },
            ],
          },
          // Lead 2: Property Portal, has 1 visit that was a no-show
          {
            id: "lead-2",
            source: LeadSource.PROPERTY_PORTAL,
            createdAt: new Date("2026-11-02T10:00:00Z"),
            firstResponseAt: new Date("2026-11-02T10:06:00Z"), // 6 min
            siteVisits: [
              {
                id: "visit-2",
                bookingStatus: BookingStatus.COMPLETED,
                attendanceOutcome: AttendanceOutcome.NO_SHOW,
              },
            ],
          },
          // Lead 3: Social Media Ad, no visits booked
          {
            id: "lead-3",
            source: LeadSource.SOCIAL_MEDIA_AD,
            createdAt: new Date("2026-11-03T10:00:00Z"),
            firstResponseAt: new Date("2026-11-03T10:04:00Z"), // 4 min
            siteVisits: [],
          },
          // Lead 4: Social Media Ad, has 1 cancelled visit (should not count as booked or attended)
          {
            id: "lead-4",
            source: LeadSource.SOCIAL_MEDIA_AD,
            createdAt: new Date("2026-11-03T12:00:00Z"),
            firstResponseAt: null,
            siteVisits: [
              {
                id: "visit-3",
                bookingStatus: BookingStatus.CANCELLED,
                attendanceOutcome: AttendanceOutcome.UNRECORDED,
              },
            ],
          },
        ]),
      },
      leadSourceEvent: {
        findMany: vi.fn().mockResolvedValue([
          { id: "e1", source: LeadSource.PROPERTY_PORTAL },
          { id: "e2", source: LeadSource.PROPERTY_PORTAL },
          { id: "e3", source: LeadSource.SOCIAL_MEDIA_AD },
        ]),
      },
    };

    const service = new SourceAnalyticsService(mockDb as never);
    const result = await service.getSourceAnalytics({ monthYear: "2026-11" }, mockStaffHead);

    // Summary checks
    expect(result.summary.isSpendRestricted).toBe(false);
    expect(result.summary.totalSpendRupees).toBe(2000000); // ₹12L + ₹8L = ₹20L
    expect(result.summary.totalDistinctLeads).toBe(4);
    // Overall CPL: ₹20,00,000 / 4 = ₹5,00,000
    expect(result.summary.overallCPLRupees).toBe(500000);
    expect(result.summary.totalBookedVisits).toBe(2); // visit-1, visit-2 (visit-3 was cancelled)
    expect(result.summary.totalAttendedVisits).toBe(1); // visit-1
    expect(result.summary.overallLeadToVisitRate).toBe(50); // 2 out of 4 distinct leads booked a visit = 50%
    expect(result.summary.overallLeadToAttendedRate).toBe(25); // 1 out of 4 distinct leads attended = 25%
    expect(result.summary.overallCPVAttendedRupees).toBe(2000000); // ₹20L / 1 attended visit
    expect(result.summary.overallCPVBookedRupees).toBe(1000000); // ₹20L / 2 booked visits

    // Median response time: differences are [2, 6, 4] -> sorted [2, 4, 6] -> median = 4 min
    expect(result.summary.firstResponseTimeMedianMinutes).toBe(4);

    // Channel specific checks: Property Portal
    const portal = result.sources.find((s) => s.source === LeadSource.PROPERTY_PORTAL)!;
    expect(portal.totalLeads).toBe(2);
    expect(portal.spendRupees).toBe(1200000);
    expect(portal.costPerLeadRupees).toBe(600000); // ₹12L / 2
    expect(portal.bookedVisitsCount).toBe(2);
    expect(portal.attendedVisitsCount).toBe(1);
    expect(portal.noShowVisitsCount).toBe(1);
    // Show-up rate: 1 attended / (1 attended + 1 no-show) = 50%
    expect(portal.showUpRate).toBe(50);
    // Cost per attended visit: ₹12L / 1 = ₹12L
    expect(portal.costPerAttendedVisitRupees).toBe(1200000);
    expect(portal.leadToVisitRate).toBe(100); // 2 of 2 leads visited
    expect(portal.leadToAttendedRate).toBe(50); // 1 of 2 leads attended

    // Channel specific checks: Social Media Ad
    const social = result.sources.find((s) => s.source === LeadSource.SOCIAL_MEDIA_AD)!;
    expect(social.totalLeads).toBe(2);
    expect(social.spendRupees).toBe(800000);
    expect(social.costPerLeadRupees).toBe(400000);
    expect(social.bookedVisitsCount).toBe(0); // cancelled visit is not counted
    expect(social.attendedVisitsCount).toBe(0);
    expect(social.cancelledVisitsCount).toBe(1);
    expect(social.showUpRate).toBeNull(); // 0 attended + 0 no-show
    expect(social.costPerAttendedVisitRupees).toBeNull(); // 0 attended -> null (never divide by zero)

    // Unfunded channels (e.g. Website, Referral)
    const referral = result.sources.find((s) => s.source === LeadSource.REFERRAL)!;
    expect(referral.totalLeads).toBe(0);
    expect(referral.spendRupees).toBe(0);
    expect(referral.costPerLeadRupees).toBeNull(); // 0 leads -> null CPL

    // Multi-touch breakdown checks
    expect(result.multiTouchBreakdown).toHaveLength(6);
    const portalEvents = result.multiTouchBreakdown.find((m) => m.source === LeadSource.PROPERTY_PORTAL)!;
    expect(portalEvents.count).toBe(2);
    expect(portalEvents.percentage).toBe(66.7); // 2 out of 3 = 66.7%
  });

  it("strictly enforces spend privacy and scoping for SALES_EXEC role", async () => {
    const mockDb = {
      sourceSpend: {
        findMany: vi.fn().mockResolvedValue([]), // Return empty array for month listing
      },
      lead: {
        findMany: vi.fn().mockImplementation(async (args: { where: { AND: Array<{ deletedAt: null; conversations?: { some: { handoff: { assignedToId: string } } } }> } }) => {
          // Verify that query included executive scoping
          expect(args.where.AND[0]).toEqual({
            deletedAt: null,
            conversations: {
              some: {
                handoff: {
                  assignedToId: "exec-1",
                },
              },
            },
          });
          return [
            {
              id: "assigned-lead-1",
              source: LeadSource.WEBSITE,
              createdAt: new Date("2026-11-01T10:00:00Z"),
              firstResponseAt: new Date("2026-11-01T10:01:00Z"),
              siteVisits: [
                {
                  id: "v-1",
                  bookingStatus: BookingStatus.COMPLETED,
                  attendanceOutcome: AttendanceOutcome.ATTENDED,
                },
              ],
            },
          ];
        }),
      },
      leadSourceEvent: {
        findMany: vi.fn().mockResolvedValue([
          { id: "e1", source: LeadSource.WEBSITE },
        ]),
      },
    };

    const service = new SourceAnalyticsService(mockDb as never);
    const result = await service.getSourceAnalytics({ monthYear: "2026-11" }, mockStaffExec);

    // Spend is strictly restricted
    expect(result.summary.isSpendRestricted).toBe(true);
    expect(result.summary.totalSpendRupees).toBeNull();
    expect(result.summary.overallCPLRupees).toBeNull();
    expect(result.summary.overallCPVAttendedRupees).toBeNull();
    expect(result.summary.overallCPVBookedRupees).toBeNull();

    // Source performance items must not leak spend or CPL
    for (const source of result.sources) {
      expect(source.spendRupees).toBeNull();
      expect(source.spendPaise).toBeNull();
      expect(source.costPerLeadRupees).toBeNull();
      expect(source.costPerAttendedVisitRupees).toBeNull();
      expect(source.costPerBookedVisitRupees).toBeNull();
    }

    // Lead counts and conversion rates remain visible for assigned leads
    const website = result.sources.find((s) => s.source === LeadSource.WEBSITE)!;
    expect(website.totalLeads).toBe(1);
    expect(website.bookedVisitsCount).toBe(1);
    expect(website.attendedVisitsCount).toBe(1);
    expect(website.leadToVisitRate).toBe(100);
    expect(website.leadToAttendedRate).toBe(100);
    expect(website.showUpRate).toBe(100);
  });

  it("handles zero leads and zero visits gracefully without division-by-zero errors", async () => {
    const mockDb = {
      sourceSpend: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      lead: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      leadSourceEvent: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new SourceAnalyticsService(mockDb as never);
    const result = await service.getSourceAnalytics({ monthYear: "2026-11" }, mockStaffHead);

    expect(result.summary.totalDistinctLeads).toBe(0);
    expect(result.summary.totalSpendRupees).toBe(0);
    expect(result.summary.overallCPLRupees).toBeNull();
    expect(result.summary.overallLeadToVisitRate).toBe(0);
    expect(result.summary.overallLeadToAttendedRate).toBe(0);
    expect(result.summary.overallCPVAttendedRupees).toBeNull();
    expect(result.summary.firstResponseTimeMedianMinutes).toBeNull();
  });
});
