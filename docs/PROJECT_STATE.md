# ENQUIVO — Project State & Handover Document

> **Authoritative Current State Document**
> **Milestone 1:** Completed and pushed to version control (`1a57d2d`).
> **Milestone 2:** Schema implementation, live Neon PostgreSQL migration (`20261103165535_init`), live partial unique index verification, and guarded atomic seed execution (`npx prisma db seed`) COMPLETE & PUSHED (`2e3bd3c`).
> **Milestone 3:** Core Backend Services (`LeadService`, `BookingService`, `ReminderService`), Inngest background job processor, and integration test suite COMPLETE & PUSHED (`cdb8f14`).
> **Milestone 4:** `AIConciergeService` (EN/HI/GU, VERIFIED-only Fact Sheet retrieval with portfolio/project scope separation, Zod tool calling, server-derived lead identity, dynamic salesperson assignment, direct `BookingService` delegation, and automated handoff) COMPLETE (Committed locally: `1e9831e`). Independent Security Review: APPROVED.
> **Milestone 5:** Buyer Concierge Experience — Phase 1 (Public Property Landing Page) & Phase 2 (Secure Buyer Sessions & Functional AI Concierge) COMPLETE & PUSHED (`27d0d8d`).
> **Milestone 6:** Staff Operations Dashboard — Phase 1 (Staff Authentication & Portal Shell with Argon2id, live DB role revalidation, login throttling, CSRF defense, and role-aware navigation) COMPLETE.
> **Documentation Sync:** `docs/PROJECT_STATE.md`, `docs/TDD_DRAFT.md`, and `docs/ENGINEERING_LOG.md` are synchronized.
> **Reference Time:** 2026-11-07T11:50:00+05:30 (November 7, 2026)

---

## 1. Project Overview & Architecture Status

- **Architecture:** Modular Monolith on Next.js 16.4.4 App Router, TypeScript (strict), Tailwind CSS v4.
- **ORM & Database:** Prisma 7.10.1 Stable with `@prisma/adapter-pg` driver adapter targeting hosted Neon PostgreSQL (`neondb`). *Environment distinction:* Neon labels its initial default database branch as `[default] production` (branch ID `br-billowing-bread-b384dwk0`, endpoint `ep-frosty-tooth-b3446kf8`), which currently serves as our baseline development and demonstration database branch, distinct from an actual customer-facing live production environment. All timestamps stored in UTC; formatted in `Asia/Kolkata` (IST) at application boundary.
- **Security & Authentication:**
  - **Buyer Session:** Signed HMAC-SHA256 HTTP-only session cookies (`eq_buyer_session`), browser-enforced CSRF / Same-Origin verification (`verifySameOrigin`), DPDP Act 2023 digital consent capture and opt-out revocation.
  - **Staff Authentication (M6.1):** Production-grade Argon2id password verification via `@node-rs/argon2`, signed HMAC-SHA256 HTTP-only cookie (`eq_staff_session`, 12h expiry, SameSite=Lax, Secure in prod) embedding a 32-byte `rawToken`, persistent serverless session tracking via PostgreSQL `StaffSession` records storing only `tokenHash = SHA-256(rawToken)` with cascade deletion on user removal, brute-force login throttling (max 5 failed attempts per 15 min per IP/email), and strict live database revalidation on every protected request querying PostgreSQL `staffSession.findUnique` with `user` relation to enforce existence, instant revocation (`revokedAt !== null`), expiration verified by application code against persisted `expiresAt`, and dynamic role checks (`SALES_HEAD` vs. `SALES_EXEC`). Account deactivation is enforced via role demotion to `BUYER` or user deletion (the schema currently has no explicit `isActive` column).
- **AI Concierge:** Google Gemini 3.8 Flash (`gemini-3.8-flash`) with SDK native bounded retries (`attempts: 3`, exponential backoff with jitter on 429/503/504), typed error classification, sanitized user-facing messages, verified-facts grounding, RERA disclaimer, and direct offline human sales escalation (`POST /api/chat/handoff`).
- **Background Jobs:** Inngest Cloud for 24h & 2h pre-visit reminder jobs (persistent `ReminderJob` state machine, bounded retries `maxAttempts = 3`, idempotency key `${visitId}:${reminderType}`).

---

## 2. Milestone Execution History

| Milestone | Description | Status | Verification Summary |
|---|---|---|---|
| **M1** | Project Scaffold, Folder Structure, `.env.example`, `docs/TDD_DRAFT.md`, `deployment.md` | ✅ COMPLETE & PUSHED | `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS (5.9s) |
| **M2** | Database Architecture: Prisma 7, 13 Models, Partial Index, BigInt DTOs, Neon Migration & Guarded Seed | ✅ COMPLETE & PUSHED (`2e3bd3c`) | `prisma validate` PASS \| `prisma generate` PASS \| `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS (1.8s) \| Neon Migration `20261103165535_init` APPLIED \| Live `one_active_booking_per_slot` VERIFIED in `pg_indexes` \| Guarded Seed COMMITTED & VERIFIED |
| **M3** | Core Backend Services (`LeadService`, `BookingService`, `ReminderService`) & Integration Tests | ✅ COMPLETE & PUSHED (`cdb8f14`) | `vitest` unit tests PASS (38/38) \| `vitest` integration tests PASS (22/22 across 4 files) \| Isolated test endpoint `ep-mute-butterfly-b3a54tpa` verified \| `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS |
| **M4** | `AIConciergeService` (EN/HI/GU, VERIFIED-only Fact Sheet retrieval, Zod tool calling, Handoff) | ✅ COMPLETE & PUSHED | Security Review: APPROVED \| 38 unit tests PASS \| 29 integration tests PASS across 5 files \| `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS |
| **M5** | Buyer Concierge Experience (Phase 1: Public Property Landing Page; Phase 2: Secure Buyer Sessions & Functional AI Concierge) | ✅ COMPLETE & PUSHED (`27d0d8d`) | 62 unit tests PASS across 5 files \| 41 integration tests PASS across 6 files \| `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS \| Signed cookie session binding (`eq_buyer_session`) \| DPDP consent & opt-out \| Request-level idempotency (`clientMessageId`) \| Direct offline handoff (`/api/chat/handoff`) \| CSRF verification (`verifySameOrigin`) \| Gemini 3.8 Flash bounded retries |
| **M6 Phase 1** | Staff Authentication & Operations Portal Shell (Argon2id password verification, signed staff cookies `eq_staff_session`, DB role revalidation, brute-force login throttling, portal layout with role-aware navigation, and login UI) | ✅ COMPLETE & PUSHED (`bf7e04b`) | 83 unit tests PASS across 6 files \| 53 integration tests PASS across 7 files \| `tsc --noEmit` PASS (0 errors) \| `lint` PASS (0 errors, 0 warnings) \| `build` PASS (18 routes compiled, Turbopack) \| Persistent PostgreSQL session revocation (`StaffSession`) & replay prevention \| Two-layer token defense (`rawToken` in HMAC cookie, `tokenHash` in DB) \| Live DB role desynchronization rejection \| Seed script reseeded with synthetic demo evaluator credentials (`DemoEval#Head2026!`, `DemoEval#ExecVikram2026!`, `DemoEval#ExecPriya2026!`) \| Demo autofill environment-gated |
| **M6 Phase 2** | Lead Pipeline & Ingestion Interface (Lead list, dynamic lifecycle derivation [New, Engaged, Escalated, Booked, Visited], search, status/channel/project filters, first-touch attribution channels, manual lead ingestion modal, comprehensive lead detail page `/dashboard/leads/[id]`, and server-side SALES_HEAD vs SALES_EXEC record scoping) | ✅ COMPLETE & REVIEWED | 108 unit tests PASS across 7 files (`lead-pipeline.test.ts` [25]) \| 62 integration tests PASS across 8 files (`lead-pipeline.test.ts` [9]) against Neon test branch `ep-mute-butterfly-b3a54tpa` \| `tsc --noEmit` PASS (0 errors) \| `lint` PASS (0 errors, 0 warnings) \| `build` PASS (23 static & dynamic routes compiled, Turbopack) \| Dynamic lifecycle derivation from authoritative relational events \| Strict server-side RBAC scoping (SALES_HEAD full visibility vs SALES_EXEC assigned-only) \| Single-lead detail IDOR prevention (returns 404 on unassigned/missing) \| Real database metrics on main `/dashboard` and `/dashboard/leads` \| Manual lead ingestion restricted to SALES_HEAD \| Accurately labeled Escalated Leads metric |
| **M6 Phase 3** | Salesperson Assignment & Handoff Management Queue | ⬜ NEXT | Starting after Phase 2 checkpoint |
| **M6 Phase 4** | Site Visits, Attendance Management & Fact Sheet Administration | ⬜ PENDING | After Phase 3 |
| **M6 Phase 5** | Source Analytics, E2E QA, and Integration Review | ⬜ PENDING | After Phase 4 |
| **M7** | Source Attribution & ROI Dashboard + Complete Vitest Suite | ⬜ NOT STARTED | After M6 |
| **M8** | Final Submission Packaging (`TDD.pdf`/`docx` + `deployment.md` zip `<25MB`, zero secrets) | ⬜ NOT STARTED | Final |

---

## 3. Database Schema Reference (14 Models in `prisma/schema.prisma`)

1. **`User`**: Authentication, roles (`BUYER`, `SALES_EXEC`, `SALES_HEAD`).
2. **`StaffSession`**: Serverless session tracking and immediate global revocation (`id`, `userId`, `tokenHash` [SHA-256 unique], `expiresAt`, `revokedAt`, `createdAt`). Foreign key cascade on user deletion.
3. **`Project`**: 2 projects in Ahmedabad (Prakriti Heights & Vaastu Enclave, 210 units each = 420 total). RERA: `DEMO-ONLY-NOT-VERIFIED`.
4. **`FactSheet`**: AI grounding facts (`PORTFOLIO`, `PROJECT_1`, `PROJECT_2`). Dual-flag AI retrieval: `WHERE status = 'VERIFIED' AND isActive = true`.
5. **`Lead`**: Master lead profile with immutable first-touch `source`, optional `projectId` FK, nullable unique `phone` (`String? @unique`) for DPDP erasure collision prevention, and soft-delete/anonymization fields (`isAnonymized`, `deletedAt`).
6. **`LeadSourceEvent`**: Multi-touch channel attribution log when leads re-engage.
7. **`ConsentRecord`**: DPDP Act 2023 digital consent timestamp and opt-out registry (`optedOut: true`, `optOutAt`).
8. **`Conversation`**: Buyer chat sessions with AI Concierge (`EN`, `HI`, `GU`).
9. **`ChatMessage`**: Turn-by-turn chat history with `groundingFactIds` text array. Atomic idempotency backed by primary key constraint (`chat_messages_pkey`).
10. **`Handoff`**: Escalation queue with `escalationReason`, summary, and dynamic `assignedToId` (PostgreSQL `SALES_EXEC`).
11. **`VisitSlot`**: Appointment slots (`AVAILABLE`, `BOOKED`).
12. **`SiteVisit`**: Decoupled `bookingStatus` (`CONFIRMED`, `CANCELLED`, `COMPLETED`) and `attendanceOutcome` (`UNRECORDED`, `ATTENDED`, `NO_SHOW`). Partial unique index: `@@unique([slotId], map: "one_active_booking_per_slot", where: raw("booking_status = 'CONFIRMED'"))`.
13. **`ReminderJob`**: Pre-visit notifications with `idempotencyKey` and `simulationNote`.
14. **`SourceSpend`**: Monthly acquisition spend with `amountPaise BigInt`. Unique `[source, monthYear]`.

---

## 4. Key Architecture Decisions (Decision Log Summary)

- **D-001 through D-024:** See Section 14 in `docs/TDD_DRAFT.md`.
- **D-025 (M6.1):** Argon2id Staff Authentication and PostgreSQL Live Role Revalidation (`StaffAuthService`, `src/lib/auth-guard.ts`). Implements secure credential authentication without shared passwords or placeholder hashes. Staff credentials are authenticated via Argon2id (`@node-rs/argon2`). Issued session tokens are signed HMAC-SHA256 strings stored in HTTP-only cookies (`eq_staff_session`, 12h duration, SameSite=Lax, Secure in production). Crucially, during every protected staff request or navigation, the server guard (`requireStaffSession` / `requireStaffRole`) revalidates the user account against live PostgreSQL, ensuring deactivated users, deleted accounts, or demoted roles (`BUYER`) are rejected immediately, eliminating stale-token privilege escalation.
- **D-026 (M6.1):** Brute-Force Login Throttling and Same-Origin CSRF Defense on Staff Authentication Endpoints (`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`). Prevents credential stuffing by tracking failed login attempts per client IP and email. Exceeding 5 failed attempts within 15 minutes triggers a 429 Too Many Requests response with `Retry-After` header. State-changing auth endpoints enforce `verifySameOrigin` CSRF protection.
- **D-027 (M6.1):** Persistent Serverless Session Revocation in PostgreSQL (`StaffSession` model, migration `20261107065456_add_staff_sessions`) & Two-Layer Token Architecture. Replaced volatile in-memory revocation maps with persistent database session records. On login, a 32-byte random `rawToken` is generated. Only its deterministic SHA-256 hash (`tokenHash`) is stored in `staff_sessions.token_hash`. The client cookie (`eq_staff_session`) receives an HMAC-SHA256 signed envelope containing `rawToken`, completely concealing `tokenHash` from the browser. On every protected request, `verifySessionAndFetchUser` verifies the HMAC signature first, hashes `rawToken` on the fly, and verifies the session in PostgreSQL (`revokedAt IS NULL`, `expiresAt > NOW()`, live role match). On logout (`POST /api/auth/logout`), the session is marked `revoked_at = NOW()` in PostgreSQL. This guarantees instant, global session revocation across all serverless Vercel lambda instances and cold restarts with zero external caching infrastructure (no Redis) and protects against database-only read leaks.
- **D-028 (M6.2):** Dynamic Relational Derivation of Lead Lifecycle Status & Strict Server-Side Staff Scoping (`LeadService`, `src/lib/validations/lead.ts`, `ADR-008`). To prevent dual-source-of-truth desynchronization without mutating the schema, lead lifecycle status is derived dynamically in `computeLeadLifecycleStatus()` according to the domain hierarchy: `VISITED` (`SiteVisit.attendanceOutcome = ATTENDED`) > `BOOKED` (`SiteVisit.bookingStatus in [CONFIRMED, COMPLETED]`) > `ESCALATED` (`conversations.some.handoff != null`) > `ENGAGED` (`firstResponseAt != null` or active conversations) > `NEW`. For database-level pagination, lifecycle states map to Prisma relation filters. Data isolation is strictly enforced on the server: `SALES_HEAD` queries all active leads (`where: { deletedAt: null }`), while `SALES_EXEC` queries are scoped to leads assigned via conversation handoffs (`where: { deletedAt: null, conversations: { some: { handoff: { assignedToId: user.id } } } }`). Detail retrieval (`getLeadDetail`) applies the same scope and returns `null` (HTTP 404) for unauthorized leads to eliminate IDOR enumeration.

---

## 5. Verification Results (Milestone 6 Phase 2 Verified)

| Check | Command | Result |
|---|---|---|
| Prisma Validate | `npx prisma validate` | ✅ PASS (`The schema at prisma\schema.prisma is valid 🚀`) |
| Prisma Generate | `npx prisma generate` | ✅ PASS (`Generated Prisma Client v7.10.1`) |
| TypeScript | `npx tsc --noEmit` | ✅ PASS (0 errors across entire workspace) |
| ESLint | `npm run lint` | ✅ PASS (0 errors, 0 warnings across all files) |
| Production Build | `npm run build` | ✅ PASS (Next.js 16.4.4 Turbopack, 23 static & dynamic routes compiled in 2.3s: `ƒ /`, `○ /login`, `ƒ /dashboard`, `ƒ /dashboard/fact-sheet`, `ƒ /dashboard/handoffs`, `ƒ /dashboard/leads`, `◐ /dashboard/leads/[id]`, `ƒ /dashboard/sources`, `ƒ /dashboard/visits`, `ƒ /api/auth/login`, `ƒ /api/auth/logout`, `ƒ /api/auth/session`, `ƒ /api/chat`, `ƒ /api/chat/handoff`, `ƒ /api/chat/session`, `ƒ /api/chat/session/opt-out`, `ƒ /api/inngest`, `ƒ /api/leads`, `ƒ /api/leads/[id]`, `ƒ /api/leads/metrics`, `○ /concierge`, `○ /_not-found`) |
| Automated Unit Tests | `npm test` | ✅ PASS (108/108 tests passed across 7 files: `security.test.ts` [7], `serializers.test.ts` [18], `buyer-session.test.ts` [9], `staff-auth.test.ts` [21], `lead-validation.test.ts` [20], `lead-pipeline.test.ts` [25], `ai-error-handling.test.ts` [8]) |
| Integration Tests | `npm run test:integration` | ✅ PASS (62/62 tests passed across 8 files against Neon test branch `ep-mute-butterfly-b3a54tpa`: `db-connection.test.ts` [4], `staff-auth.test.ts` [12], `lead-service.test.ts` [5], `lead-pipeline.test.ts` [9], `booking-service.test.ts` [5], `buyer-session.test.ts` [9], `reminder-service.test.ts` [8], `ai-service.test.ts` [10]) |
| Database Reseed | `ALLOW_DESTRUCTIVE_SEED=true npx prisma db seed` | ✅ PASS: Neon PostgreSQL baseline verified |

---

## 6. Known Issues & Operational Limitations

1. **Phase 2 Delivery Scope:** Lead Pipeline (`/dashboard/leads`), Manual Ingestion Modal, Lead Detail (`/dashboard/leads/[id]`), and real database metrics on `/dashboard` and `/dashboard/leads` are fully operational.
2. **Sales Executive Assignment Dependency (M6.3):** As designed in ADR-008, `SALES_EXEC` staff accounts currently see leads assigned to them via conversation handoffs (`conversations.some.handoff.assignedToId == user.id`). In the current baseline seed, historical leads LD-58210, LD-58211, and LD-58224 do not have handoff assignments; hence an executive user (e.g. Vikram Mehta or Priya Desai) will see 0 leads until handoff assignments are performed in Milestone 6.3.
3. **Sub-Route Placeholders (M6.3–M6.5):** Sub-routes `/dashboard/handoffs`, `/dashboard/visits`, `/dashboard/fact-sheet`, and `/dashboard/sources` remain role-gated shells pending their respective phases.

---

## 7. Exact Next Action

Proceed to **Milestone 6 Phase 3: Salesperson Assignment & Handoff Management Queue** (implementing `/dashboard/handoffs`, dynamic escalation management, assignment to executive users, and escalation status updates).
