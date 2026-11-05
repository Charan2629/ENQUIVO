# ENQUIVO — Project State & Handover Document

> **Authoritative Current State Document**
> **Milestone 1:** Completed and pushed to version control (`1a57d2d`).
> **Milestone 2:** Schema implementation, live Neon PostgreSQL migration (`20261103165535_init`), live partial unique index verification, and guarded atomic seed execution (`npx prisma db seed`) COMPLETE & PUSHED (`2e3bd3c`).
> **Milestone 3:** In Progress — Phase 1 (Test Isolation & Harness), Phase 2 (`LeadService`), and Phase 3 (`BookingService` implementation & integration tests) COMPLETE. Phase 4 (`ReminderService` background processor) next.
> **Documentation Sync:** `docs/PROJECT_STATE.md`, `docs/TDD_DRAFT.md`, and `docs/ENGINEERING_LOG.md` are synchronized.
> **Reference Time:** 2026-11-05T18:05:40+05:30 (November 5, 2026)

---

## 1. Project Overview & Architecture Status

- **Architecture:** Modular Monolith on Next.js 16.4.4 App Router, TypeScript (strict), Tailwind CSS v4.
- **ORM & Database:** Prisma 7.10.1 Stable with `@prisma/adapter-pg` driver adapter targeting hosted Neon PostgreSQL (`neondb`). *Environment distinction:* Neon labels its initial default database branch as `[default] production` (branch ID `br-billowing-bread-b384dwk0`, endpoint `ep-frosty-tooth-b3446kf8`), which currently serves as our baseline development and demonstration database branch, distinct from an actual customer-facing live production environment. All timestamps stored in UTC; formatted in `Asia/Kolkata` (IST) at application boundary.
- **Security:** Argon2id password hashing, HTTP-only session cookies, server-side RBAC (BUYER, SALES_EXEC, SALES_HEAD), server-only Gemini API key.
- **Background Jobs:** Inngest Cloud for 24h & 2h pre-visit reminder jobs (persistent `ReminderJob` state machine, bounded retries `maxAttempts = 3`, idempotency key `${visitId}:${reminderType}`).

---

## 2. Milestone Execution History

| Milestone | Description | Status | Verification Summary |
|---|---|---|---|
| **M1** | Project Scaffold, Folder Structure, `.env.example`, `docs/TDD_DRAFT.md`, `deployment.md` | ✅ COMPLETE & PUSHED | `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS (5.9s) |
| **M2** | Database Architecture: Prisma 7, 13 Models, Partial Index, BigInt DTOs, Neon Migration & Guarded Seed | ✅ COMPLETE & PUSHED (`2e3bd3c`) | `prisma validate` PASS \| `prisma generate` PASS \| `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS (1.8s) \| Neon Migration `20261103165535_init` APPLIED \| Live `one_active_booking_per_slot` VERIFIED in `pg_indexes` \| Guarded Seed COMMITTED & VERIFIED (4 Users, 2 Projects, 7 Facts, 3 Leads, 12 Slots, 2 Visits, 4 Reminders, ₹30L Spend, 0 Orphans) |
| **M3** | Core Backend Services (`LeadService`, `BookingService`, `ReminderService`) & Integration Tests | 🟡 IN PROGRESS (Phases 1, 2 & 3 Complete) | `vitest` unit tests PASS (38/38) \| `vitest` integration tests PASS (14/14 across 3 files) \| Isolated test endpoint `ep-mute-butterfly-b3a54tpa` verified \| `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS \| Next: Phase 4 `ReminderService` |
| **M4** | `AIConciergeService` (EN/HI/GU, VERIFIED-only Fact Sheet retrieval, Zod tool calling, Handoff) | ⬜ NOT STARTED | After M3 |
| **M5** | Buyer Mobile Concierge UI (minimalist, language toggle, DPDP consent, slot picker, RERA) | ⬜ NOT STARTED | After M4 |
| **M6** | Sales Executive & Sales Head Portal (RBAC auth, Lead List, Handoff Queue, Fact Sheet Editor, Slot Manager) | ⬜ NOT STARTED | After M5 |
| **M7** | Source Attribution & ROI Dashboard + Complete Vitest Suite | ⬜ NOT STARTED | After M6 |
| **M8** | Final Submission Packaging (`TDD.pdf`/`docx` + `deployment.md` zip `<25MB`, zero secrets) | ⬜ NOT STARTED | Final |

---

## 3. Database Schema Reference (13 Models in `prisma/schema.prisma`)

1. **`User`**: Authentication, roles (`BUYER`, `SALES_EXEC`, `SALES_HEAD`).
2. **`Project`**: 2 projects in Ahmedabad (Prakriti Heights & Vaastu Enclave, 210 units each = 420 total). RERA: `DEMO-ONLY-NOT-VERIFIED`.
3. **`FactSheet`**: AI grounding facts (`PORTFOLIO`, `PROJECT_1`, `PROJECT_2`). Dual-flag AI retrieval: `WHERE status = 'VERIFIED' AND isActive = true`.
4. **`Lead`**: Master lead profile with immutable first-touch `source`, optional `projectId` FK, nullable unique `phone` (`String? @unique`) for DPDP erasure collision prevention, and soft-delete/anonymization fields (`isAnonymized`, `deletedAt`). Transcript and handoff PII scrubbing scheduled for M3/M4.
5. **`LeadSourceEvent`**: Multi-touch channel attribution log when leads re-engage.
6. **`ConsentRecord`**: DPDP Act 2023 digital consent timestamp and opt-out registry.
7. **`Conversation`**: Buyer chat sessions with AI Concierge (`EN`, `HI`, `GU`).
8. **`ChatMessage`**: Turn-by-turn chat history with `groundingFactIds` text array.
9. **`Handoff`**: Escalation queue with `escalationReason` and assigned salesperson.
10. **`VisitSlot`**: Appointment slots (`AVAILABLE`, `BOOKED`).
11. **`SiteVisit`**: Decoupled `bookingStatus` (`CONFIRMED`, `CANCELLED`, `COMPLETED`) and `attendanceOutcome` (`UNRECORDED`, `ATTENDED`, `NO_SHOW`). Partial unique index: `@@unique([slotId], map: "one_active_booking_per_slot", where: raw("booking_status = 'CONFIRMED'"))`.
12. **`ReminderJob`**: Pre-visit notifications with `idempotencyKey` and `simulationNote`.
13. **`SourceSpend`**: Monthly acquisition spend with `amountPaise BigInt`. Unique `[source, monthYear]`.

---

## 4. Key Architecture Decisions (Decision Log Summary)

- **D-001:** Next.js 16 App Router only (no Pages Router).
- **D-002:** Modular Monolith architecture.
- **D-003:** Route groups `(buyer)`, `(portal)`, `(auth)` for layout isolation.
- **D-004:** Argon2id password hashing.
- **D-005:** Inngest for background jobs (no Redis/Kafka).
- **D-006:** PostgreSQL partial unique index on active `CONFIRMED` bookings.
- **D-007:** UTC storage in DB, IST display via `date-fns-tz`.
- **D-008:** Gemini API key strictly server-side.
- **D-009:** Prisma 7.10.1 Stable with `@prisma/adapter-pg` over Prisma 8 RC.
- **D-010:** Monetary storage via integer paise with PostgreSQL `BIGINT` + JavaScript native `bigint`, eliminating IEEE-754 binary float rounding errors without `Decimal` object-wrapping overhead. Safe DTO serialization (`src/lib/serializers.ts`) handles native `JSON.stringify` BigInt serialization constraints at API boundaries.
- **D-011:** `FactSheet` dual-flag retrieval (`status = VERIFIED AND isActive = true`).
- **D-012:** Separation of `BookingStatus` from `AttendanceOutcome`.
- **D-013:** DPDP soft-delete with nullable unique `Lead.phone`, and chat transcript/handoff PII redaction (scheduled for M3/M4).
- **D-014:** Test Database Isolation via Neon Copy-on-Write Branch (`enquivo-test`, endpoint `ep-mute-butterfly-b3a54tpa`) and Service Dependency Injection (`constructor(private db: PrismaClient = defaultPrisma)` implemented in `LeadService` and `BookingService`, approved pattern for upcoming `ReminderService`). Ensures zero test mutation on baseline seed data.
- **D-015:** Lead Ingestion Concurrency, First-Touch Attribution, and DPDP Consent Preservation Strategy. Deduplicates leads by normalized E.164 phone; retains immutable first-touch attribution (`Lead.source`); enriches missing fields non-destructively via atomic conditional SQL updates (`updateMany where email is null`); catches phone `P2002` outside aborted transactions to merge against winning records; retries `leadCode` collisions independently; and handles `ConsentRecord` via atomic `upsert` with `update: {}` to prevent PostgreSQL transaction aborts while preserving prior opt-out status (`optedOut: true`).
- **D-016:** Atomic Conditional Slot Reservation and Two-Layer Concurrency Defense. `BookingService.bookVisit` updates `VisitSlot` conditionally (`WHERE id = $1 AND status = 'AVAILABLE' AND starts_at > NOW()`). Failure to update exactly 1 row immediately yields `SlotUnavailableError`. As defense in depth, PostgreSQL's partial unique index `one_active_booking_per_slot` (`WHERE booking_status = 'CONFIRMED'`) acts as an immutable database-level safety net. `cancelBooking` marks the visit `CANCELLED`, releases the slot to `AVAILABLE` only if its start time remains in the future, and deletes only `PENDING` reminder jobs to prevent erroneous dispatches without misusing the `FAILED` status. `recordAttendance` transitions `bookingStatus` to `COMPLETED`, records `attendedAt` only for `ATTENDED`, and supports both `CONFIRMED + UNRECORDED` (post-start) and `COMPLETED + UNRECORDED` visits without altering slot status. Independent code review determination: APPROVED (with a low-severity observation that P2002 handling could more precisely inspect the constraint target).

---

## 5. Verification Results (Milestone 2 & Milestone 3 Phase 1)

| Check | Command | Result |
|---|---|---|
| Prisma Validate | `npx prisma validate` | ✅ PASS (`The schema at prisma\schema.prisma is valid 🚀`) |
| Prisma Generate | `npx prisma generate` | ✅ PASS (`Generated Prisma Client v7.10.1`) |
| TypeScript | `npx tsc --noEmit` | ✅ PASS (0 errors) |
| ESLint | `npm run lint` | ✅ PASS (0 errors, 0 warnings) |
| Production Build | `npm run build` | ✅ PASS (Next.js 16.4.4 Turbopack, 4/4 static pages, compiled in 3.1s) |
| Database Migration | `npx prisma migrate dev --name init` | ✅ APPLIED (`20261103165535_init` applied to Neon `neondb`) |
| Live Partial Index Check | Query `pg_indexes` | ✅ VERIFIED (`CREATE UNIQUE INDEX one_active_booking_per_slot ON public.site_visits USING btree (slot_id) WHERE (booking_status = 'CONFIRMED'::"BookingStatus")`) |
| Live Tables Check | Query `information_schema.tables` | ✅ VERIFIED (All 13 domain tables + `_prisma_migrations` present) |
| Live Enums Check | Query `pg_type` | ✅ VERIFIED (All 13 custom PostgreSQL enum types present) |
| Live Foreign Keys Check | Query `pg_constraint` | ✅ VERIFIED (Foreign keys on `site_visits` with `ON DELETE RESTRICT`) |
| Database Seed | `npx prisma db seed` | ✅ COMMITTED & VERIFIED (Atomic transaction, 4 users, 2 projects, 7 facts, 3 leads, 12 slots, 2 visits, 4 reminders, 4 spends) |
| Live Seed Catalog Check | SQL Left-Join Queries | ✅ VERIFIED (0 orphans, 0 pending reminders, exact ₹30L spend, draft fact isolated) |
| Automated Unit Tests | `npm test` | ✅ PASS (`38/38 tests passed across 2 files: tests/unit/serializers.test.ts [18] and tests/unit/lead-validation.test.ts [20]`) |
| Test Coverage | `npm run test:coverage` | ✅ PASS (100% Stmts, Branch, Funcs, Lines on `src/lib/serializers.ts`; 100% Stmts/Lines, 97.9% Branch on `src/lib/validations/lead.ts`) |
| Integration Tests | `npm run test:integration` | ✅ PASS (`14/14 tests passed across 3 files: tests/integration/db-connection.test.ts [4], tests/integration/lead-service.test.ts [5], tests/integration/booking-service.test.ts [5]` against `ep-mute-butterfly-b3a54tpa`) |
| Production Build | `npm run build` | ✅ PASS (Next.js 16.4.4 Turbopack, 4/4 static pages, compiled in 3.1s) |

---

## 6. Known Issues & Pending Execution Items

1. **Milestones 1 & 2 Completed:** Scaffolding, architecture documentation, 13-model schema, Neon hosted migration, partial unique index, safe BigInt serializers, and guarded atomic seed script completed, verified, and committed (`2e3bd3c`). Seeded data resides on Neon's default branch (`neondb`), which functions as our shared development/demonstration baseline rather than an active customer-facing production deployment.
2. **Milestone 3 Phase 1 Complete:**
   - Step 1 completed: `zod` (`^4.6.7`), `inngest` (`^4.26.2`), `vitest` (`^5.1.0`), `@vitest/coverage-v8` (`^5.1.0`), `@types/node` (`^24.19.2`) installed.
   - Step 2 completed: Scoped unit test configuration (`vitest.config.mts`) and 18 unit tests in `tests/unit/serializers.test.ts` passing with 100% coverage strictly on `src/lib/serializers.ts`.
   - Step 3 completed: Test database isolation configured via `tests/helpers/testPrisma.ts` targeting isolated Neon branch (`enquivo-test`, branch ID `br-nameless-waterfall-b3omykg9`, endpoint `ep-mute-butterfly-b3a54tpa`), separate `vitest.integration.config.mts`, `test:integration` script, and 4/4 read-only smoke tests in `tests/integration/db-connection.test.ts` passing.
3. **Milestone 3 Phase 2 Complete (`LeadService` Implementation & Verification):**
   - Step 1 completed: `src/lib/validations/lead.ts` with strict phone normalization (regex allow-list `/^\+?[\d\s\-()]+$/`, E.164 formatting), email normalization, `generateLeadCode()` (`LD-` + base36 timestamp + 8-char random hex), and Zod validation schemas (`ingestLeadSchema` requiring `affirmed: true` on DPDP consent). Authored 20 unit tests in `tests/unit/lead-validation.test.ts` (100% statements/lines, 97.9% branch coverage).
   - Step 2 completed: `src/services/lead/lead.service.ts` implementing `LeadService` with constructor dependency injection (`constructor(private db: PrismaClient = defaultPrisma)`), atomic interactive transactions, out-of-transaction `P2002` error discrimination (recovering from concurrent phone insertion races by querying the winning lead outside the aborted transaction), separate bounded retry loop (3x) for `leadCode` collisions, atomic non-destructive conditional enrichment (`updateMany` where `email/projectId/configuration` is null), atomic DPDP consent handling via `upsert` with `update: {}` to prevent transaction abort while strictly preserving existing opt-out status, and `{ maxWait: 10000, timeout: 15000 }` transaction options for remote cloud latency resilience.
   - Step 3 completed: Authored 5 integration tests in `tests/integration/lead-service.test.ts` validating new lead creation with audit touchpoint, duplicate ingestion retaining immutable first-touch attribution, non-destructive conditional enrichment, `Promise.all` concurrent race handling, and DPDP consent creation + opt-out preservation, with scoped `createdLeadIds` FK-respecting teardown and clean client disconnect.
   - Design Limitation Identified: Append-only ledger for `LeadSourceEvent`. Idempotency across duplicate webhook deliveries without external payload event IDs is an explicit MVP design trade-off.
4. **Milestone 3 Phase 3 Complete (`BookingService` Implementation & Verification):**
   - Created `src/lib/validations/booking.ts` with Zod schemas and inferred types (`getAvailableSlotsSchema`, `bookVisitSchema`, `cancelBookingSchema`, `recordAttendanceSchema`).
   - Created `src/services/booking/booking.service.ts` implementing `BookingService` with constructor dependency injection (`constructor(private db: PrismaClient = defaultPrisma)`), atomic conditional slot reservation (`updateMany` where `status = AVAILABLE` and `startsAt > NOW()`), `SiteVisit` insertion (`CONFIRMED`), relative reminder scheduling (24h and 2h pre-visit, excluding past scheduled times), safe cancellation releasing only future slots and deleting only `PENDING` reminders while retaining the historical `SiteVisit` record, and attendance recording supporting both `CONFIRMED + UNRECORDED` (post-start) and `COMPLETED + UNRECORDED` visits without altering slot status. Zero schema migrations required.
   - Created `tests/integration/booking-service.test.ts` with 5 integration tests validating booking and reminder staging, `Promise.all` concurrent slot conflicts, cancellation with slot release and reminder deletion, rebooking while preserving cancelled history, past slot rejection, and attendance recording for both confirmed and historical completed visits.
   - Independent Code Review Determination: **APPROVED** (noting a low-severity observation that P2002 handling could more precisely inspect the constraint target).
5. **Milestone 3 Phase 4 Next:** `ReminderService` implementation (Inngest background job processor, 24h and 2h pre-visit reminder dispatching with mock messaging provider, persistent `ReminderJob` state transitions `PENDING -> PROCESSING -> SENT / FAILED`, idempotency key verification `${visitId}:${reminderType}`, and bounded retry policy `maxAttempts = 3`).

---

## 7. Exact Next Action

Proceed to Milestone 3 Phase 4 (`ReminderService` background processor implementation and verification).
