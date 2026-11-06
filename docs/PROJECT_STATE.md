# ENQUIVO — Project State & Handover Document

> **Authoritative Current State Document**
> **Milestone 1:** Completed and pushed to version control (`1a57d2d`).
> **Milestone 2:** Schema implementation, live Neon PostgreSQL migration (`20261103165535_init`), live partial unique index verification, and guarded atomic seed execution (`npx prisma db seed`) COMPLETE & PUSHED (`2e3bd3c`).
> **Milestone 3:** Core Backend Services (`LeadService`, `BookingService`, `ReminderService`), Inngest background job processor, and integration test suite COMPLETE & PUSHED (`cdb8f14`).
> **Milestone 4:** `AIConciergeService` (EN/HI/GU, VERIFIED-only Fact Sheet retrieval with portfolio/project scope separation, Zod tool calling, server-derived lead identity, dynamic salesperson assignment, direct `BookingService` delegation, and automated handoff) COMPLETE (Committed locally: `1e9831e`). Independent Security Review: APPROVED (with 2 observations carried into M5).
> **Milestone 5:** Buyer Concierge Experience — Phase 1 (Public Property Landing Page) COMPLETE (Pending Commit). Phase 2 (Buyer Concierge UI & Secure Session Binding) NEXT.
> **Documentation Sync:** `docs/PROJECT_STATE.md`, `docs/TDD_DRAFT.md`, and `docs/ENGINEERING_LOG.md` are synchronized.
> **Reference Time:** 2026-11-06T10:50:00+05:30 (November 6, 2026)

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
| **M3** | Core Backend Services (`LeadService`, `BookingService`, `ReminderService`) & Integration Tests | ✅ COMPLETE & PUSHED (`cdb8f14`) | `vitest` unit tests PASS (38/38) \| `vitest` integration tests PASS (22/22 across 4 files) \| Isolated test endpoint `ep-mute-butterfly-b3a54tpa` verified \| `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS (Turbopack, `/api/inngest` live) |
| **M4** | `AIConciergeService` (EN/HI/GU, VERIFIED-only Fact Sheet retrieval, Zod tool calling, Handoff) | ✅ COMPLETE (Committed locally: `1e9831e`) | Security Review: APPROVED \| 38 unit tests PASS \| 29 integration tests PASS across 5 files \| `tsc --noEmit` PASS \| `lint` PASS (0 errors/warnings) \| `build` PASS (Turbopack, `/api/chat` live) \| Next: Milestone 5 |
| **M5** | Buyer Concierge Experience (Phase 1: Public Landing Page; Phase 2: Interactive Mobile Concierge UI) | 🔄 IN PROGRESS (Phase 1 Complete) | Landing Page live (`src/app/page.tsx` + 6 components) \| Live PostgreSQL Project Showcase (Prakriti Heights & Vaastu Enclave) \| Responsive desktop & mobile nav \| Security boundary: unauthenticated `/api/chat` disconnected \| `tsc` PASS (0 errors) \| `lint` PASS (0 errors/warnings) \| `build` PASS (`ƒ /` dynamic) \| 38 unit tests PASS \| 29 integration tests PASS \| HTML smoke test verified (94.8KB rendered) |
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
- **D-014:** Test Database Isolation via Neon Copy-on-Write Branch (`enquivo-test`, endpoint `ep-mute-butterfly-b3a54tpa`) and Service Dependency Injection (`constructor(private db: PrismaClient = defaultPrisma)` implemented across `LeadService`, `BookingService`, and `ReminderService`). Ensures zero test mutation on baseline seed data.
- **D-015:** Lead Ingestion Concurrency, First-Touch Attribution, and DPDP Consent Preservation Strategy. Deduplicates leads by normalized E.164 phone; retains immutable first-touch attribution (`Lead.source`); enriches missing fields non-destructively via atomic conditional SQL updates (`updateMany where email is null`); catches phone `P2002` outside aborted transactions to merge against winning records; retries `leadCode` collisions independently; and handles `ConsentRecord` via atomic `upsert` with `update: {}` to prevent PostgreSQL transaction aborts while preserving prior opt-out status (`optedOut: true`).
- **D-016:** Atomic Conditional Slot Reservation and Two-Layer Concurrency Defense. `BookingService.bookVisit` updates `VisitSlot` conditionally (`WHERE id = $1 AND status = 'AVAILABLE' AND starts_at > NOW()`). Failure to update exactly 1 row immediately yields `SlotUnavailableError`. As defense in depth, PostgreSQL's partial unique index `one_active_booking_per_slot` (`WHERE booking_status = 'CONFIRMED'`) acts as an immutable database-level safety net. `cancelBooking` marks the visit `CANCELLED`, releases the slot to `AVAILABLE` only if its start time remains in the future, and deletes only `PENDING` reminder jobs to prevent erroneous dispatches without misusing the `FAILED` status. `recordAttendance` transitions `bookingStatus` to `COMPLETED`, records `attendedAt` only for `ATTENDED`, and supports both `CONFIRMED + UNRECORDED` (post-start) and `COMPLETED + UNRECORDED` visits without altering slot status. Independent code review determination: APPROVED (with a low-severity observation that P2002 handling could more precisely inspect the constraint target).
- **D-017:** Background Job Processing, Atomic Claiming, Stale Recovery, and Bounded Retries for `ReminderService`. Dispatches 24h and 2h pre-visit reminders reliably without horizontal race conditions via: (1) Inngest Cloud cron (`*/5 * * * *`) and on-demand event trigger (`enquivo/reminders.process`) wired to Next.js route handler (`/api/inngest`); (2) atomic conditional claim (`UPDATE reminder_jobs SET status = 'PROCESSING', attempts = attempts + 1 WHERE id = $1 AND status = 'PENDING'`), providing at-least-once delivery with atomic claiming to prevent concurrent processing; (3) stale PROCESSING recovery reclaiming crashed jobs with `lastAttemptAt <= NOW() - 10m` to `PENDING` (if attempts < 3) or exhausting to `FAILED` (if attempts >= 3); (4) pre-dispatch re-verification of `SiteVisit.bookingStatus === 'CONFIRMED'`, deleting orphaned jobs upon cancellation rather than misusing `FAILED`; (5) pre-dispatch DPDP Act 2023 consent validation, suppressing dispatch and deleting unsendable jobs (`SKIPPED_OPTED_OUT`, `SKIPPED_NO_CONSENT`) to keep `FAILED` strictly reserved for delivery failure; (6) bounded retry state machine (`maxAttempts = 3`) with 5-minute backoff (`scheduledFor = NOW() + 5m`) before exhausting to `FAILED`; (7) constructor dependency injection (`ReminderService(db, notificationProvider)`) allowing mock notification provider injection without network calls; and (8) explicit documentation of the crash-after-dispatch boundary condition where worker death post-external send leads to duplicate delivery on recovery.
- **D-018:** AI Concierge Grounding, Scope Isolation, Server-Derived Identity, Multilingual Prompting, and Dynamic Database Escalation. Enforces strict anti-hallucination and security guarantees: (1) dual-flag FactSheet retrieval (`status = 'VERIFIED' AND isActive = true`) scoped to `(scope = 'PORTFOLIO' OR projectId = :projectId)`, ensuring unapproved draft facts and facts from unrelated projects never enter model context; (2) server-derived identity where `leadId` is injected strictly from the validated `conversation.leadId` rather than accepted from Gemini tool arguments, preventing argument spoofing / IDOR vulnerabilities; (3) reuse of `BookingService` for atomic slot availability checks and appointment reservations after explicit buyer confirmation; (4) dynamic salesperson assignment querying active `SALES_EXEC` records from PostgreSQL rather than hardcoding employee names; (5) pre-LLM user message persistence, ensuring buyer queries are preserved even if the LLM provider fails or times out; (6) atomic non-overwriting `firstResponseAt` capture (`updateMany where firstResponseAt is null`); (7) multilingual system prompt instructions for English, Hindi, and Gujarati with mandatory RERA compliance disclaimer (`RERA Reg: DEMO-ONLY-NOT-VERIFIED`); and (8) constructor dependency injection (`AIConciergeService(db, bookingService, geminiClient)`) allowing automated integration tests to execute with deterministic mock Gemini clients without external API key dependencies. *Independent Security Review Determination:* **APPROVED** with two architectural observations carried forward to Milestone 5: (a) booking confirmation is currently LLM-evaluated and requires independent server-side buyer confirmation in M5; and (b) conversation access currently relies on `conversationId` as a bearer capability token, requiring secure buyer-session binding before public exposure in M5 (with full Auth.js / RBAC planned for M6).
- **D-019:** Next.js 16 Cache Components Compatibility, Public Property Landing Page Architecture, and Secure Decoupling from Unauthenticated Endpoints. With Next.js 16 configured for `cacheComponents: true` and `partialPrefetching = true`, legacy route segment options (`export const dynamic = "force-dynamic"` and `export const revalidate = 60`) are explicitly forbidden by the build compiler. To allow `src/app/page.tsx` to fetch live PostgreSQL project showcase data at runtime without prerender validation failures, we applied Next.js 16's official `export const instant = false` directive, correctly designating the homepage as `ƒ /` (dynamic server-rendered). To ensure zero security regression from M4, the landing page is intentionally decoupled from the unauthenticated `/api/chat` endpoint; all buyer chat engagement remains staged visually until signed buyer-session binding and server-side booking confirmation are implemented in Milestone 5 Phase 2.

---

## 5. Verification Results (Milestones 1–5 Phase 1)

| Check | Command | Result |
|---|---|---|
| Prisma Validate | `npx prisma validate` | ✅ PASS (`The schema at prisma\schema.prisma is valid 🚀`) |
| Prisma Generate | `npx prisma generate` | ✅ PASS (`Generated Prisma Client v7.10.1`) |
| TypeScript | `npx tsc --noEmit` | ✅ PASS (0 errors) |
| ESLint | `npm run lint` | ✅ PASS (0 errors, 0 warnings) |
| Production Build | `npm run build` | ✅ PASS (Next.js 16.4.4 Turbopack, 6/6 static and dynamic pages including `ƒ /` dynamic server-rendered, `ƒ /api/chat`, and `ƒ /api/inngest`, compiled in 2.9s) |
| Database Migration | `npx prisma migrate dev --name init` | ✅ APPLIED (`20261103165535_init` applied to Neon `neondb`) |
| Live Partial Index Check | Query `pg_indexes` | ✅ VERIFIED (`CREATE UNIQUE INDEX one_active_booking_per_slot ON public.site_visits USING btree (slot_id) WHERE (booking_status = 'CONFIRMED'::"BookingStatus")`) |
| Live Tables Check | Query `information_schema.tables` | ✅ VERIFIED (All 13 domain tables + `_prisma_migrations` present) |
| Live Enums Check | Query `pg_type` | ✅ VERIFIED (All 13 custom PostgreSQL enum types present) |
| Live Foreign Keys Check | Query `pg_constraint` | ✅ VERIFIED (Foreign keys on `site_visits` with `ON DELETE RESTRICT`) |
| Database Seed | `npx prisma db seed` | ✅ COMMITTED & VERIFIED (Atomic transaction, 4 users, 2 projects, 7 facts, 3 leads, 12 slots, 2 visits, 4 reminders, 4 spends) |
| Live Seed Catalog Check | SQL Left-Join Queries | ✅ VERIFIED (0 orphans, 0 pending reminders, exact ₹30L spend, draft fact isolated) |
| Automated Unit Tests | `npm test` | ✅ PASS (`38/38 tests passed across 2 files: tests/unit/serializers.test.ts [18] and tests/unit/lead-validation.test.ts [20]` in 882ms) |
| Test Coverage | `npm run test:coverage` | ✅ PASS (100% Stmts, Branch, Funcs, Lines on `src/lib/serializers.ts`; 100% Stmts/Lines, 97.9% Branch on `src/lib/validations/lead.ts`) |
| Integration Tests | `npm run test:integration` | ✅ PASS (`29/29 tests passed across 5 files: tests/integration/db-connection.test.ts [4], tests/integration/lead-service.test.ts [5], tests/integration/booking-service.test.ts [5], tests/integration/reminder-service.test.ts [8], tests/integration/ai-service.test.ts [7]` against `ep-mute-butterfly-b3a54tpa` in 41.13s) |
| Landing Page Smoke Test | HTTP GET `http://localhost:3001/` | ✅ VERIFIED (94.8KB rendered HTML containing Prakriti Heights, Vaastu Enclave, 420 apartments, SG Highway, Shela, and RERA Reg: DEMO-ONLY-NOT-VERIFIED) |
| Whitespace & Git Diff | `git diff --check` | ✅ PASS (0 trailing whitespace or EOF formatting errors) |

---

## 6. Known Issues & Pending Execution Items

1. **Milestones 1 & 2 Completed:** Scaffolding, architecture documentation, 13-model schema, Neon hosted migration, partial unique index, safe BigInt serializers, and guarded atomic seed script completed, verified, and committed (`2e3bd3c`). Seeded data resides on Neon's default branch (`neondb`), which functions as our shared development/demonstration baseline rather than an active customer-facing production deployment.
2. **Milestone 3 Completed & Pushed (`cdb8f14`):**
   - Core Backend Services (`LeadService`, `BookingService`, `ReminderService`) and Inngest background job processor fully implemented and verified with 38 unit tests and 22 integration tests.
3. **Milestone 4 Completed (Committed locally: `1e9831e`):**
   - `AIConciergeService` (EN/HI/GU, VERIFIED-only Fact Sheet retrieval, Zod tool calling, server-derived lead identity, dynamic salesperson assignment, direct `BookingService` delegation, and automated handoff) implemented and verified.
   - Independent Security Review: **APPROVED** on 2026-11-05 with 2 observations carried into M5 (LLM-evaluated booking confirmation needing independent server-side confirmation, and bearer capability `conversationId` needing secure session binding).
   - Automated tests execute deterministically with mocked Gemini client (29/29 integration tests pass). Live Gemini smoke testing remains pending external `GEMINI_API_KEY` configuration.
4. **Milestone 5 Phase 1 Complete (Public Property Landing Page & Portfolio Presentation):**
   - **Component Architecture:** 6 modular buyer components created under `src/components/buyer/`:
     - `public-nav.tsx`: Sticky brand header with desktop anchor links, site-visit CTA, and accessible mobile drawer with hamburger/close toggle.
     - `hero-section.tsx`: Editorial headline, Ahmedabad West corridor badge, primary and secondary CTAs, and database-backed portfolio highlights strip (2 projects, 420 apartments, ₹65L–₹1.2Cr).
     - `project-showcase.tsx`: Responsive project cards for Prakriti Heights and Vaastu Enclave querying live PostgreSQL records, displaying verified configurations, price ranges, possession timelines, and statutory RERA disclaimers (`DEMO-ONLY-NOT-VERIFIED`).
     - `why-choose-us.tsx`: Four developer pillars grounded exclusively in verified facts: prime locations, transparent pricing, RERA-aligned development, and architectural excellence.
     - `concierge-cta-section.tsx`: Visual preview and value-proposition staging for upcoming 24/7 multilingual AI concierge.
     - `public-footer.tsx`: Genuine Ahmedabad office/site locations, `Asia/Kolkata` timezone reference, and statutory RERA compliance disclaimer.
   - **PostgreSQL Showcase Integration:** Server-side async data fetching in `src/app/page.tsx` querying active `Project` and verified `PORTFOLIO` `FactSheet` rows via Prisma, eliminating client-side loading spinners and API waterfalls.
   - **Next.js 16 Cache Components Migration:** Applied `export const instant = false` in `src/app/page.tsx`, adhering to Next.js 16 Cache Components specifications without resorting to deprecated `force-dynamic` directives.
   - **Visual Review Findings & UI Refinement Opportunities:** Responsive layout, typography hierarchy, and mobile drawer UX verified. Architectural cards currently utilize geometric blueprint SVG patterns; future refinement can introduce photorealistic 3D renders when developer assets are provided. Filter tabs (e.g. by location or BHK configuration) can be introduced once project inventory expands.
   - **Security Boundary Defense:** Zero connection to the unauthenticated `/api/chat` route is exposed on the public landing page. Chat triggers link to placeholder anchors `#concierge` and `#projects`, strictly isolating the public web surface from the AI chat endpoint until signed buyer-session binding is introduced in Phase 2.
   - **Verification Results:** 38 unit tests PASS, 29 integration tests PASS across 5 files, `npx tsc --noEmit` 0 errors, `npm run lint` 0 errors/warnings, `npm run build` PASS (`ƒ /` dynamic in 2.9s), live HTTP smoke test verified (94.8KB rendered).
5. **Remaining Execution Phases:**
   - **Milestone 5 Phase 2:** Interactive Buyer Concierge UI (minimalist mobile concierge widget, signed buyer-session binding to resolve M4 bearer token observation, language toggle EN/HI/GU, DPDP consent capture & opt-out, visual slot picker with independent server-side confirmation, dynamic handoff escalation banner).
   - **Milestone 6:** Sales Executive & Sales Head Portal (RBAC auth, Unified Lead List, Handoff Queue, Fact Sheet Approval Editor, Slot Manager).
   - **Milestone 7:** Source Attribution & ROI Dashboard + Complete Vitest Suite.
   - **Milestone 8:** Final Submission Packaging (`TDD.pdf`/`docx` + `deployment.md` zip `<25MB`, zero secrets).

---

## 7. Exact Next Action

Proceed to Milestone 5 Phase 2 (Buyer Concierge UI & Secure Session Binding: Minimalist mobile concierge widget, signed buyer-session binding to resolve M4 bearer token observation, language toggle EN/HI/GU, DPDP consent & opt-out, live visual slot picker with independent server-side confirmation, and dynamic handoff escalation banner).
