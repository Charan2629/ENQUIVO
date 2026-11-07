/**
 * prisma/seed.ts
 *
 * Date-Aware Seed Script for ENQUIVO with Production Safety Guards
 * and Atomic Interactive Transaction Wrapper.
 *
 * Reference Date: November 3, 2026.
 *
 * Implements:
 * - Production environment safety check (blocks execution if NODE_ENV=production)
 * - Explicit authorization guard (requires ALLOW_DESTRUCTIVE_SEED=true)
 * - Dynamic client loading: zero database connection/query before guards pass
 * - Atomic Prisma interactive transaction ($transaction with tx client)
 * - 3 exact leads from client brief (LD-58210, LD-58211, LD-58224)
 * - Historical booking for Hardik Patel (COMPLETED, attendanceOutcome UNRECORDED)
 * - Historical booking for Kavita Joshi (COMPLETED, attendanceOutcome ATTENDED)
 * - Simulated historical reminders with explicit demo data tags (zero future reminders)
 * - Future bookable slots starting from Nov 4, 2026 onward
 * - VERIFIED portfolio-scoped fact sheets and isolated DRAFT facts
 * - Illustrative source spend totaling ₹30L in paise
 * - Development-only placeholder Argon2id hashes (no real credentials)
 * - Asynchronous disconnect completed via process.exitCode = 1 in catch handler
 */

import "dotenv/config";
import { hash } from "@node-rs/argon2";
import type { PrismaClient } from "@prisma/client";
import {
  UserRole,
  FactSheetScope,
  FactSheetStatus,
  LeadSource,
  BookingStatus,
  AttendanceOutcome,
  VisitSlotStatus,
  ReminderType,
  ReminderStatus,
} from "../src/types";

let prisma: PrismaClient | null = null;

async function runSeed() {
  console.log("🌱 ENQUIVO Date-Aware Database Seed Protocol");
  console.log("📅 Reference Date: 2026-11-03T12:00:00.000Z (Nov 3, 2026)");

  // 1. Safety Guard Check: Environment and Explicit Authorization
  // These checks execute strictly before any database connection or query can occur.
  if (process.env.NODE_ENV === "production") {
    console.error(
      "🛑 FATAL SAFETY ERROR: Destructive database seeding is strictly prohibited in production environment (NODE_ENV=production)."
    );
    process.exit(1);
  }

  if (process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    console.error(
      "🛑 FATAL SAFETY ERROR: Database seed requires explicit authorization.\n" +
      "Set ALLOW_DESTRUCTIVE_SEED=true in your environment to authorize wiping and reseeding the database.\n" +
      "Example: ALLOW_DESTRUCTIVE_SEED=true npx prisma db seed"
    );
    process.exit(1);
  }

  console.log("🔒 Safety guards passed: Development environment confirmed and ALLOW_DESTRUCTIVE_SEED=true provided.");

  // 2. Initialize Prisma Client only AFTER safety guards have passed
  const prismaModule = await import("../src/lib/prisma");
  prisma = prismaModule.prisma;

  // 3. Execute Teardown and Seeding inside an Atomic Interactive Transaction
  await prisma.$transaction(
    async (tx) => {
      // Step A: Clean existing records in reverse dependency order using transaction client (tx)
      console.log("🧹 [Transaction] Cleaning existing records in reverse dependency order...");
      await tx.sourceSpend.deleteMany();
      await tx.reminderJob.deleteMany();
      await tx.siteVisit.deleteMany();
      await tx.visitSlot.deleteMany();
      await tx.chatMessage.deleteMany();
      await tx.handoff.deleteMany();
      await tx.conversation.deleteMany();
      await tx.consentRecord.deleteMany();
      await tx.leadSourceEvent.deleteMany();
      await tx.lead.deleteMany();
      await tx.factSheet.deleteMany();
      await tx.project.deleteMany();
      await tx.staffSession.deleteMany();
      await tx.user.deleteMany();

      // Step B: Seed Users with production-grade Argon2id password hashes (Synthetic Demo Evaluators)
      console.log("👤 [Transaction] Seeding Synthetic Evaluator Users with Argon2id credentials...");
      console.log("ℹ️ [Transaction] Seeding synthetic evaluator demo accounts. These credentials must never be reused in production.");

      const salesHeadHash = await hash(process.env.SEED_SALES_HEAD_PASSWORD || "DemoEval#Head2026!");
      const salesExec1Hash = await hash(process.env.SEED_SALES_EXEC1_PASSWORD || "DemoEval#ExecVikram2026!");
      const salesExec2Hash = await hash(process.env.SEED_SALES_EXEC2_PASSWORD || "DemoEval#ExecPriya2026!");
      const buyerHash = await hash(process.env.SEED_BUYER_PASSWORD || "DemoEval#BuyerHardik2026!");

      const salesHead = await tx.user.create({
        data: {
          email: "sales-head@enquivo.in",
          name: "Aarav Sharma",
          passwordHash: salesHeadHash,
          role: UserRole.SALES_HEAD,
        },
      });

      const salesExec1 = await tx.user.create({
        data: {
          email: "vikram.mehta@enquivo.in",
          name: "Vikram Mehta",
          passwordHash: salesExec1Hash,
          role: UserRole.SALES_EXEC,
        },
      });

      await tx.user.create({
        data: {
          email: "priya.desai@enquivo.in",
          name: "Priya Desai",
          passwordHash: salesExec2Hash,
          role: UserRole.SALES_EXEC,
        },
      });

      await tx.user.create({
        data: {
          email: "hardik.patel@example.com",
          name: "Hardik Patel",
          passwordHash: buyerHash,
          role: UserRole.BUYER,
        },
      });

      // Step C: Seed Projects (2 live projects in Ahmedabad, 210 units each = 420 total)
      console.log("🏢 [Transaction] Seeding Projects...");
      const project1 = await tx.project.create({
        data: {
          name: "Prakriti Heights",
          location: "SG Highway, Ahmedabad",
          reraNumber: "DEMO-ONLY-NOT-VERIFIED",
          totalUnits: 210,
        },
      });

      const project2 = await tx.project.create({
        data: {
          name: "Vaastu Enclave",
          location: "Shela, Ahmedabad",
          reraNumber: "DEMO-ONLY-NOT-VERIFIED",
          totalUnits: 210,
        },
      });

      // Step D: Seed FactSheets (VERIFIED portfolio-scope facts + DRAFT isolation test)
      console.log("📋 [Transaction] Seeding FactSheets...");
      const verifiedFacts = [
        {
          key: "portfolio_overview",
          value:
            "Enquivo Developer portfolio: 2 live residential projects in Ahmedabad offering a total of 420 premium 2 & 3 BHK apartments.",
          scope: FactSheetScope.PORTFOLIO,
          status: FactSheetStatus.VERIFIED,
          isActive: true,
        },
        {
          key: "total_apartments",
          value: "420 apartments total across both projects in Ahmedabad.",
          scope: FactSheetScope.PORTFOLIO,
          status: FactSheetStatus.VERIFIED,
          isActive: true,
        },
        {
          key: "configurations",
          value: "2 BHK and 3 BHK luxury configurations available across both projects.",
          scope: FactSheetScope.PORTFOLIO,
          status: FactSheetStatus.VERIFIED,
          isActive: true,
        },
        {
          key: "price_range",
          value: "₹65 lakh to ₹1.2 crore across both projects in Ahmedabad.",
          scope: FactSheetScope.PORTFOLIO,
          status: FactSheetStatus.VERIFIED,
          isActive: true,
        },
        {
          key: "location",
          value: "Both projects are situated in prime growth corridors of Ahmedabad, Gujarat.",
          scope: FactSheetScope.PORTFOLIO,
          status: FactSheetStatus.VERIFIED,
          isActive: true,
        },
        {
          key: "rera_compliance",
          value:
            "RERA Reg: DEMO-ONLY-NOT-VERIFIED. All project information and registration details are for demonstration purposes only.",
          scope: FactSheetScope.PORTFOLIO,
          status: FactSheetStatus.VERIFIED,
          isActive: true,
        },
      ];

      for (const fact of verifiedFacts) {
        await tx.factSheet.create({
          data: {
            ...fact,
            createdById: salesHead.id,
            verifiedById: salesHead.id,
          },
        });
      }

      // Seed a DRAFT fact to verify AI retrieval isolation
      await tx.factSheet.create({
        data: {
          key: "penthouse_availability",
          value: "Exclusive 4 BHK penthouses with private plunge pools (Unverified proposal).",
          scope: FactSheetScope.PROJECT_1,
          status: FactSheetStatus.DRAFT,
          isActive: false,
          projectId: project1.id,
          createdById: salesExec1.id,
        },
      });

      // Step E: Seed Leads (3 exact from brief)
      console.log("🎯 [Transaction] Seeding Leads (LD-58210, LD-58211, LD-58224)...");
      const hardikLead = await tx.lead.create({
        data: {
          leadCode: "LD-58210",
          name: "Hardik Patel",
          phone: "+919876543210",
          email: "hardik.patel@example.com",
          source: LeadSource.PROPERTY_PORTAL,
          projectId: project1.id,
          configuration: "3 BHK",
          firstResponseAt: new Date("2026-10-31T04:02:00.000Z"),
          createdAt: new Date("2026-10-31T04:00:00.000Z"),
        },
      });

      const nidhiLead = await tx.lead.create({
        data: {
          leadCode: "LD-58211",
          name: "Nidhi Shah",
          phone: "+919876543211",
          email: "nidhi.shah@example.com",
          source: LeadSource.SOCIAL_MEDIA_AD,
          projectId: project2.id,
          configuration: "2 BHK",
          firstResponseAt: new Date("2026-11-02T08:33:00.000Z"),
          createdAt: new Date("2026-11-02T08:30:00.000Z"),
        },
      });

      const kavitaLead = await tx.lead.create({
        data: {
          leadCode: "LD-58224",
          name: "Kavita Joshi",
          phone: "+919876543224",
          email: "kavita.joshi@example.com",
          source: LeadSource.HOARDING_CALL,
          projectId: project2.id,
          configuration: "2 BHK",
          firstResponseAt: new Date("2026-10-25T05:35:00.000Z"),
          createdAt: new Date("2026-10-25T05:30:00.000Z"),
        },
      });

      // Step F: Seed LeadSourceEvents
      console.log("📊 [Transaction] Seeding LeadSourceEvents...");
      await tx.leadSourceEvent.createMany({
        data: [
          {
            leadId: hardikLead.id,
            source: LeadSource.PROPERTY_PORTAL,
            campaign: "Housing.com Oct Premium Campaign",
            occurredAt: new Date("2026-10-31T04:00:00.000Z"),
          },
          {
            leadId: hardikLead.id,
            source: LeadSource.WEBSITE,
            campaign: "Organic Direct Visit",
            occurredAt: new Date("2026-11-01T02:00:00.000Z"),
          },
          {
            leadId: nidhiLead.id,
            source: LeadSource.SOCIAL_MEDIA_AD,
            campaign: "Meta Diwali Luxury Living Video",
            occurredAt: new Date("2026-11-02T08:30:00.000Z"),
          },
          {
            leadId: kavitaLead.id,
            source: LeadSource.HOARDING_CALL,
            campaign: "SG Highway Bopal Flyover Hoarding",
            occurredAt: new Date("2026-10-25T05:30:00.000Z"),
          },
        ],
      });

      // Step G: Seed ConsentRecords (DPDP Act 2023)
      console.log("🛡️ [Transaction] Seeding ConsentRecords (DPDP Act 2023)...");
      const consentText =
        "I explicitly consent to Enquivo contacting me via digital channels regarding residential property availability and site visits.";

      await tx.consentRecord.createMany({
        data: [
          {
            leadId: hardikLead.id,
            consentText,
            consentedAt: new Date("2026-10-31T04:01:00.000Z"),
            optedOut: false,
          },
          {
            leadId: nidhiLead.id,
            consentText,
            consentedAt: new Date("2026-11-02T08:31:00.000Z"),
            optedOut: false,
          },
          {
            leadId: kavitaLead.id,
            consentText,
            consentedAt: new Date("2026-10-25T05:31:00.000Z"),
            optedOut: false,
          },
        ],
      });

      // Step H: Seed VisitSlots & SiteVisits
      console.log("🗓️ [Transaction] Seeding Historical & Future VisitSlots...");
      const hardikSlot = await tx.visitSlot.create({
        data: {
          startsAt: new Date("2026-11-01T05:30:00.000Z"),
          endsAt: new Date("2026-11-01T06:30:00.000Z"),
          status: VisitSlotStatus.BOOKED,
          location: "Prakriti Heights Experience Gallery, Ahmedabad",
        },
      });

      const kavitaSlot = await tx.visitSlot.create({
        data: {
          startsAt: new Date("2026-10-28T05:30:00.000Z"),
          endsAt: new Date("2026-10-28T06:30:00.000Z"),
          status: VisitSlotStatus.BOOKED,
          location: "Vaastu Enclave Site Office, Shela, Ahmedabad",
        },
      });

      const futureSlotDates = [
        "2026-11-04",
        "2026-11-05",
        "2026-11-06",
        "2026-11-07",
        "2026-11-08",
      ];

      for (const dateStr of futureSlotDates) {
        await tx.visitSlot.create({
          data: {
            startsAt: new Date(`${dateStr}T04:30:00.000Z`),
            endsAt: new Date(`${dateStr}T05:30:00.000Z`),
            status: VisitSlotStatus.AVAILABLE,
            location: "Enquivo Sales Gallery, SG Highway, Ahmedabad",
          },
        });

        await tx.visitSlot.create({
          data: {
            startsAt: new Date(`${dateStr}T08:30:00.000Z`),
            endsAt: new Date(`${dateStr}T09:30:00.000Z`),
            status: VisitSlotStatus.AVAILABLE,
            location: "Enquivo Sales Gallery, SG Highway, Ahmedabad",
          },
        });
      }

      // Step I: Seed SiteVisits
      console.log("📍 [Transaction] Seeding Historical SiteVisits...");
      const hardikVisit = await tx.siteVisit.create({
        data: {
          slotId: hardikSlot.id,
          leadId: hardikLead.id,
          bookingStatus: BookingStatus.COMPLETED,
          attendanceOutcome: AttendanceOutcome.UNRECORDED,
          bookedAt: new Date("2026-10-31T04:15:00.000Z"),
        },
      });

      const kavitaVisit = await tx.siteVisit.create({
        data: {
          slotId: kavitaSlot.id,
          leadId: kavitaLead.id,
          bookingStatus: BookingStatus.COMPLETED,
          attendanceOutcome: AttendanceOutcome.ATTENDED,
          bookedAt: new Date("2026-10-25T06:00:00.000Z"),
          attendedAt: new Date("2026-10-28T05:35:00.000Z"),
        },
      });

      // Step J: Seed Simulated Historical ReminderJobs
      console.log("⏰ [Transaction] Seeding Simulated Historical ReminderJobs...");
      const simNote = "[ASSUMPTION — Simulated Historical Demonstration Record]";

      await tx.reminderJob.createMany({
        data: [
          {
            siteVisitId: hardikVisit.id,
            reminderType: ReminderType.REMINDER_24H,
            status: ReminderStatus.SENT,
            idempotencyKey: `${hardikVisit.id}:REMINDER_24H`,
            scheduledFor: new Date("2026-10-31T05:30:00.000Z"),
            sentAt: new Date("2026-10-31T05:30:05.000Z"),
            attempts: 1,
            simulationNote: simNote,
          },
          {
            siteVisitId: hardikVisit.id,
            reminderType: ReminderType.REMINDER_2H,
            status: ReminderStatus.SENT,
            idempotencyKey: `${hardikVisit.id}:REMINDER_2H`,
            scheduledFor: new Date("2026-11-01T03:30:00.000Z"),
            sentAt: new Date("2026-11-01T03:30:03.000Z"),
            attempts: 1,
            simulationNote: simNote,
          },
          {
            siteVisitId: kavitaVisit.id,
            reminderType: ReminderType.REMINDER_24H,
            status: ReminderStatus.SENT,
            idempotencyKey: `${kavitaVisit.id}:REMINDER_24H`,
            scheduledFor: new Date("2026-10-27T05:30:00.000Z"),
            sentAt: new Date("2026-10-27T05:30:05.000Z"),
            attempts: 1,
            simulationNote: simNote,
          },
          {
            siteVisitId: kavitaVisit.id,
            reminderType: ReminderType.REMINDER_2H,
            status: ReminderStatus.SENT,
            idempotencyKey: `${kavitaVisit.id}:REMINDER_2H`,
            scheduledFor: new Date("2026-10-28T03:30:00.000Z"),
            sentAt: new Date("2026-10-28T03:30:04.000Z"),
            attempts: 1,
            simulationNote: simNote,
          },
        ],
      });

      // Step K: Seed Illustrative SourceSpend
      console.log("💰 [Transaction] Seeding SourceSpend (₹30 Lakh total for Nov 2026)...");
      const spendNote = "[ASSUMPTION — Illustrative Demo Allocation]";

      await tx.sourceSpend.createMany({
        data: [
          {
            source: LeadSource.PROPERTY_PORTAL,
            monthYear: "2026-11",
            amountPaise: BigInt(120000000), // ₹12,00,000
            note: spendNote,
          },
          {
            source: LeadSource.SOCIAL_MEDIA_AD,
            monthYear: "2026-11",
            amountPaise: BigInt(80000000), // ₹8,00,000
            note: spendNote,
          },
          {
            source: LeadSource.WEBSITE,
            monthYear: "2026-11",
            amountPaise: BigInt(50000000), // ₹5,00,000
            note: spendNote,
          },
          {
            source: LeadSource.HOARDING_CALL,
            monthYear: "2026-11",
            amountPaise: BigInt(50000000), // ₹5,00,000
            note: spendNote,
          },
        ],
      });
    },
    {
      maxWait: 10000, // 10s wait for database connection acquisition
      timeout: 30000, // 30s execution timeout for remote Neon network operations
    }
  );

  console.log("✅ Database seed transaction committed successfully!");
}

runSeed()
  .catch((e) => {
    console.error("❌ Seed transaction failed and was rolled back with error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
