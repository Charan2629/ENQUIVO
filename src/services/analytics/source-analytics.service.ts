import {
  PrismaClient,
  Prisma,
  UserRole,
  LeadSource,
  BookingStatus,
  AttendanceOutcome,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  SourceAnalyticsResponse,
  SourcePerformanceItem,
  SourceAnalyticsSummary,
  MultiTouchSourceBreakdown,
} from "@/types";
import {
  ValidatedSourceAnalyticsQuery,
  LEAD_SOURCE_META,
} from "@/lib/validations/analytics";

export class UnauthorizedAnalyticsAccessError extends Error {
  constructor(message = "Unauthorized analytics access") {
    super(message);
    this.name = "UnauthorizedAnalyticsAccessError";
  }
}

/**
 * Derives server-side record scoping for Lead queries in analytics:
 * - SALES_HEAD: Organization-wide visibility across all leads.
 * - SALES_EXEC: Strict relational scoping to leads assigned to that specific executive via conversation handoff.
 */
export function getStaffAnalyticsLeadScope(staffUser: {
  id: string;
  role: UserRole;
}): Prisma.LeadWhereInput {
  if (staffUser.role === UserRole.SALES_HEAD) {
    return { deletedAt: null };
  }
  if (staffUser.role === UserRole.SALES_EXEC) {
    return {
      deletedAt: null,
      conversations: {
        some: {
          handoff: {
            assignedToId: staffUser.id,
          },
        },
      },
    };
  }
  return { id: "UNAUTHORIZED_NO_MATCH" };
}

export class SourceAnalyticsService {
  private db: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.db = (prismaClient || defaultPrisma) as PrismaClient;
  }

  /**
   * Generates comprehensive source attribution and marketing performance analytics.
   *
   * @param query - Validated query parameters (monthYear, startDate, endDate, projectId)
   * @param staffUser - Authenticated staff session (id, role)
   */
  async getSourceAnalytics(
    query: ValidatedSourceAnalyticsQuery,
    staffUser: { id: string; role: UserRole }
  ): Promise<SourceAnalyticsResponse> {
    if (
      staffUser.role !== UserRole.SALES_HEAD &&
      staffUser.role !== UserRole.SALES_EXEC
    ) {
      throw new UnauthorizedAnalyticsAccessError(
        "Only Sales Executives and Sales Heads may access marketing source analytics."
      );
    }

    const isSalesHead = staffUser.role === UserRole.SALES_HEAD;
    const isSpendRestricted = !isSalesHead;
    const leadRoleScope = getStaffAnalyticsLeadScope(staffUser);

    // 1. Fetch available months from SourceSpend & Leads
    const existingSpends = await this.db.sourceSpend.findMany({
      select: { monthYear: true },
      distinct: ["monthYear"],
      orderBy: { monthYear: "desc" },
    });

    const monthSet = new Set<string>();
    (existingSpends ?? []).forEach((s) => monthSet.add(s.monthYear));
    monthSet.add("2026-11"); // Seed baseline month

    const availableMonths = Array.from(monthSet).sort().reverse();

    // Determine active month/date filters
    const selectedMonth = query.monthYear ?? (query.startDate || query.endDate ? "ALL" : "2026-11");

    let leadDateCondition: Prisma.DateTimeFilter | undefined;
    let spendMonthCondition: string | undefined;

    if (selectedMonth !== "ALL") {
      spendMonthCondition = selectedMonth;
      // Derive start and end of the selected YYYY-MM
      const [yearStr, monthStr] = selectedMonth.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      // End of month: first day of next month at 00:00:00 minus 1ms
      const endOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

      leadDateCondition = {
        gte: startOfMonth,
        lt: endOfMonth,
      };
    } else {
      if (query.startDate || query.endDate) {
        leadDateCondition = {
          ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
          ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
        };
      }
    }

    // Project filtering
    const projectCondition: Prisma.LeadWhereInput =
      query.projectId && query.projectId !== "ALL"
        ? { projectId: query.projectId }
        : {};

    const leadWhere: Prisma.LeadWhereInput = {
      AND: [
        leadRoleScope,
        projectCondition,
        leadDateCondition ? { createdAt: leadDateCondition } : {},
      ],
    };

    // 2. Query Source Spend (Only for SALES_HEAD; restricted for SALES_EXEC)
    const spendMap = new Map<LeadSource, bigint>();

    if (isSalesHead) {
      const spendWhereClause: Prisma.SourceSpendWhereInput = spendMonthCondition
        ? { monthYear: spendMonthCondition }
        : {};

      const spendRecords = await this.db.sourceSpend.findMany({
        where: spendWhereClause,
      });

      for (const record of spendRecords) {
        const current = spendMap.get(record.source) ?? BigInt(0);
        spendMap.set(record.source, current + record.amountPaise);
      }
    }

    // 3. Query Leads with their SiteVisits
    const leads = await this.db.lead.findMany({
      where: leadWhere,
      select: {
        id: true,
        source: true,
        createdAt: true,
        firstResponseAt: true,
        siteVisits: {
          select: {
            id: true,
            bookingStatus: true,
            attendanceOutcome: true,
          },
        },
      },
    });

    // 4. Query LeadSourceEvents for Multi-Touch breakdown
    const sourceEvents = await this.db.leadSourceEvent.findMany({
      where: {
        lead: leadWhere,
      },
      select: {
        id: true,
        source: true,
      },
    });

    // 5. Aggregate first-touch performance per source
    const allSources = Object.values(LeadSource);
    const totalDistinctLeads = leads.length;

    // Response time tracking (minutes)
    const responseTimesMinutes: number[] = [];
    for (const lead of leads) {
      if (lead.firstResponseAt && lead.createdAt) {
        const diffMs = lead.firstResponseAt.getTime() - lead.createdAt.getTime();
        if (diffMs >= 0) {
          responseTimesMinutes.push(Math.round(diffMs / (1000 * 60)));
        }
      }
    }

    responseTimesMinutes.sort((a, b) => a - b);
    let medianResponseTime: number | null = null;
    if (responseTimesMinutes.length > 0) {
      const mid = Math.floor(responseTimesMinutes.length / 2);
      medianResponseTime =
        responseTimesMinutes.length % 2 !== 0
          ? responseTimesMinutes[mid]
          : Math.round((responseTimesMinutes[mid - 1] + responseTimesMinutes[mid]) / 2);
    }

    let overallTotalSpendPaise = BigInt(0);
    let overallBookedVisits = 0;
    let overallAttendedVisits = 0;
    let overallDistinctLeadsWithVisits = 0;
    let overallDistinctLeadsWithAttended = 0;

    const sourcePerformanceItems: SourcePerformanceItem[] = allSources.map((source) => {
      const meta = LEAD_SOURCE_META[source];
      const sourceLeads = leads.filter((l) => l.source === source);
      const leadCount = sourceLeads.length;

      // Calculate spend for this source
      let spendRupees: number | null = null;
      let spendPaiseStr: string | null = null;

      if (isSalesHead) {
        const totalPaise = spendMap.get(source) ?? BigInt(0);
        overallTotalSpendPaise += totalPaise;
        spendRupees = Number(totalPaise / BigInt(100));
        spendPaiseStr = totalPaise.toString();
      }

      // Visit statistics for leads attributed to this source (First-Touch)
      let bookedVisitsCount = 0;
      let attendedVisitsCount = 0;
      let noShowVisitsCount = 0;
      let cancelledVisitsCount = 0;
      let distinctLeadsWithVisits = 0;
      let distinctLeadsWithAttended = 0;

      for (const lead of sourceLeads) {
        const validVisits = lead.siteVisits.filter(
          (v) => v.bookingStatus !== BookingStatus.CANCELLED
        );
        const attendedVisits = lead.siteVisits.filter(
          (v) => v.attendanceOutcome === AttendanceOutcome.ATTENDED
        );
        const noShowVisits = lead.siteVisits.filter(
          (v) => v.attendanceOutcome === AttendanceOutcome.NO_SHOW
        );
        const cancelled = lead.siteVisits.filter(
          (v) => v.bookingStatus === BookingStatus.CANCELLED
        );

        bookedVisitsCount += validVisits.length;
        attendedVisitsCount += attendedVisits.length;
        noShowVisitsCount += noShowVisits.length;
        cancelledVisitsCount += cancelled.length;

        if (validVisits.length > 0) {
          distinctLeadsWithVisits++;
        }
        if (attendedVisits.length > 0) {
          distinctLeadsWithAttended++;
        }
      }

      overallBookedVisits += bookedVisitsCount;
      overallAttendedVisits += attendedVisitsCount;
      overallDistinctLeadsWithVisits += distinctLeadsWithVisits;
      overallDistinctLeadsWithAttended += distinctLeadsWithAttended;

      const leadsPercentage =
        totalDistinctLeads > 0
          ? Number(((leadCount / totalDistinctLeads) * 100).toFixed(1))
          : 0;

      const leadToVisitRate =
        leadCount > 0
          ? Number(((distinctLeadsWithVisits / leadCount) * 100).toFixed(1))
          : 0;

      const leadToAttendedRate =
        leadCount > 0
          ? Number(((distinctLeadsWithAttended / leadCount) * 100).toFixed(1))
          : 0;

      const pastVisitsWithOutcome = attendedVisitsCount + noShowVisitsCount;
      const showUpRate =
        pastVisitsWithOutcome > 0
          ? Number(((attendedVisitsCount / pastVisitsWithOutcome) * 100).toFixed(1))
          : null;

      const costPerLeadRupees =
        spendRupees !== null && leadCount > 0
          ? Math.round(spendRupees / leadCount)
          : null;

      const costPerAttendedVisitRupees =
        spendRupees !== null && attendedVisitsCount > 0
          ? Math.round(spendRupees / attendedVisitsCount)
          : null;

      const costPerBookedVisitRupees =
        spendRupees !== null && bookedVisitsCount > 0
          ? Math.round(spendRupees / bookedVisitsCount)
          : null;

      const totalTouchpointEvents = sourceEvents.filter((e) => e.source === source).length;

      return {
        source,
        label: meta.label,
        color: meta.color,
        spendRupees,
        spendPaise: spendPaiseStr,
        totalLeads: leadCount,
        leadsPercentage,
        costPerLeadRupees,
        bookedVisitsCount,
        distinctLeadsWithVisitsCount: distinctLeadsWithVisits,
        attendedVisitsCount,
        distinctLeadsWithAttendedVisitsCount: distinctLeadsWithAttended,
        noShowVisitsCount,
        cancelledVisitsCount,
        leadToVisitRate,
        leadToAttendedRate,
        showUpRate,
        costPerAttendedVisitRupees,
        costPerBookedVisitRupees,
        totalTouchpointEvents,
      };
    });

    // 6. Multi-Touch Event Distribution
    const totalTouchpoints = sourceEvents.length;
    const multiTouchBreakdown: MultiTouchSourceBreakdown[] = allSources.map((source) => {
      const meta = LEAD_SOURCE_META[source];
      const count = sourceEvents.filter((e) => e.source === source).length;
      const percentage =
        totalTouchpoints > 0
          ? Number(((count / totalTouchpoints) * 100).toFixed(1))
          : 0;

      return {
        source,
        label: meta.label,
        count,
        percentage,
      };
    });

    // 7. Overall Summary
    const totalSpendRupees = isSalesHead
      ? Number(overallTotalSpendPaise / BigInt(100))
      : null;

    const overallCPLRupees =
      totalSpendRupees !== null && totalDistinctLeads > 0
        ? Math.round(totalSpendRupees / totalDistinctLeads)
        : null;

    const overallCPVAttendedRupees =
      totalSpendRupees !== null && overallAttendedVisits > 0
        ? Math.round(totalSpendRupees / overallAttendedVisits)
        : null;

    const overallCPVBookedRupees =
      totalSpendRupees !== null && overallBookedVisits > 0
        ? Math.round(totalSpendRupees / overallBookedVisits)
        : null;

    const overallLeadToVisitRate =
      totalDistinctLeads > 0
        ? Number(((overallDistinctLeadsWithVisits / totalDistinctLeads) * 100).toFixed(1))
        : 0;

    const overallLeadToAttendedRate =
      totalDistinctLeads > 0
        ? Number(((overallDistinctLeadsWithAttended / totalDistinctLeads) * 100).toFixed(1))
        : 0;

    const summary: SourceAnalyticsSummary = {
      totalSpendRupees,
      totalDistinctLeads,
      overallCPLRupees,
      totalBookedVisits: overallBookedVisits,
      totalAttendedVisits: overallAttendedVisits,
      overallLeadToVisitRate,
      overallLeadToAttendedRate,
      overallCPVAttendedRupees,
      overallCPVBookedRupees,
      firstResponseTimeMedianMinutes: medianResponseTime,
      industryBaselineMinutes: 840, // 14 hours
      isRevenueCaptured: false,
      revenueDisclaimer:
        "Commercial Sales Revenue & Closed Bookings Not Captured in CRM Model — Spend-Efficiency Only (Assumes ERP/Financial Ledger Segregation)",
      isSpendRestricted,
    };

    return {
      summary,
      sources: sourcePerformanceItems,
      multiTouchBreakdown,
      availableMonths,
      filterApplied: {
        monthYear: selectedMonth,
        startDate: query.startDate,
        endDate: query.endDate,
        projectId: query.projectId,
      },
    };
  }
}

export const sourceAnalyticsService = new SourceAnalyticsService();
