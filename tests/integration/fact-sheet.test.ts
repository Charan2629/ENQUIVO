import { describe, it, expect, afterAll } from "vitest";
import { UserRole, FactSheetScope, FactSheetStatus } from "@prisma/client";
import {
  FactSheetService,
  FactSheetForbiddenError,
} from "@/services/fact-sheet/fact-sheet.service";
import { AIConciergeService } from "@/services/ai/ai.service";
import { testPrisma, disconnectTestPrisma } from "../helpers/testPrisma";

describe("FactSheet Governance & AI Grounding Integration Tests (Isolated Neon Test Branch)", () => {
  const factSheetService = new FactSheetService(testPrisma);
  const aiConciergeService = new AIConciergeService(testPrisma);

  const createdFactIds = new Set<string>();
  const createdUserIds = new Set<string>();

  const TEST_RUN_ID = Date.now().toString().slice(-6);

  let salesHead: { id: string; role: UserRole };
  let salesExec: { id: string; role: UserRole };

  // Setup test users in isolated branch
  beforeAllTestUsers: {
    // will be initialized in beforeAll
  }

  afterAll(async () => {
    // Deterministic teardown of test-created facts and users
    if (createdFactIds.size > 0) {
      await testPrisma.factSheet.deleteMany({
        where: { id: { in: Array.from(createdFactIds) } },
      });
    }

    if (createdUserIds.size > 0) {
      await testPrisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
    }

    await disconnectTestPrisma();
  });

  it("0. Prepares test staff users", async () => {
    const head = await testPrisma.user.create({
      data: {
        email: `fact-head-${TEST_RUN_ID}@enquivo.test`,
        name: "Test Sales Head",
        role: UserRole.SALES_HEAD,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
    });
    createdUserIds.add(head.id);
    salesHead = { id: head.id, role: head.role };

    const exec = await testPrisma.user.create({
      data: {
        email: `fact-exec-${TEST_RUN_ID}@enquivo.test`,
        name: "Test Sales Exec",
        role: UserRole.SALES_EXEC,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
    });
    createdUserIds.add(exec.id);
    salesExec = { id: exec.id, role: exec.role };

    expect(salesHead.role).toBe(UserRole.SALES_HEAD);
    expect(salesExec.role).toBe(UserRole.SALES_EXEC);
  });

  it("1. SALES_HEAD creates a new fact sheet entry as DRAFT (verifiedById is null)", async () => {
    const created = await factSheetService.createFactSheet(
      {
        key: `pricing.penthouse_${TEST_RUN_ID}`,
        value: "Exclusive 4 BHK Sky Villas starting from ₹2.5 crore in Ahmedabad.",
        scope: FactSheetScope.PORTFOLIO,
        status: FactSheetStatus.DRAFT,
        isActive: true,
      },
      salesHead
    );

    createdFactIds.add(created.id);

    expect(created.key).toBe(`pricing.penthouse_${TEST_RUN_ID}`);
    expect(created.status).toBe(FactSheetStatus.DRAFT);
    expect(created.verifiedBy).toBeNull();
    expect(created.createdBy.id).toBe(salesHead.id);

    // Verify in database
    const dbRecord = await testPrisma.factSheet.findUnique({
      where: { id: created.id },
    });
    expect(dbRecord?.status).toBe(FactSheetStatus.DRAFT);
    expect(dbRecord?.verifiedById).toBeNull();
  });

  it("2. AIConciergeService.getVerifiedFacts strictly excludes DRAFT and UNVERIFIED facts", async () => {
    const facts = await aiConciergeService.getVerifiedFacts({
      scope: FactSheetScope.PORTFOLIO,
    });

    const draftKey = `pricing.penthouse_${TEST_RUN_ID}`;
    const found = facts.find((f) => f.key === draftKey);
    expect(found).toBeUndefined();
  });

  it("3. SALES_HEAD approves fact: status transitions to VERIFIED with verifiedById stamped", async () => {
    const draftKey = `pricing.penthouse_${TEST_RUN_ID}`;
    const draftFact = await testPrisma.factSheet.findFirstOrThrow({
      where: { key: draftKey },
    });

    const verified = await factSheetService.verifyFactSheet(
      draftFact.id,
      "VERIFY",
      salesHead
    );

    expect(verified.status).toBe(FactSheetStatus.VERIFIED);
    expect(verified.isActive).toBe(true);
    expect(verified.verifiedBy?.id).toBe(salesHead.id);

    // Verify in database
    const dbRecord = await testPrisma.factSheet.findUnique({
      where: { id: draftFact.id },
    });
    expect(dbRecord?.status).toBe(FactSheetStatus.VERIFIED);
    expect(dbRecord?.verifiedById).toBe(salesHead.id);
  });

  it("4. AIConciergeService.getVerifiedFacts now retrieves the newly verified fact", async () => {
    const facts = await aiConciergeService.getVerifiedFacts({
      scope: FactSheetScope.PORTFOLIO,
    });

    const verifiedKey = `pricing.penthouse_${TEST_RUN_ID}`;
    const found = facts.find((f) => f.key === verifiedKey);

    expect(found).toBeDefined();
    expect(found?.value).toContain("Sky Villas");
  });

  it("5. Editing content on a VERIFIED fact automatically demotes status to UNVERIFIED and clears verifiedById", async () => {
    const factKey = `pricing.penthouse_${TEST_RUN_ID}`;
    const verifiedFact = await testPrisma.factSheet.findFirstOrThrow({
      where: { key: factKey },
    });

    const updated = await factSheetService.updateFactSheet(
      verifiedFact.id,
      {
        value: "Exclusive 4 BHK Sky Villas starting from ₹2.8 crore (revised price).",
      },
      salesHead
    );

    expect(updated.status).toBe(FactSheetStatus.UNVERIFIED);
    expect(updated.verifiedBy).toBeNull();

    // Verify in database
    const dbRecord = await testPrisma.factSheet.findUnique({
      where: { id: verifiedFact.id },
    });
    expect(dbRecord?.status).toBe(FactSheetStatus.UNVERIFIED);
    expect(dbRecord?.verifiedById).toBeNull();
  });

  it("6. AIConciergeService immediately excludes the demoted fact, preventing prompt contamination", async () => {
    const facts = await aiConciergeService.getVerifiedFacts({
      scope: FactSheetScope.PORTFOLIO,
    });

    const demotedKey = `pricing.penthouse_${TEST_RUN_ID}`;
    const found = facts.find((f) => f.key === demotedKey);

    expect(found).toBeUndefined();
  });

  it("7. Multi-field filtering and search in getFactSheets", async () => {
    const result = await factSheetService.getFactSheets(
      {
        scope: FactSheetScope.PORTFOLIO,
        status: "ALL",
        isActive: "ALL",
        search: TEST_RUN_ID,
        page: 1,
        limit: 10,
      },
      salesHead
    );

    expect(result.facts.length).toBeGreaterThanOrEqual(1);
    expect(result.facts.some((f) => f.key.includes(TEST_RUN_ID))).toBe(true);
  });

  it("8. Anti-IDOR: SALES_EXEC is strictly forbidden from creating, updating, or verifying facts", async () => {
    const factKey = `pricing.penthouse_${TEST_RUN_ID}`;
    const fact = await testPrisma.factSheet.findFirstOrThrow({
      where: { key: factKey },
    });

    await expect(
      factSheetService.createFactSheet(
        {
          key: `exec.illegal_${TEST_RUN_ID}`,
          value: "Unauthorized value",
          scope: FactSheetScope.PORTFOLIO,
          status: FactSheetStatus.DRAFT,
          isActive: true,
        },
        salesExec
      )
    ).rejects.toThrow(FactSheetForbiddenError);

    await expect(
      factSheetService.updateFactSheet(
        fact.id,
        { value: "Hacked value" },
        salesExec
      )
    ).rejects.toThrow(FactSheetForbiddenError);

    await expect(
      factSheetService.verifyFactSheet(
        fact.id,
        "VERIFY",
        salesExec
      )
    ).rejects.toThrow(FactSheetForbiddenError);

    await expect(
      factSheetService.deleteFactSheet(
        fact.id,
        salesExec
      )
    ).rejects.toThrow(FactSheetForbiddenError);
  });
});
