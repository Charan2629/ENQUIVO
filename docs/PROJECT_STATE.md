# ENQUIVO — Project State & Handover Document

> **Authoritative Current State Document**
> **Milestone 1:** Completed and pushed to version control.
> **Milestone 2:** Schema implementation, live Neon PostgreSQL migration (`20261103165535_init`), live partial unique index verification, and guarded atomic seed execution (`npx prisma db seed`) COMPLETE & VERIFIED.
> **Milestone 3:** Not started.
> **Reference Time:** 2026-11-03T23:20:00+05:30 (November 3, 2026)

---

## 1. Project Overview & Architecture Status

- **Architecture:** Modular Monolith on Next.js 16.4.4 App Router, TypeScript (strict), Tailwind CSS v4.
- **ORM & Database:** Prisma 7.10.1 Stable with `@prisma/adapter-pg` driver adapter targeting hosted Neon PostgreSQL. All timestamps stored in UTC; formatted in `Asia/Kolkata` (IST) at application boundary.
- **Security:** Argon2id password hashing, HTTP-only session cookies, server-side RBAC (BUYER, SALES_EXEC, SALES_HEAD), server-only Gemini API key.
- **Background Jobs:** Inngest Cloud for 24h & 2h pre-visit reminder jobs (persistent `ReminderJob` state machine, bounded retries `maxAttempts = 3`, idempotency key `${visitId}:${reminderType}`).

---

## 2. Milestone Execution History

| Milestone | Description | Status | Verification Summary |
|---|---|---|---|
| **M1** | Project Scaffold, Folder Structure, `.env.example`, `docs/TDD_DRAFT.md`, `deployment.md` | ✅ COMPLETE & PUSHED | `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS (5.9s) |
| **M2** | Database Architecture: Prisma 7, 13 Models, Partial Index, BigInt DTOs, Neon Migration & Guarded Seed | ✅ COMPLETE & VERIFIED | `prisma validate` PASS \| `prisma generate` PASS \| `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS (1.8s) \| Neon Migration `20261103165535_init` APPLIED \| Live `one_active_booking_per_slot` VERIFIED in `pg_indexes` \| Guarded Seed COMMITTED & VERIFIED (4 Users, 2 Projects, 7 Facts, 3 Leads, 12 Slots, 2 Visits, 4 Reminders, ₹30L Spend, 0 Orphans) |
| **M3** | Core Backend Services (`LeadService`, `BookingService`, `ReminderService`) & Integration Tests | ⬜ NOT STARTED | Scheduled next |
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
- **D-010:** `amountPaise BigInt` with safe DTO serialization (`src/lib/serializers.ts`). Distinguishes JS `Number.MAX_SAFE_INTEGER` (~₹90.07 lakh crore) from PostgreSQL 32-bit `INTEGER` overflow (~₹2.14 crore).
- **D-011:** `FactSheet` dual-flag retrieval (`status = VERIFIED AND isActive = true`).
- **D-012:** Separation of `BookingStatus` from `AttendanceOutcome`.
- **D-013:** DPDP soft-delete with nullable unique `Lead.phone`, and chat transcript/handoff PII redaction (scheduled for M3/M4).

---

## 5. Verification Results (Milestone 2)

| Check | Command | Result |
|---|---|---|
| Prisma Validate | `npx prisma validate` | ✅ PASS (`The schema at prisma\schema.prisma is valid 🚀`) |
| Prisma Generate | `npx prisma generate` | ✅ PASS (`Generated Prisma Client v7.10.1`) |
| TypeScript | `npx tsc --noEmit` | ✅ PASS (0 errors) |
| ESLint | `npm run lint` | ✅ PASS (0 errors, 0 warnings) |
| Production Build | `npm run build` | ✅ PASS (Next.js 16.4.4 Turbopack, 4/4 static pages, compiled in 4.0s) |
| Database Migration | `npx prisma migrate dev --name init` | ✅ APPLIED (`20261103165535_init` applied to Neon `neondb`) |
| Live Partial Index Check | Query `pg_indexes` | ✅ VERIFIED (`CREATE UNIQUE INDEX one_active_booking_per_slot ON public.site_visits USING btree (slot_id) WHERE (booking_status = 'CONFIRMED'::"BookingStatus")`) |
| Live Tables Check | Query `information_schema.tables` | ✅ VERIFIED (All 13 domain tables + `_prisma_migrations` present) |
| Live Enums Check | Query `pg_type` | ✅ VERIFIED (All 13 custom PostgreSQL enum types present) |
| Live Foreign Keys Check | Query `pg_constraint` | ✅ VERIFIED (Foreign keys on `site_visits` with `ON DELETE RESTRICT`) |
| Database Seed | `npx prisma db seed` | ✅ COMMITTED & VERIFIED (Atomic transaction, 4 users, 2 projects, 7 facts, 3 leads, 12 slots, 2 visits, 4 reminders, 4 spends) |
| Live Seed Catalog Check | SQL Left-Join Queries | ✅ VERIFIED (0 orphans, 0 pending reminders, exact ₹30L spend, draft fact isolated) |
| Automated Tests | `npm test` | ⚠️ NOT CONFIGURED (Vitest test harness scheduled in Milestone 3) |

---

## 6. Known Issues & Pending Execution Items

1. **Milestone 2 Completed:** All 3 phases of Milestone 2 (Configuration, Initial Migration with Partial Index, Guarded Atomic Seed) have been executed and verified in Neon PostgreSQL.
2. **Milestone 3 Not Started:** Development of `LeadService`, `BookingService`, `ReminderService`, and Vitest integration test suite is scheduled next.

---

## 7. Exact Next Action

Review Milestone 2 completion report and reply `"Next"` to unlock **Milestone 3: Core Backend Services (`LeadService`, `BookingService`, `ReminderService`) & Integration Tests**.
