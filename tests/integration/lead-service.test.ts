import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { LeadSource } from "@prisma/client";
import { LeadService } from "@/services/lead/lead.service";
import { testPrisma, disconnectTestPrisma } from "../helpers/testPrisma";

describe("LeadService Integration Tests (Isolated Neon Test Branch)", () => {
  const leadService = new LeadService(testPrisma);
  const createdLeadIds = new Set<string>();

  // Generate unique, collision-free synthetic Indian phone numbers (+9199xxxxxxNN)
  const TEST_RUN_ID = Date.now().toString().slice(-6);
  const phoneFor = (suffix: number) => `+9199${TEST_RUN_ID}${suffix.toString().padStart(2, "0")}`;

  let testProjectId: string | undefined;

  beforeAll(async () => {
    const project = await testPrisma.project.findFirst();
    if (project) {
      testProjectId = project.id;
    }
  });

  afterAll(async () => {
    const ids = Array.from(createdLeadIds);
    if (ids.length > 0) {
      // Respect foreign key hierarchy during teardown: children first, then parent
      await testPrisma.consentRecord.deleteMany({ where: { leadId: { in: ids } } });
      await testPrisma.leadSourceEvent.deleteMany({ where: { leadId: { in: ids } } });
      await testPrisma.lead.deleteMany({ where: { id: { in: ids } } });
    }
    await disconnectTestPrisma();
  });

  it("1. creates a new lead with an initial LeadSourceEvent audit touchpoint", async () => {
    const phone = phoneFor(1);
    const result = await leadService.ingestLead({
      name: "Integration Test Buyer 1",
      phone,
      email: "buyer1@example.com",
      source: LeadSource.PROPERTY_PORTAL,
      campaign: "magicbricks-q4",
      projectId: testProjectId,
      configuration: "3 BHK",
    });

    createdLeadIds.add(result.lead.id);

    expect(result.isNew).toBe(true);
    expect(result.lead.leadCode).toMatch(/^LD-[A-Z0-9]{5}-[A-Z0-9]{8}$/);
    expect(result.lead.phone).toBe(phone);
    expect(result.lead.email).toBe("buyer1@example.com");
    expect(result.lead.source).toBe(LeadSource.PROPERTY_PORTAL);
    expect(result.lead.configuration).toBe("3 BHK");

    expect(result.sourceEvent).toBeDefined();
    expect(result.sourceEvent.leadId).toBe(result.lead.id);
    expect(result.sourceEvent.source).toBe(LeadSource.PROPERTY_PORTAL);
    expect(result.sourceEvent.campaign).toBe("magicbricks-q4");
    expect(result.consentRecord).toBeNull();

    // Verify database persistence
    const dbLead = await testPrisma.lead.findUnique({
      where: { id: result.lead.id },
      include: { sourceEvents: true },
    });

    expect(dbLead).not.toBeNull();
    expect(dbLead?.sourceEvents).toHaveLength(1);
    expect(dbLead?.sourceEvents[0].source).toBe(LeadSource.PROPERTY_PORTAL);
  });

  it("2. preserves first-touch source attribution and appends audit event on duplicate phone ingestion", async () => {
    const phone = phoneFor(2);

    // First touch: Portal
    const initialResult = await leadService.ingestLead({
      name: "Attribution Buyer",
      phone,
      email: "attribution@example.com",
      source: LeadSource.PROPERTY_PORTAL,
      campaign: "initial-portal-touch",
    });
    createdLeadIds.add(initialResult.lead.id);

    expect(initialResult.isNew).toBe(true);
    expect(initialResult.lead.source).toBe(LeadSource.PROPERTY_PORTAL);

    // Second touch: Returning lead submits a Facebook Ad form
    const duplicateResult = await leadService.ingestLead({
      name: "Attribution Buyer Updated Name",
      phone,
      source: LeadSource.SOCIAL_MEDIA_AD,
      campaign: "meta-festive-q4",
    });

    expect(duplicateResult.isNew).toBe(false);
    expect(duplicateResult.lead.id).toBe(initialResult.lead.id);
    expect(duplicateResult.lead.leadCode).toBe(initialResult.lead.leadCode);

    // CRITICAL: First-touch attribution on Lead.source must NEVER change
    expect(duplicateResult.lead.source).toBe(LeadSource.PROPERTY_PORTAL);

    // The new touchpoint must be appended to LeadSourceEvent
    expect(duplicateResult.sourceEvent.source).toBe(LeadSource.SOCIAL_MEDIA_AD);
    expect(duplicateResult.sourceEvent.campaign).toBe("meta-festive-q4");
    expect(duplicateResult.sourceEvent.leadId).toBe(initialResult.lead.id);

    // Verify in database: exactly 1 lead, exactly 2 source events
    const leadCount = await testPrisma.lead.count({ where: { phone } });
    expect(leadCount).toBe(1);

    const events = await testPrisma.leadSourceEvent.findMany({
      where: { leadId: initialResult.lead.id },
      orderBy: { occurredAt: "asc" },
    });
    expect(events).toHaveLength(2);
    expect(events[0].source).toBe(LeadSource.PROPERTY_PORTAL);
    expect(events[1].source).toBe(LeadSource.SOCIAL_MEDIA_AD);
  });

  it("3. enriches missing fields conditionally without overwriting existing data", async () => {
    const phone = phoneFor(3);

    // Step A: Ingest with minimal details (no email, no configuration)
    const initialResult = await leadService.ingestLead({
      name: "Sparse Buyer",
      phone,
      source: LeadSource.WEBSITE,
    });
    createdLeadIds.add(initialResult.lead.id);

    expect(initialResult.isNew).toBe(true);
    expect(initialResult.lead.email).toBeNull();
    expect(initialResult.lead.configuration).toBeNull();

    // Step B: Re-ingest with email and configuration provided
    const enrichedResult = await leadService.ingestLead({
      name: "Sparse Buyer",
      phone,
      email: "sparse.buyer@example.com",
      configuration: "2 BHK",
      projectId: testProjectId,
      source: LeadSource.PROPERTY_PORTAL,
    });

    expect(enrichedResult.isNew).toBe(false);
    expect(enrichedResult.lead.id).toBe(initialResult.lead.id);
    expect(enrichedResult.lead.email).toBe("sparse.buyer@example.com");
    expect(enrichedResult.lead.configuration).toBe("2 BHK");
    if (testProjectId) {
      expect(enrichedResult.lead.projectId).toBe(testProjectId);
    }

    // Step C: Attempt to overwrite existing email and configuration with different values
    const conflictResult = await leadService.ingestLead({
      name: "Sparse Buyer",
      phone,
      email: "overwriting.attempt@example.com",
      configuration: "3 BHK",
      source: LeadSource.HOARDING_CALL,
    });

    expect(conflictResult.isNew).toBe(false);
    // Values must NOT be overwritten
    expect(conflictResult.lead.email).toBe("sparse.buyer@example.com");
    expect(conflictResult.lead.configuration).toBe("2 BHK");

    // Verify against database
    const dbLead = await testPrisma.lead.findUniqueOrThrow({
      where: { id: initialResult.lead.id },
    });
    expect(dbLead.email).toBe("sparse.buyer@example.com");
    expect(dbLead.configuration).toBe("2 BHK");
  });

  it("4. handles two simultaneous requests with the same phone via Promise.all without duplicates", async () => {
    const phone = phoneFor(4);

    const reqA = {
      name: "Concurrent Buyer A",
      phone,
      email: "concurrent.a@example.com",
      source: LeadSource.PROPERTY_PORTAL,
      campaign: "parallel-campaign-a",
    };

    const reqB = {
      name: "Concurrent Buyer B",
      phone,
      email: "concurrent.b@example.com",
      source: LeadSource.SOCIAL_MEDIA_AD,
      campaign: "parallel-campaign-b",
    };

    // Fire both requests concurrently
    const [resA, resB] = await Promise.all([
      leadService.ingestLead(reqA),
      leadService.ingestLead(reqB),
    ]);

    createdLeadIds.add(resA.lead.id);
    createdLeadIds.add(resB.lead.id);

    // Exactly one must be new; the other must be recognized as existing
    const isNewFlags = [resA.isNew, resB.isNew];
    expect(isNewFlags.filter(Boolean)).toHaveLength(1);
    expect(isNewFlags.filter((f) => !f)).toHaveLength(1);

    // Both operations must refer to the same Lead record
    expect(resA.lead.id).toBe(resB.lead.id);

    // Verify database constraint integrity: exactly 1 Lead in DB
    const matchingLeads = await testPrisma.lead.findMany({ where: { phone } });
    expect(matchingLeads).toHaveLength(1);

    // Both touchpoints must be recorded in the audit ledger
    const events = await testPrisma.leadSourceEvent.findMany({
      where: { leadId: resA.lead.id },
    });
    expect(events).toHaveLength(2);
    const sources = events.map((e) => e.source);
    expect(sources).toContain(LeadSource.PROPERTY_PORTAL);
    expect(sources).toContain(LeadSource.SOCIAL_MEDIA_AD);
  });

  it("5. creates explicit DPDP consent and preserves existing opt-out status on re-ingestion", async () => {
    const phone = phoneFor(5);

    // Step A: Ingest with explicit affirmative consent
    const consentText = "I explicitly agree to receive WhatsApp updates regarding property visits.";
    const result1 = await leadService.ingestLead({
      name: "Consent Buyer",
      phone,
      source: LeadSource.WEBSITE,
      consent: {
        consentText,
        affirmed: true,
      },
    });
    createdLeadIds.add(result1.lead.id);

    expect(result1.isNew).toBe(true);
    expect(result1.consentRecord).not.toBeNull();
    expect(result1.consentRecord?.leadId).toBe(result1.lead.id);
    expect(result1.consentRecord?.optedOut).toBe(false);
    expect(result1.consentRecord?.consentText).toBe(consentText);

    // Step B: Buyer exercises DPDP right to opt out (simulated via database update)
    const optOutTimestamp = new Date();
    await testPrisma.consentRecord.update({
      where: { leadId: result1.lead.id },
      data: {
        optedOut: true,
        optOutAt: optOutTimestamp,
      },
    });

    // Step C: Buyer submits another inquiry with new consent text (e.g. from an ad or portal)
    const result2 = await leadService.ingestLead({
      name: "Consent Buyer",
      phone,
      source: LeadSource.PROPERTY_PORTAL,
      consent: {
        consentText: "Secondary submission consent text.",
        affirmed: true,
      },
    });

    expect(result2.isNew).toBe(false);

    // CRITICAL DPDP RULE: Ordinary ingestion must NEVER silently re-opt-in an opted-out user
    expect(result2.consentRecord?.optedOut).toBe(true);

    const dbConsent = await testPrisma.consentRecord.findUniqueOrThrow({
      where: { leadId: result1.lead.id },
    });
    expect(dbConsent.optedOut).toBe(true);
    expect(dbConsent.optOutAt).not.toBeNull();
  });
});
