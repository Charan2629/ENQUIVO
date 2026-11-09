import {
  PrismaClient,
  Prisma,
  Lead,
  LeadSourceEvent,
  ConsentRecord,
  UserRole,
  BookingStatus,
  AttendanceOutcome,
  LeadSource,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  ingestLeadSchema,
  IngestLeadInput,
  ValidatedLeadInput,
  generateLeadCode,
  normalizePhoneNumber,
  ValidatedLeadQuery,
  LeadLifecycleStatus,
} from "@/lib/validations/lead";
import {
  LeadListItem,
  LeadPagination,
  LeadMetrics,
  LeadDetail,
} from "@/types";

export interface IngestLeadResult {
  lead: Lead;
  isNew: boolean;
  sourceEvent: LeadSourceEvent;
  consentRecord: ConsentRecord | null;
}

/**
 * Computes a lead's current lifecycle stage based on domain events and relationships.
 * Precedence: VISITED > BOOKED > ESCALATED > ENGAGED > NEW.
 */
export function computeLeadLifecycleStatus(lead: {
  firstResponseAt: Date | null;
  siteVisits?: Array<{ bookingStatus: BookingStatus; attendanceOutcome: AttendanceOutcome }>;
  conversations?: Array<{ handoff?: { id: string } | null }>;
}): LeadLifecycleStatus {
  // 1. Visited takes highest priority: any visit marked ATTENDED
  if (lead.siteVisits?.some((v) => v.attendanceOutcome === AttendanceOutcome.ATTENDED)) {
    return "VISITED";
  }
  // 2. Booked: confirmed booking (or completed historical booking without verified attendance)
  if (
    lead.siteVisits?.some(
      (v) =>
        v.bookingStatus === BookingStatus.CONFIRMED ||
        (v.bookingStatus === BookingStatus.COMPLETED && v.attendanceOutcome !== AttendanceOutcome.ATTENDED)
    )
  ) {
    return "BOOKED";
  }
  // 3. Escalated: active conversation handoff
  if (lead.conversations?.some((c) => !!c.handoff)) {
    return "ESCALATED";
  }
  // 4. Engaged: first response recorded, active conversations, or historical visits (e.g. cancelled)
  if (
    lead.firstResponseAt ||
    (lead.conversations && lead.conversations.length > 0) ||
    (lead.siteVisits && lead.siteVisits.length > 0)
  ) {
    return "ENGAGED";
  }
  // 5. Brand new lead: zero response, zero conversations, zero visits
  return "NEW";
}

/**
 * Enforces server-side record scoping per staff role:
 * - SALES_HEAD: organizational visibility over all active leads.
 * - SALES_EXEC: strictly restricted to leads assigned to that executive via conversation handoff.
 */
export function getStaffLeadScope(staffUser: { id: string; role: UserRole }): Prisma.LeadWhereInput {
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
  throw new Error("Unauthorized: Staff permissions required");
}

/**
 * Maps lifecycle status filters to database relational conditions with strict priority parity:
 * VISITED > BOOKED > ESCALATED > ENGAGED > NEW.
 */
export function getLifecycleStatusFilter(status?: string): Prisma.LeadWhereInput {
  if (!status || status === "ALL") return {};

  switch (status) {
    case "VISITED":
      return {
        siteVisits: {
          some: { attendanceOutcome: AttendanceOutcome.ATTENDED },
        },
      };
    case "BOOKED":
      return {
        siteVisits: {
          some: {
            bookingStatus: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          },
          none: {
            attendanceOutcome: AttendanceOutcome.ATTENDED,
          },
        },
      };
    case "ESCALATED":
      return {
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
      };
    case "ENGAGED":
      return {
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
      };
    case "NEW":
      return {
        firstResponseAt: null,
        conversations: { none: {} },
        siteVisits: { none: {} },
      };
    default:
      return {};
  }
}

export class LeadService {
  /**
   * Constructor dependency injection allows injecting an isolated Prisma client
   * (e.g. testPrisma targeting an isolated test branch) during integration tests,
   * while defaulting cleanly to the application singleton in production route handlers.
   */
  constructor(private db: PrismaClient = defaultPrisma) {}

  /**
   * Ingests a lead from any acquisition channel (portal, ads, website, phone).
   *
   * Responsibilities:
   * 1. Validates input schema and normalizes phone (to E.164) and email (lowercase).
   * 2. Atomic duplicate detection by normalized phone.
   * 3. Retains immutable first-touch attribution (`Lead.source`) for returning leads.
   * 4. Enriches missing lead fields conditionally without overwriting existing data.
   * 5. Appends a new `LeadSourceEvent` touchpoint to the audit ledger.
   * 6. Safely handles DPDP consent without overriding prior opt-out choices.
   * 7. Concurrency-safe: catches P2002 race conditions outside aborted transactions.
   */
  async ingestLead(input: IngestLeadInput): Promise<IngestLeadResult> {
    const validated = ingestLeadSchema.parse(input);
    const normalizedPhone = validated.phone;
    const normalizedEmail = validated.email ?? null;

    const maxCodeRetries = 3;
    let attempts = 0;

    while (attempts < maxCodeRetries) {
      attempts++;
      const leadCode = generateLeadCode();

      try {
        // Phase 1: Interactive Transaction
        return await this.db.$transaction(
          async (tx) => {
            // Check for existing active (non-deleted) lead
            const existingLead = await tx.lead.findFirst({
              where: { phone: normalizedPhone, deletedAt: null },
            });

            if (existingLead) {
              return await this.executeMerge(tx, existingLead, validated, normalizedEmail);
            }

            return await this.executeCreate(
              tx,
              validated,
              normalizedPhone,
              normalizedEmail,
              leadCode
            );
          },
          {
            maxWait: 10000, // 10s wait to acquire transaction connection over WAN
            timeout: 15000, // 15s execution timeout
          }
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const target = Array.isArray(error.meta?.target)
            ? error.meta.target.join(",")
            : String(error.meta?.target ?? "");

          // Case A: Phone collision (a concurrent request won the insertion race)
          if (target.includes("phone") || error.message.includes("leads_phone_key")) {
            // Note: Transaction 1 has rolled back and is aborted.
            // Query the winning active lead outside the dead transaction using this.db.
            let winningLead = await this.db.lead.findFirst({
              where: { phone: normalizedPhone, deletedAt: null },
            });

            // If the winning concurrent transaction is still finalizing its commit, retry lookup with backoff
            if (!winningLead) {
              for (let retry = 0; retry < 5 && !winningLead; retry++) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                winningLead = await this.db.lead.findFirst({
                  where: { phone: normalizedPhone, deletedAt: null },
                });
              }
            }

            if (winningLead) {
              // Open a fresh, independent transaction to perform conditional enrichment and append the touchpoint
              return await this.db.$transaction(
                async (tx2) => {
                  return await this.executeMerge(tx2, winningLead, validated, normalizedEmail);
                },
                {
                  maxWait: 10000,
                  timeout: 15000,
                }
              );
            }
          }

          // Case B: leadCode uniqueness collision
          if (target.includes("lead_code") || target.includes("leadCode")) {
            if (attempts < maxCodeRetries) {
              continue; // Retry with a newly generated leadCode
            }
            throw new Error("Failed to generate a unique leadCode after maximum retries");
          }
        }

        // Re-throw any other database or application error
        throw error;
      }
    }

    throw new Error("Failed to ingest lead: maximum retries exceeded");
  }

  /**
   * Retrieves an active lead by unique ID with associated touchpoint events and consent.
   */
  async getLeadById(id: string): Promise<(Lead & { sourceEvents: LeadSourceEvent[]; consentRecord: ConsentRecord | null }) | null> {
    return this.db.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        sourceEvents: {
          orderBy: { occurredAt: "asc" },
        },
        consentRecord: true,
      },
    });
  }

  /**
   * Finds an active lead by phone number (normalizing input first).
   */
  async getLeadByPhone(rawPhone: string): Promise<Lead | null> {
    const normalizedPhone = normalizePhoneNumber(rawPhone);
    return this.db.lead.findFirst({
      where: { phone: normalizedPhone, deletedAt: null },
    });
  }

  /**
   * Records a new lead creation and initial touchpoint inside a transaction.
   */
  private async executeCreate(
    tx: Prisma.TransactionClient,
    validated: ValidatedLeadInput,
    phone: string,
    email: string | null,
    leadCode: string
  ): Promise<IngestLeadResult> {
    const lead = await tx.lead.create({
      data: {
        leadCode,
        name: validated.name,
        phone,
        email,
        source: validated.source, // Immutable first-touch attribution
        projectId: validated.projectId ?? null,
        configuration: validated.configuration ?? null,
      },
    });

    const sourceEvent = await tx.leadSourceEvent.create({
      data: {
        leadId: lead.id,
        source: validated.source,
        campaign: validated.campaign ?? null,
      },
    });

    let consentRecord: ConsentRecord | null = null;
    if (validated.consent) {
      consentRecord = await tx.consentRecord.create({
        data: {
          leadId: lead.id,
          consentText: validated.consent.consentText,
          consentedAt: new Date(),
          optedOut: false,
        },
      });
    }

    return {
      lead,
      isNew: true,
      sourceEvent,
      consentRecord,
    };
  }

  /**
   * Merges an incoming interaction into an existing lead record inside a transaction.
   *
   * Enforces:
   * 1. Immutable first-touch attribution: `Lead.source` is NEVER updated.
   * 2. Atomic conditional enrichment: only fields that are currently NULL in PostgreSQL are updated.
   * 3. Appending a new `LeadSourceEvent` row for every interaction touchpoint.
   * 4. Safe DPDP consent handling: preserves prior opt-out and active consent history.
   */
  private async executeMerge(
    tx: Prisma.TransactionClient,
    existing: Lead,
    validated: ValidatedLeadInput,
    email: string | null
  ): Promise<IngestLeadResult> {
    // 1. Conditional Enrichment: atomic updateMany ensures we never overwrite non-null values
    if (!existing.email && email) {
      await tx.lead.updateMany({
        where: { id: existing.id, email: null, deletedAt: null },
        data: { email },
      });
    }

    if (!existing.projectId && validated.projectId) {
      await tx.lead.updateMany({
        where: { id: existing.id, projectId: null, deletedAt: null },
        data: { projectId: validated.projectId },
      });
    }

    if (!existing.configuration && validated.configuration) {
      await tx.lead.updateMany({
        where: { id: existing.id, configuration: null, deletedAt: null },
        data: { configuration: validated.configuration },
      });
    }

    // Re-fetch the refreshed lead to return the latest consistent state
    const refreshedLead = await tx.lead.findUniqueOrThrow({
      where: { id: existing.id },
    });

    // 2. Append the new touchpoint to LeadSourceEvent
    const sourceEvent = await tx.leadSourceEvent.create({
      data: {
        leadId: existing.id,
        source: validated.source,
        campaign: validated.campaign ?? null,
      },
    });

    // 3. DPDP Consent Handling
    let consentRecord: ConsentRecord | null = null;
    if (validated.consent) {
      // Use upsert to atomically insert if absent or preserve existing record if already present.
      // With update: {}, PostgreSQL executes ON CONFLICT ("lead_id") DO NOTHING / no-op UPDATE,
      // which guarantees atomic idempotency without raising a P2002 error that would abort the transaction.
      // This strictly preserves prior consent history and opt-out status (optedOut: true).
      consentRecord = await tx.consentRecord.upsert({
        where: { leadId: existing.id },
        create: {
          leadId: existing.id,
          consentText: validated.consent.consentText,
          consentedAt: new Date(),
          optedOut: false,
        },
        update: {},
      });
    }

    return {
      lead: refreshedLead,
      isNew: false,
      sourceEvent,
      consentRecord,
    };
  }

  /**
   * Retrieves a paginated list of leads with server-side authorization scoping,
   * keyword search, multi-field filtering, and sorting.
   */
  async getLeads(
    params: ValidatedLeadQuery,
    staffUser: { id: string; role: UserRole }
  ): Promise<{ leads: LeadListItem[]; pagination: LeadPagination }> {
    const roleScope = getStaffLeadScope(staffUser);
    const statusFilter = getLifecycleStatusFilter(params.status);

    const andConditions: Prisma.LeadWhereInput[] = [roleScope, statusFilter];

    if (params.search) {
      andConditions.push({
        OR: [
          { leadCode: { contains: params.search, mode: "insensitive" } },
          { name: { contains: params.search, mode: "insensitive" } },
          { phone: { contains: params.search, mode: "insensitive" } },
          { email: { contains: params.search, mode: "insensitive" } },
        ],
      });
    }

    if (params.source) {
      andConditions.push({ source: params.source });
    }

    if (params.projectId) {
      andConditions.push({ projectId: params.projectId });
    }

    const where: Prisma.LeadWhereInput = {
      AND: andConditions,
    };

    const total = await this.db.lead.count({ where });

    const skip = (params.page - 1) * params.limit;
    const take = params.limit;
    const orderBy: Prisma.LeadOrderByWithRelationInput = {
      [params.sortBy]: params.sortOrder,
    };

    const items = await this.db.lead.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        project: {
          select: { id: true, name: true, location: true },
        },
        consentRecord: {
          select: { optedOut: true },
        },
        siteVisits: {
          select: { bookingStatus: true, attendanceOutcome: true },
        },
        conversations: {
          select: {
            id: true,
            handoff: {
              select: {
                id: true,
                status: true,
                assignedTo: { select: { name: true } },
              },
            },
          },
        },
        _count: {
          select: { sourceEvents: true },
        },
      },
    });

    const leads: LeadListItem[] = items.map((lead) => {
      const status = computeLeadLifecycleStatus(lead);
      const assignedToName =
        lead.conversations.find((c) => c.handoff?.assignedTo?.name)?.handoff?.assignedTo?.name ?? null;

      return {
        id: lead.id,
        leadCode: lead.leadCode,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        projectId: lead.projectId,
        projectName: lead.project?.name ?? null,
        configuration: lead.configuration,
        status,
        firstResponseAt: lead.firstResponseAt,
        createdAt: lead.createdAt,
        touchpointCount: lead._count.sourceEvents,
        hasConsented: !!lead.consentRecord && !lead.consentRecord.optedOut,
        assignedToName,
      };
    });

    return {
      leads,
      pagination: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit) || 1,
      },
    };
  }

  /**
   * Retrieves comprehensive details for a single lead with strict server-side scoping.
   * Returns null if not found or unauthorized for the executive.
   */
  async getLeadDetail(
    leadId: string,
    staffUser: { id: string; role: UserRole }
  ): Promise<LeadDetail | null> {
    const roleScope = getStaffLeadScope(staffUser);

    const lead = await this.db.lead.findFirst({
      where: {
        id: leadId,
        AND: [roleScope],
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            location: true,
            reraNumber: true,
            totalUnits: true,
          },
        },
        consentRecord: {
          select: {
            id: true,
            consentText: true,
            consentedAt: true,
            optedOut: true,
            optOutAt: true,
          },
        },
        sourceEvents: {
          orderBy: { occurredAt: "desc" },
          select: {
            id: true,
            source: true,
            campaign: true,
            occurredAt: true,
          },
        },
        conversations: {
          orderBy: { startedAt: "desc" },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
                groundingFactIds: true,
              },
            },
            handoff: {
              select: {
                id: true,
                status: true,
                escalationReason: true,
                summary: true,
                assignedToId: true,
                assignedTo: {
                  select: { id: true, name: true, email: true },
                },
                createdAt: true,
                resolvedAt: true,
              },
            },
          },
        },
        siteVisits: {
          orderBy: { bookedAt: "desc" },
          include: {
            slot: {
              select: {
                id: true,
                startsAt: true,
                endsAt: true,
                location: true,
                status: true,
              },
            },
            reminderJobs: {
              orderBy: { scheduledFor: "asc" },
              select: {
                id: true,
                reminderType: true,
                status: true,
                scheduledFor: true,
                sentAt: true,
                attempts: true,
              },
            },
          },
        },
      },
    });

    if (!lead) return null;

    const status = computeLeadLifecycleStatus(lead);

    return {
      id: lead.id,
      leadCode: lead.leadCode,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      projectId: lead.projectId,
      project: lead.project,
      configuration: lead.configuration,
      status,
      firstResponseAt: lead.firstResponseAt,
      isAnonymized: lead.isAnonymized,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      sourceEvents: lead.sourceEvents,
      consentRecord: lead.consentRecord,
      conversations: lead.conversations.map((c) => ({
        id: c.id,
        language: c.language,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        messages: c.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          groundingFactIds: m.groundingFactIds,
        })),
        handoff: c.handoff,
      })),
      siteVisits: lead.siteVisits.map((v) => ({
        id: v.id,
        bookingStatus: v.bookingStatus,
        attendanceOutcome: v.attendanceOutcome,
        bookedAt: v.bookedAt,
        attendedAt: v.attendedAt,
        cancelledAt: v.cancelledAt,
        slot: {
          id: v.slot.id,
          startsAt: v.slot.startsAt,
          endsAt: v.slot.endsAt,
          location: v.slot.location,
          status: v.slot.status,
        },
        reminderJobs: v.reminderJobs.map((rj) => ({
          id: rj.id,
          reminderType: rj.reminderType,
          status: rj.status,
          scheduledFor: rj.scheduledFor,
          sentAt: rj.sentAt,
          attempts: rj.attempts,
        })),
      })),
    };
  }

  /**
   * Retrieves real database-backed aggregate metrics for the lead pipeline dashboard.
   */
  async getLeadMetrics(staffUser: { id: string; role: UserRole }): Promise<LeadMetrics> {
    const roleScope = getStaffLeadScope(staffUser);

    // Concurrently execute all independent aggregation, grouping, project and recent event queries in a single round-trip batch
    const [
      totalLeads,
      visitedCount,
      bookedCount,
      escalatedCount,
      engagedCount,
      newCount,
      sourceGroups,
      projects,
      unassignedProjectLeads,
      recentEvents,
    ] = await Promise.all([
      this.db.lead.count({ where: roleScope }),
      this.db.lead.count({ where: { AND: [roleScope, getLifecycleStatusFilter("VISITED")] } }),
      this.db.lead.count({ where: { AND: [roleScope, getLifecycleStatusFilter("BOOKED")] } }),
      this.db.lead.count({ where: { AND: [roleScope, getLifecycleStatusFilter("ESCALATED")] } }),
      this.db.lead.count({ where: { AND: [roleScope, getLifecycleStatusFilter("ENGAGED")] } }),
      this.db.lead.count({ where: { AND: [roleScope, getLifecycleStatusFilter("NEW")] } }),
      this.db.lead.groupBy({
        by: ["source"],
        where: roleScope,
        _count: true,
      }),
      this.db.project.findMany({
        select: {
          id: true,
          name: true,
          interestedLeads: {
            where: roleScope,
            select: { id: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      this.db.lead.count({
        where: { AND: [roleScope, { projectId: null }] },
      }),
      this.db.leadSourceEvent.findMany({
        where: { lead: roleScope },
        orderBy: { occurredAt: "desc" },
        take: 5,
        include: {
          lead: {
            select: { id: true, leadCode: true, name: true },
          },
        },
      }),
    ]);

    const bySource: Record<LeadSource, number> = {
      [LeadSource.PROPERTY_PORTAL]: 0,
      [LeadSource.SOCIAL_MEDIA_AD]: 0,
      [LeadSource.WEBSITE]: 0,
      [LeadSource.HOARDING_CALL]: 0,
      [LeadSource.REFERRAL]: 0,
      [LeadSource.OTHER]: 0,
    };
    for (const group of sourceGroups) {
      bySource[group.source] = group._count;
    }

    const byProject: LeadMetrics["byProject"] = projects.map((p) => ({
      projectId: p.id,
      projectName: p.name,
      count: p.interestedLeads.length,
    }));

    if (unassignedProjectLeads > 0) {
      byProject.push({
        projectId: null,
        projectName: "General / Unassigned",
        count: unassignedProjectLeads,
      });
    }

    const recentActivity: LeadMetrics["recentActivity"] = recentEvents.map((evt) => ({
      id: evt.id,
      leadId: evt.lead.id,
      leadCode: evt.lead.leadCode,
      leadName: evt.lead.name,
      type: "TOUCHPOINT",
      description: `Inquiry via ${evt.source.replace(/_/g, " ")}${
        evt.campaign ? ` (${evt.campaign})` : ""
      }`,
      occurredAt: evt.occurredAt,
    }));

    return {
      totalLeads,
      newLeads: newCount,
      byStatus: {
        NEW: newCount,
        ENGAGED: engagedCount,
        ESCALATED: escalatedCount,
        BOOKED: bookedCount,
        VISITED: visitedCount,
      },
      byProject,
      bySource,
      recentActivity,
    };
  }

  /**
   * Retrieves list of active projects for dropdowns and filters.
   */
  async getProjectsList(): Promise<Array<{ id: string; name: string; location: string }>> {
    return this.db.project.findMany({
      select: { id: true, name: true, location: true },
      orderBy: { name: "asc" },
    });
  }
}

export const leadService = new LeadService();
