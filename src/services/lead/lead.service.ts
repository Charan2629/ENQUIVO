import { PrismaClient, Prisma, Lead, LeadSourceEvent, ConsentRecord } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  ingestLeadSchema,
  IngestLeadInput,
  ValidatedLeadInput,
  generateLeadCode,
  normalizePhoneNumber,
} from "@/lib/validations/lead";

export interface IngestLeadResult {
  lead: Lead;
  isNew: boolean;
  sourceEvent: LeadSourceEvent;
  consentRecord: ConsentRecord | null;
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
}
