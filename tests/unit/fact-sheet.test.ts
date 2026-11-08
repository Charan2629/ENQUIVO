import { describe, it, expect, vi } from "vitest";
import { UserRole, FactSheetScope, FactSheetStatus } from "@prisma/client";
import {
  createFactSheetSchema,
  updateFactSheetSchema,
  verifyFactSheetSchema,
  factSheetQuerySchema,
} from "@/lib/validations/fact-sheet";
import {
  FactSheetService,
  FactSheetForbiddenError,
  FactSheetNotFoundError,
} from "@/services/fact-sheet/fact-sheet.service";

describe("Fact Sheet Validation Schemas", () => {
  describe("createFactSheetSchema", () => {
    it("accepts valid fact sheet input with defaults", () => {
      const parsed = createFactSheetSchema.parse({
        key: "pricing.starting_price",
        value: "Starting from ₹65 lakh for 2 BHK units.",
      });

      expect(parsed.key).toBe("pricing.starting_price");
      expect(parsed.value).toBe("Starting from ₹65 lakh for 2 BHK units.");
      expect(parsed.scope).toBe(FactSheetScope.PORTFOLIO);
      expect(parsed.status).toBe(FactSheetStatus.DRAFT);
      expect(parsed.isActive).toBe(true);
    });

    it("rejects keys with spaces or illegal characters", () => {
      expect(() =>
        createFactSheetSchema.parse({
          key: "invalid key with spaces",
          value: "Some valid content",
        })
      ).toThrow();

      expect(() =>
        createFactSheetSchema.parse({
          key: "pricing$special",
          value: "Some valid content",
        })
      ).toThrow();
    });

    it("rejects empty values", () => {
      expect(() =>
        createFactSheetSchema.parse({
          key: "amenities.pool",
          value: "   ",
        })
      ).toThrow();
    });
  });

  describe("updateFactSheetSchema", () => {
    it("accepts partial updates", () => {
      const parsed = updateFactSheetSchema.parse({
        value: "Updated pricing details.",
      });
      expect(parsed.value).toBe("Updated pricing details.");
      expect(parsed.key).toBeUndefined();
    });

    it("validates key format if provided during update", () => {
      expect(() =>
        updateFactSheetSchema.parse({
          key: "invalid key",
        })
      ).toThrow();
    });
  });

  describe("verifyFactSheetSchema", () => {
    it("accepts VERIFY and REJECT actions", () => {
      expect(verifyFactSheetSchema.parse({ action: "VERIFY" })).toEqual({ action: "VERIFY" });
      expect(verifyFactSheetSchema.parse({ action: "REJECT" })).toEqual({ action: "REJECT" });
    });

    it("rejects invalid actions", () => {
      expect(() => verifyFactSheetSchema.parse({ action: "APPROVE" })).toThrow();
    });
  });

  describe("factSheetQuerySchema", () => {
    it("applies sensible defaults", () => {
      const parsed = factSheetQuerySchema.parse({});
      expect(parsed.scope).toBe("ALL");
      expect(parsed.status).toBe("ALL");
      expect(parsed.isActive).toBe("ALL");
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(50);
    });
  });
});

describe("FactSheetService Business Logic & Governance", () => {
  const salesHeadUser = { id: "head-1", role: UserRole.SALES_HEAD };
  const salesExecUser = { id: "exec-1", role: UserRole.SALES_EXEC };

  describe("Role-Based Authorization", () => {
    it("rejects non-SALES_HEAD users from creating facts", async () => {
      const service = new FactSheetService({} as never);

      await expect(
        service.createFactSheet(
          {
            key: "test.key",
            value: "Test value",
            scope: FactSheetScope.PORTFOLIO,
            status: FactSheetStatus.DRAFT,
            isActive: true,
          },
          salesExecUser
        )
      ).rejects.toThrow(FactSheetForbiddenError);
    });

    it("rejects non-SALES_HEAD users from updating facts", async () => {
      const service = new FactSheetService({} as never);

      await expect(
        service.updateFactSheet("fact-1", { value: "New value" }, salesExecUser)
      ).rejects.toThrow(FactSheetForbiddenError);
    });

    it("rejects non-SALES_HEAD users from verifying facts", async () => {
      const service = new FactSheetService({} as never);

      await expect(
        service.verifyFactSheet("fact-1", "VERIFY", salesExecUser)
      ).rejects.toThrow(FactSheetForbiddenError);
    });

    it("rejects non-SALES_HEAD users from deleting facts", async () => {
      const service = new FactSheetService({} as never);

      await expect(
        service.deleteFactSheet("fact-1", salesExecUser)
      ).rejects.toThrow(FactSheetForbiddenError);
    });
  });

  describe("Creation Status & Sign-Off Handling", () => {
    it("sets verifiedById when Sales Head creates a fact with VERIFIED status", async () => {
      const mockDb = {
        factSheet: {
          create: vi.fn().mockResolvedValue({
            id: "fact-created-1",
            key: "pricing.start",
            value: "₹65 lakh",
            scope: FactSheetScope.PORTFOLIO,
            status: FactSheetStatus.VERIFIED,
            isActive: true,
            projectId: null,
            project: null,
            createdBy: { id: "head-1", name: "Head", email: "head@test.com" },
            verifiedBy: { id: "head-1", name: "Head", email: "head@test.com" },
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      const service = new FactSheetService(mockDb as never);
      const result = await service.createFactSheet(
        {
          key: "pricing.start",
          value: "₹65 lakh",
          scope: FactSheetScope.PORTFOLIO,
          status: FactSheetStatus.VERIFIED,
          isActive: true,
        },
        salesHeadUser
      );

      expect(mockDb.factSheet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: FactSheetStatus.VERIFIED,
            verifiedById: "head-1",
            createdById: "head-1",
          }),
        })
      );
      expect(result.status).toBe(FactSheetStatus.VERIFIED);
      expect(result.verifiedBy?.id).toBe("head-1");
    });

    it("defaults verifiedById to null when fact is created as DRAFT", async () => {
      const mockDb = {
        factSheet: {
          create: vi.fn().mockResolvedValue({
            id: "fact-created-2",
            key: "draft.fact",
            value: "Draft details",
            scope: FactSheetScope.PORTFOLIO,
            status: FactSheetStatus.DRAFT,
            isActive: true,
            projectId: null,
            project: null,
            createdBy: { id: "head-1", name: "Head", email: "head@test.com" },
            verifiedBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      const service = new FactSheetService(mockDb as never);
      await service.createFactSheet(
        {
          key: "draft.fact",
          value: "Draft details",
          scope: FactSheetScope.PORTFOLIO,
          status: FactSheetStatus.DRAFT,
          isActive: true,
        },
        salesHeadUser
      );

      expect(mockDb.factSheet.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: FactSheetStatus.DRAFT,
            verifiedById: null,
          }),
        })
      );
    });
  });

  describe("Automatic Demotion on Content Edit", () => {
    it("demotes VERIFIED status to UNVERIFIED and clears verifiedById when content changes", async () => {
      const existingVerifiedFact = {
        id: "fact-verified-1",
        key: "amenities.gym",
        value: "State-of-the-art fitness center",
        scope: FactSheetScope.PORTFOLIO,
        status: FactSheetStatus.VERIFIED,
        isActive: true,
        projectId: null,
        createdById: "head-1",
        verifiedById: "head-1",
      };

      const mockDb = {
        factSheet: {
          findUnique: vi.fn().mockResolvedValue(existingVerifiedFact),
          update: vi.fn().mockResolvedValue({
            ...existingVerifiedFact,
            value: "Updated gym equipment listing",
            status: FactSheetStatus.UNVERIFIED,
            verifiedById: null,
            project: null,
            createdBy: { id: "head-1", name: "Head", email: "head@test.com" },
            verifiedBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      const service = new FactSheetService(mockDb as never);
      const result = await service.updateFactSheet(
        "fact-verified-1",
        { value: "Updated gym equipment listing" },
        salesHeadUser
      );

      expect(mockDb.factSheet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "fact-verified-1" },
          data: expect.objectContaining({
            status: FactSheetStatus.UNVERIFIED,
            verifiedBy: { disconnect: true },
          }),
        })
      );
      expect(result.status).toBe(FactSheetStatus.UNVERIFIED);
      expect(result.verifiedBy).toBeNull();
    });

    it("does NOT demote VERIFIED status if only isActive toggle changes", async () => {
      const existingVerifiedFact = {
        id: "fact-verified-2",
        key: "amenities.spa",
        value: "Luxury wellness spa",
        scope: FactSheetScope.PORTFOLIO,
        status: FactSheetStatus.VERIFIED,
        isActive: true,
        projectId: null,
        createdById: "head-1",
        verifiedById: "head-1",
      };

      const mockDb = {
        factSheet: {
          findUnique: vi.fn().mockResolvedValue(existingVerifiedFact),
          update: vi.fn().mockResolvedValue({
            ...existingVerifiedFact,
            isActive: false,
            project: null,
            createdBy: { id: "head-1", name: "Head", email: "head@test.com" },
            verifiedBy: { id: "head-1", name: "Head", email: "head@test.com" },
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      const service = new FactSheetService(mockDb as never);
      const result = await service.updateFactSheet(
        "fact-verified-2",
        { isActive: false },
        salesHeadUser
      );

      expect(mockDb.factSheet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "fact-verified-2" },
          data: expect.objectContaining({
            status: FactSheetStatus.VERIFIED,
            isActive: false,
          }),
        })
      );
      expect(result.status).toBe(FactSheetStatus.VERIFIED);
      expect(result.isActive).toBe(false);
    });
  });

  describe("Verification & Approval Operations", () => {
    it("VERIFY action sets status = VERIFIED, isActive = true, and stamps verifiedById", async () => {
      const existingUnverified = {
        id: "fact-unverified",
        key: "rera.details",
        value: "Demo only",
        scope: FactSheetScope.PORTFOLIO,
        status: FactSheetStatus.UNVERIFIED,
        isActive: false,
        verifiedById: null,
      };

      const mockDb = {
        factSheet: {
          findUnique: vi.fn().mockResolvedValue(existingUnverified),
          update: vi.fn().mockResolvedValue({
            ...existingUnverified,
            status: FactSheetStatus.VERIFIED,
            isActive: true,
            project: null,
            createdBy: { id: "head-1", name: "Head", email: "head@test.com" },
            verifiedBy: { id: "head-1", name: "Head", email: "head@test.com" },
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      const service = new FactSheetService(mockDb as never);
      const result = await service.verifyFactSheet("fact-unverified", "VERIFY", salesHeadUser);

      expect(mockDb.factSheet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "fact-unverified" },
          data: expect.objectContaining({
            status: FactSheetStatus.VERIFIED,
            isActive: true,
            verifiedBy: { connect: { id: "head-1" } },
          }),
        })
      );
      expect(result.status).toBe(FactSheetStatus.VERIFIED);
      expect(result.isActive).toBe(true);
    });

    it("REJECT action sets status = UNVERIFIED, isActive = false, and disconnects verifiedBy", async () => {
      const existingFact = {
        id: "fact-to-reject",
        key: "invalid.claim",
        value: "Private helipad",
        status: FactSheetStatus.DRAFT,
        isActive: true,
      };

      const mockDb = {
        factSheet: {
          findUnique: vi.fn().mockResolvedValue(existingFact),
          update: vi.fn().mockResolvedValue({
            ...existingFact,
            status: FactSheetStatus.UNVERIFIED,
            isActive: false,
            project: null,
            createdBy: { id: "head-1", name: "Head", email: "head@test.com" },
            verifiedBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      };

      const service = new FactSheetService(mockDb as never);
      const result = await service.verifyFactSheet("fact-to-reject", "REJECT", salesHeadUser);

      expect(mockDb.factSheet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "fact-to-reject" },
          data: expect.objectContaining({
            status: FactSheetStatus.UNVERIFIED,
            isActive: false,
            verifiedBy: { disconnect: true },
          }),
        })
      );
      expect(result.status).toBe(FactSheetStatus.UNVERIFIED);
      expect(result.isActive).toBe(false);
    });

    it("throws FactSheetNotFoundError if target fact does not exist", async () => {
      const mockDb = {
        factSheet: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      const service = new FactSheetService(mockDb as never);
      await expect(
        service.verifyFactSheet("nonexistent-id", "VERIFY", salesHeadUser)
      ).rejects.toThrow(FactSheetNotFoundError);
    });
  });
});
