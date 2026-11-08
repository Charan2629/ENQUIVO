import {
  PrismaClient,
  Prisma,
  UserRole,
  HandoffStatus,
  EscalationReason,
  ChatMessageRole,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  HandoffListItem,
  HandoffPagination,
  HandoffMetrics,
  HandoffDetail,
  EligibleSalesExecutive,
} from "@/types";
import { ValidatedHandoffQuery } from "@/lib/validations/handoff";

export class HandoffNotFoundError extends Error {
  constructor(message = "Handoff record not found") {
    super(message);
    this.name = "HandoffNotFoundError";
  }
}

export class InvalidAssigneeError extends Error {
  constructor(message = "Selected assignee is not a valid Sales Executive") {
    super(message);
    this.name = "InvalidAssigneeError";
  }
}

export class HandoffForbiddenError extends Error {
  constructor(message = "You are not authorized to perform this handoff action") {
    super(message);
    this.name = "HandoffForbiddenError";
  }
}

/**
 * Derives server-side record scoping for handoffs:
 * - SALES_HEAD: Unrestricted visibility across all handoffs in the organization.
 * - SALES_EXEC: Strict relational scoping to handoffs assigned to that specific executive.
 */
export function getStaffHandoffScope(staffUser: {
  id: string;
  role: UserRole;
}): Prisma.HandoffWhereInput {
  if (staffUser.role === UserRole.SALES_HEAD) {
    return {};
  }
  if (staffUser.role === UserRole.SALES_EXEC) {
    return {
      assignedToId: staffUser.id,
    };
  }
  throw new HandoffForbiddenError("Staff permissions required to access handoffs");
}

export class HandoffService {
  /**
   * Constructor dependency injection allows injecting an isolated Prisma client
   * (e.g. testPrisma targeting an isolated test branch) during integration tests,
   * while defaulting cleanly to the application singleton in production route handlers.
   */
  constructor(private db: PrismaClient = defaultPrisma) {}

  /**
   * Retrieves a paginated list of handoffs with server-side role scoping,
   * search, and multi-field filtering.
   */
  async getHandoffs(
    params: ValidatedHandoffQuery,
    staffUser: { id: string; role: UserRole }
  ): Promise<{ handoffs: HandoffListItem[]; pagination: HandoffPagination }> {
    const roleScope = getStaffHandoffScope(staffUser);
    const andConditions: Prisma.HandoffWhereInput[] = [roleScope];

    // Status filter
    if (params.status === "UNASSIGNED") {
      andConditions.push({
        OR: [{ assignedToId: null }, { status: HandoffStatus.PENDING }],
      });
    } else if (params.status !== "ALL") {
      andConditions.push({ status: params.status as HandoffStatus });
    }

    // Escalation reason filter
    if (params.reason !== "ALL") {
      andConditions.push({ escalationReason: params.reason as EscalationReason });
    }

    // Assigned executive filter (SALES_HEAD only; SALES_EXEC is already strictly scoped)
    if (staffUser.role === UserRole.SALES_HEAD && params.assignedToId) {
      if (params.assignedToId === "UNASSIGNED") {
        andConditions.push({ assignedToId: null });
      } else if (params.assignedToId !== "ALL") {
        andConditions.push({ assignedToId: params.assignedToId });
      }
    }

    // Keyword search across buyer name, phone, email, or leadCode
    if (params.search) {
      const query = params.search.trim();
      andConditions.push({
        conversation: {
          lead: {
            OR: [
              { leadCode: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
        },
      });
    }

    const where: Prisma.HandoffWhereInput = {
      AND: andConditions,
    };

    const page = Math.max(1, params.page);
    const limit = Math.min(50, Math.max(1, params.limit));
    const skip = (page - 1) * limit;

    const orderBy: Prisma.HandoffOrderByWithRelationInput = {
      [params.sortBy]: params.sortOrder,
    };

    const [total, items] = await Promise.all([
      this.db.handoff.count({ where }),
      this.db.handoff.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          conversation: {
            select: {
              id: true,
              language: true,
              lead: {
                select: {
                  id: true,
                  leadCode: true,
                  name: true,
                  phone: true,
                  email: true,
                  source: true,
                  configuration: true,
                  project: {
                    select: { name: true },
                  },
                },
              },
              _count: {
                select: { messages: true },
              },
            },
          },
        },
      }),
    ]);

    const handoffs: HandoffListItem[] = items.map((item) => ({
      id: item.id,
      conversationId: item.conversationId,
      escalationReason: item.escalationReason,
      summary: item.summary,
      status: item.status,
      createdAt: item.createdAt,
      resolvedAt: item.resolvedAt,
      language: item.conversation.language,
      assignedTo: item.assignedTo,
      lead: {
        id: item.conversation.lead.id,
        leadCode: item.conversation.lead.leadCode,
        name: item.conversation.lead.name,
        phone: item.conversation.lead.phone,
        email: item.conversation.lead.email,
        source: item.conversation.lead.source,
        projectName: item.conversation.lead.project?.name ?? null,
        configuration: item.conversation.lead.configuration,
      },
      messageCount: item.conversation._count.messages,
    }));

    return {
      handoffs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /**
   * Retrieves single handoff detail with full conversational history and lead dossier.
   * Enforces server-side scoping and IDOR prevention: returns null if the handoff
   * does not exist or falls outside the executive's authorized assigned scope.
   */
  async getHandoffDetail(
    handoffId: string,
    staffUser: { id: string; role: UserRole }
  ): Promise<HandoffDetail | null> {
    const roleScope = getStaffHandoffScope(staffUser);

    const handoff = await this.db.handoff.findFirst({
      where: {
        id: handoffId,
        ...roleScope,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        conversation: {
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
            lead: {
              include: {
                project: {
                  select: { id: true, name: true, location: true },
                },
              },
            },
          },
        },
      },
    });

    if (!handoff) {
      return null;
    }

    return {
      id: handoff.id,
      conversationId: handoff.conversationId,
      escalationReason: handoff.escalationReason,
      summary: handoff.summary,
      status: handoff.status,
      createdAt: handoff.createdAt,
      resolvedAt: handoff.resolvedAt,
      assignedTo: handoff.assignedTo,
      conversation: {
        id: handoff.conversation.id,
        language: handoff.conversation.language,
        startedAt: handoff.conversation.startedAt,
        endedAt: handoff.conversation.endedAt,
        messages: handoff.conversation.messages,
      },
      lead: {
        id: handoff.conversation.lead.id,
        leadCode: handoff.conversation.lead.leadCode,
        name: handoff.conversation.lead.name,
        phone: handoff.conversation.lead.phone,
        email: handoff.conversation.lead.email,
        source: handoff.conversation.lead.source,
        projectId: handoff.conversation.lead.projectId,
        projectName: handoff.conversation.lead.project?.name ?? null,
        projectLocation: handoff.conversation.lead.project?.location ?? null,
        configuration: handoff.conversation.lead.configuration,
        firstResponseAt: handoff.conversation.lead.firstResponseAt,
        createdAt: handoff.conversation.lead.createdAt,
      },
    };
  }

  /**
   * Computes aggregate queue metrics for the Handoff overview:
   * - Total escalations
   * - Unassigned / action required count
   * - Assigned count
   * - Resolved count
   * - Breakdown by escalation reason
   * - Workload distribution across eligible Sales Executives (for Sales Head)
   */
  async getHandoffMetrics(staffUser: { id: string; role: UserRole }): Promise<HandoffMetrics> {
    const roleScope = getStaffHandoffScope(staffUser);

    const [totalHandoffs, unassignedCount, assignedCount, resolvedCount, reasonGroups, executives] =
      await Promise.all([
        this.db.handoff.count({ where: roleScope }),
        this.db.handoff.count({
          where: {
            ...roleScope,
            OR: [{ assignedToId: null }, { status: HandoffStatus.PENDING }],
          },
        }),
        this.db.handoff.count({
          where: {
            ...roleScope,
            status: HandoffStatus.ASSIGNED,
          },
        }),
        this.db.handoff.count({
          where: {
            ...roleScope,
            status: HandoffStatus.RESOLVED,
          },
        }),
        this.db.handoff.groupBy({
          by: ["escalationReason"],
          where: roleScope,
          _count: true,
        }),
        staffUser.role === UserRole.SALES_HEAD
          ? this.getEligibleSalesExecutives()
          : Promise.resolve([]),
      ]);

    const byReason: Record<EscalationReason, number> = {
      [EscalationReason.MISSING_PROJECT_INFO]: 0,
      [EscalationReason.UNLISTED_AMENITY]: 0,
      [EscalationReason.PRICE_NEGOTIATION]: 0,
      [EscalationReason.BUYER_REQUESTED]: 0,
      [EscalationReason.OTHER]: 0,
    };

    for (const group of reasonGroups) {
      byReason[group.escalationReason] = group._count;
    }

    return {
      totalHandoffs,
      unassignedCount,
      assignedCount,
      resolvedCount,
      byReason,
      eligibleExecutives: executives,
    };
  }

  /**
   * Retrieves staff users who currently hold the SALES_EXEC role with their current live workload
   * (assigned handoffs). Sorted by active workload ascending to highlight
   * available capacity.
   */
  async getEligibleSalesExecutives(): Promise<EligibleSalesExecutive[]> {
    const executives = await this.db.user.findMany({
      where: { role: UserRole.SALES_EXEC },
      select: {
        id: true,
        name: true,
        email: true,
        assignedHandoffs: {
          where: { status: HandoffStatus.ASSIGNED },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return executives.map((exec) => ({
      id: exec.id,
      name: exec.name,
      email: exec.email,
      activeLeadCount: exec.assignedHandoffs.length,
    }));
  }

  /**
   * Assigns or reassigns an existing handoff to an eligible Sales Executive.
   *
   * Security & Concurrency Guarantees:
   * 1. Restricted strictly to SALES_HEAD users.
   * 2. Re-validates target assignee exists and currently holds the SALES_EXEC role.
   * 3. Executes within an interactive transaction to prevent race conditions.
   * 4. Updates handoff status to ASSIGNED and records an audit turn in the chat history.
   */
  async assignHandoff(
    handoffId: string,
    salesExecId: string,
    actingStaffUser: { id: string; role: UserRole; name?: string }
  ): Promise<HandoffDetail> {
    if (actingStaffUser.role !== UserRole.SALES_HEAD) {
      throw new HandoffForbiddenError("Only Sales Head is authorized to assign or reassign handoffs");
    }

    // Validate target assignee eligibility
    const targetExec = await this.db.user.findUnique({
      where: { id: salesExecId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!targetExec || targetExec.role !== UserRole.SALES_EXEC) {
      throw new InvalidAssigneeError("Target user does not currently hold the SALES_EXEC role");
    }

    return this.db.$transaction(async (tx) => {
      const existing = await tx.handoff.findUnique({
        where: { id: handoffId },
        include: { assignedTo: true, conversation: true },
      });

      if (!existing) {
        throw new HandoffNotFoundError("Handoff record not found for assignment");
      }

      const isReassignment =
        existing.assignedToId !== null && existing.assignedToId !== salesExecId;

      const updated = await tx.handoff.update({
        where: { id: handoffId },
        data: {
          assignedToId: salesExecId,
          status: HandoffStatus.ASSIGNED,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          conversation: {
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
              lead: {
                include: {
                  project: {
                    select: { id: true, name: true, location: true },
                  },
                },
              },
            },
          },
        },
      });

      // Append internal audit turn into conversation history
      const auditNote = isReassignment
        ? `[Ownership Reassigned] Lead reassigned to ${targetExec.name} (${targetExec.email}) by ${actingStaffUser.name || "Sales Head"}.`
        : `[Ownership Assigned] Lead assigned to ${targetExec.name} (${targetExec.email}) by ${actingStaffUser.name || "Sales Head"}.`;

      await tx.chatMessage.create({
        data: {
          conversationId: existing.conversationId,
          role: ChatMessageRole.AI,
          content: auditNote,
        },
      });

      return {
        id: updated.id,
        conversationId: updated.conversationId,
        escalationReason: updated.escalationReason,
        summary: updated.summary,
        status: updated.status,
        createdAt: updated.createdAt,
        resolvedAt: updated.resolvedAt,
        assignedTo: updated.assignedTo,
        conversation: {
          id: updated.conversation.id,
          language: updated.conversation.language,
          startedAt: updated.conversation.startedAt,
          endedAt: updated.conversation.endedAt,
          messages: updated.conversation.messages,
        },
        lead: {
          id: updated.conversation.lead.id,
          leadCode: updated.conversation.lead.leadCode,
          name: updated.conversation.lead.name,
          phone: updated.conversation.lead.phone,
          email: updated.conversation.lead.email,
          source: updated.conversation.lead.source,
          projectId: updated.conversation.lead.projectId,
          projectName: updated.conversation.lead.project?.name ?? null,
          projectLocation: updated.conversation.lead.project?.location ?? null,
          configuration: updated.conversation.lead.configuration,
          firstResponseAt: updated.conversation.lead.firstResponseAt,
          createdAt: updated.conversation.lead.createdAt,
        },
      };
    });
  }

  /**
   * Updates resolution status of a handoff (e.g. marking as RESOLVED).
   * - SALES_HEAD can resolve any handoff.
   * - SALES_EXEC can resolve handoffs assigned to them.
   */
  async updateHandoffStatus(
    handoffId: string,
    newStatus: HandoffStatus,
    staffUser: { id: string; role: UserRole }
  ): Promise<HandoffDetail> {
    const roleScope = getStaffHandoffScope(staffUser);

    const existing = await this.db.handoff.findFirst({
      where: {
        id: handoffId,
        ...roleScope,
      },
    });

    if (!existing) {
      throw new HandoffNotFoundError("Handoff record not found or access denied");
    }

    const resolvedAt = newStatus === HandoffStatus.RESOLVED ? new Date() : null;

    const updated = await this.db.handoff.update({
      where: { id: handoffId },
      data: {
        status: newStatus,
        resolvedAt,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        conversation: {
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
            lead: {
              include: {
                project: {
                  select: { id: true, name: true, location: true },
                },
              },
            },
          },
        },
      },
    });

    return {
      id: updated.id,
      conversationId: updated.conversationId,
      escalationReason: updated.escalationReason,
      summary: updated.summary,
      status: updated.status,
      createdAt: updated.createdAt,
      resolvedAt: updated.resolvedAt,
      assignedTo: updated.assignedTo,
      conversation: {
        id: updated.conversation.id,
        language: updated.conversation.language,
        startedAt: updated.conversation.startedAt,
        endedAt: updated.conversation.endedAt,
        messages: updated.conversation.messages,
      },
      lead: {
        id: updated.conversation.lead.id,
        leadCode: updated.conversation.lead.leadCode,
        name: updated.conversation.lead.name,
        phone: updated.conversation.lead.phone,
        email: updated.conversation.lead.email,
        source: updated.conversation.lead.source,
        projectId: updated.conversation.lead.projectId,
        projectName: updated.conversation.lead.project?.name ?? null,
        projectLocation: updated.conversation.lead.project?.location ?? null,
        configuration: updated.conversation.lead.configuration,
        firstResponseAt: updated.conversation.lead.firstResponseAt,
        createdAt: updated.conversation.lead.createdAt,
      },
    };
  }
}

export const handoffService = new HandoffService();
