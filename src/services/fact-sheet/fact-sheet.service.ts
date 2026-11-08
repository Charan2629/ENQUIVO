import {
  PrismaClient,
  Prisma,
  UserRole,
  FactSheetScope,
  FactSheetStatus,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  FactSheetItem,
  FactSheetMetrics,
  HandoffPagination,
} from "@/types";
import {
  CreateFactSheetInput,
  createFactSheetSchema,
  UpdateFactSheetInput,
  updateFactSheetSchema,
  ValidatedFactSheetQuery,
  verifyFactSheetSchema,
} from "@/lib/validations/fact-sheet";

export class FactSheetNotFoundError extends Error {
  constructor(message = "Fact sheet entry not found") {
    super(message);
    this.name = "FactSheetNotFoundError";
  }
}

export class FactSheetForbiddenError extends Error {
  constructor(message = "You are not authorized to perform this fact sheet action") {
    super(message);
    this.name = "FactSheetForbiddenError";
  }
}

export class FactSheetService {
  constructor(private db: PrismaClient = defaultPrisma) {}

  /**
   * Retrieves a paginated list of fact sheets with multi-field filtering and search.
   */
  async getFactSheets(
    params: ValidatedFactSheetQuery,
    staffUser: { id: string; role: UserRole }
  ): Promise<{ facts: FactSheetItem[]; pagination: HandoffPagination }> {
    // Only staff can access fact sheet records
    if (staffUser.role !== UserRole.SALES_HEAD && staffUser.role !== UserRole.SALES_EXEC) {
      throw new FactSheetForbiddenError("Staff permissions required to view fact sheets");
    }

    const andConditions: Prisma.FactSheetWhereInput[] = [];

    // Scope filter
    if (params.scope !== "ALL") {
      andConditions.push({ scope: params.scope as FactSheetScope });
    }

    // Status filter
    if (params.status !== "ALL") {
      andConditions.push({ status: params.status as FactSheetStatus });
    }

    // Active filter
    if (params.isActive !== "ALL") {
      andConditions.push({ isActive: params.isActive === "true" });
    }

    // Project filter
    if (params.projectId) {
      andConditions.push({ projectId: params.projectId });
    }

    // Search query (matches key or value)
    if (params.search && params.search.trim() !== "") {
      const q = params.search.trim();
      andConditions.push({
        OR: [
          { key: { contains: q, mode: "insensitive" } },
          { value: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.FactSheetWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const [total, rows] = await Promise.all([
      this.db.factSheet.count({ where }),
      this.db.factSheet.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: [
          { status: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          project: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          verifiedBy: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    const facts: FactSheetItem[] = rows.map((r) => ({
      id: r.id,
      key: r.key,
      value: r.value,
      scope: r.scope,
      status: r.status,
      isActive: r.isActive,
      projectId: r.projectId,
      projectName: r.project?.name ?? null,
      createdBy: r.createdBy,
      verifiedBy: r.verifiedBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return {
      facts,
      pagination: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
      },
    };
  }

  /**
   * Computes live summary metrics for the Fact Sheet governance dashboard.
   */
  async getFactSheetMetrics(): Promise<FactSheetMetrics> {
    const [totalFacts, verifiedActive, draftCount, unverifiedCount, inactiveCount] =
      await Promise.all([
        this.db.factSheet.count(),
        this.db.factSheet.count({
          where: { status: FactSheetStatus.VERIFIED, isActive: true },
        }),
        this.db.factSheet.count({
          where: { status: FactSheetStatus.DRAFT },
        }),
        this.db.factSheet.count({
          where: { status: FactSheetStatus.UNVERIFIED },
        }),
        this.db.factSheet.count({
          where: { isActive: false },
        }),
      ]);

    return {
      totalFacts,
      verifiedActive,
      draftCount,
      unverifiedCount,
      inactiveCount,
    };
  }

  /**
   * Creates a new fact sheet record. Restricted to SALES_HEAD.
   * If status is specified as VERIFIED, automatically stamps verifiedById = staffUser.id.
   * Otherwise defaults to DRAFT with verifiedById = null.
   */
  async createFactSheet(
    input: CreateFactSheetInput,
    staffUser: { id: string; role: UserRole }
  ): Promise<FactSheetItem> {
    if (staffUser.role !== UserRole.SALES_HEAD) {
      throw new FactSheetForbiddenError("Only Sales Head can create fact sheet entries");
    }

    const validated = createFactSheetSchema.parse(input);

    const isVerified = validated.status === FactSheetStatus.VERIFIED;

    const row = await this.db.factSheet.create({
      data: {
        key: validated.key,
        value: validated.value,
        scope: validated.scope,
        projectId: validated.projectId ?? null,
        status: validated.status,
        isActive: validated.isActive,
        createdById: staffUser.id,
        verifiedById: isVerified ? staffUser.id : null,
      },
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      id: row.id,
      key: row.key,
      value: row.value,
      scope: row.scope,
      status: row.status,
      isActive: row.isActive,
      projectId: row.projectId,
      projectName: row.project?.name ?? null,
      createdBy: row.createdBy,
      verifiedBy: row.verifiedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Updates an existing fact sheet record. Restricted to SALES_HEAD.
   *
   * CRITICAL GOVERNANCE INVARIANT:
   * If content fields (key, value, scope, or projectId) are modified on an existing VERIFIED fact,
   * it is automatically demoted to UNVERIFIED and verifiedById is reset to null.
   * This guarantees that modified fact contents cannot bypass human verification or contaminate AI grounding.
   */
  async updateFactSheet(
    id: string,
    input: UpdateFactSheetInput,
    staffUser: { id: string; role: UserRole }
  ): Promise<FactSheetItem> {
    if (staffUser.role !== UserRole.SALES_HEAD) {
      throw new FactSheetForbiddenError("Only Sales Head can update fact sheet entries");
    }

    const validated = updateFactSheetSchema.parse(input);

    const existing = await this.db.factSheet.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new FactSheetNotFoundError(`Fact sheet entry ${id} not found`);
    }

    // Check if content changed
    const contentChanged =
      (validated.key !== undefined && validated.key !== existing.key) ||
      (validated.value !== undefined && validated.value !== existing.value) ||
      (validated.scope !== undefined && validated.scope !== existing.scope) ||
      (validated.projectId !== undefined && validated.projectId !== existing.projectId);

    // If verified fact had content changed, demote to UNVERIFIED and clear verifiedById
    let newStatus = existing.status;
    let newVerifiedById = existing.verifiedById;

    if (existing.status === FactSheetStatus.VERIFIED && contentChanged) {
      newStatus = FactSheetStatus.UNVERIFIED;
      newVerifiedById = null;
    }

    const updateData: Prisma.FactSheetUpdateInput = {
      status: newStatus,
      verifiedBy: newVerifiedById ? { connect: { id: newVerifiedById } } : { disconnect: true },
    };

    if (validated.key !== undefined) updateData.key = validated.key;
    if (validated.value !== undefined) updateData.value = validated.value;
    if (validated.scope !== undefined) updateData.scope = validated.scope;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

    if (validated.projectId !== undefined) {
      if (validated.projectId === null) {
        updateData.project = { disconnect: true };
      } else {
        updateData.project = { connect: { id: validated.projectId } };
      }
    }

    const row = await this.db.factSheet.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      id: row.id,
      key: row.key,
      value: row.value,
      scope: row.scope,
      status: row.status,
      isActive: row.isActive,
      projectId: row.projectId,
      projectName: row.project?.name ?? null,
      createdBy: row.createdBy,
      verifiedBy: row.verifiedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Approves or rejects a fact sheet entry. Restricted to SALES_HEAD.
   * - VERIFY: sets status = VERIFIED, verifiedById = staffUser.id, isActive = true.
   * - REJECT: sets status = UNVERIFIED, verifiedById = null, isActive = false.
   */
  async verifyFactSheet(
    id: string,
    action: "VERIFY" | "REJECT",
    staffUser: { id: string; role: UserRole }
  ): Promise<FactSheetItem> {
    if (staffUser.role !== UserRole.SALES_HEAD) {
      throw new FactSheetForbiddenError("Only Sales Head can verify or reject fact sheet entries");
    }

    verifyFactSheetSchema.parse({ action });

    const existing = await this.db.factSheet.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new FactSheetNotFoundError(`Fact sheet entry ${id} not found`);
    }

    const updateData: Prisma.FactSheetUpdateInput =
      action === "VERIFY"
        ? {
            status: FactSheetStatus.VERIFIED,
            isActive: true,
            verifiedBy: { connect: { id: staffUser.id } },
          }
        : {
            status: FactSheetStatus.UNVERIFIED,
            isActive: false,
            verifiedBy: { disconnect: true },
          };

    const row = await this.db.factSheet.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      id: row.id,
      key: row.key,
      value: row.value,
      scope: row.scope,
      status: row.status,
      isActive: row.isActive,
      projectId: row.projectId,
      projectName: row.project?.name ?? null,
      createdBy: row.createdBy,
      verifiedBy: row.verifiedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Deletes a fact sheet record. Restricted to SALES_HEAD.
   */
  async deleteFactSheet(
    id: string,
    staffUser: { id: string; role: UserRole }
  ): Promise<{ success: boolean; id: string }> {
    if (staffUser.role !== UserRole.SALES_HEAD) {
      throw new FactSheetForbiddenError("Only Sales Head can delete fact sheet entries");
    }

    const existing = await this.db.factSheet.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new FactSheetNotFoundError(`Fact sheet entry ${id} not found`);
    }

    await this.db.factSheet.delete({
      where: { id },
    });

    return { success: true, id };
  }
}

export const factSheetService = new FactSheetService();
