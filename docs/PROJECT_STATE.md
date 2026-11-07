# ENQUIVO — Project State & Handover Document

> **Authoritative Current State Document**
> **Milestone 1:** Completed and pushed to version control (`1a57d2d`).
> **Milestone 2:** Schema implementation, live Neon PostgreSQL migration (`20261103165535_init`), live partial unique index verification, and guarded atomic seed execution (`npx prisma db seed`) COMPLETE & PUSHED (`2e3bd3c`).
> **Milestone 3:** Core Backend Services (`LeadService`, `BookingService`, `ReminderService`), Inngest background job processor, and integration test suite COMPLETE & PUSHED (`cdb8f14`).
> **Milestone 4:** `AIConciergeService` (EN/HI/GU, VERIFIED-only Fact Sheet retrieval with portfolio/project scope separation, Zod tool calling, server-derived lead identity, dynamic salesperson assignment, direct `BookingService` delegation, and automated handoff) COMPLETE (Committed locally: `1e9831e`). Independent Security Review: APPROVED (with 2 observations carried into M5).
> **Milestone 5:** Buyer Concierge Experience — Phase 1 (Public Property Landing Page) & Phase 2 (Secure Buyer Sessions & Functional AI Concierge) COMPLETE (Working tree verified; pending git commit).
> **Milestone 6:** Sales Executive & Sales Head Portal (RBAC auth, Lead List, Handoff Queue, Fact Sheet Editor, Slot Manager) NEXT.
> **Documentation Sync:** `docs/PROJECT_STATE.md`, `docs/TDD_DRAFT.md`, and `docs/ENGINEERING_LOG.md` are synchronized.
> **Reference Time:** 2026-11-06T15:30:00+05:30 (November 6, 2026)

---

## 1. Project Overview & Architecture Status

- **Architecture:** Modular Monolith on Next.js 16.4.4 App Router, TypeScript (strict), Tailwind CSS v4.
- **ORM & Database:** Prisma 7.10.1 Stable with `@prisma/adapter-pg` driver adapter targeting hosted Neon PostgreSQL (`neondb`). *Environment distinction:* Neon labels its initial default database branch as `[default] production` (branch ID `br-billowing-bread-b384dwk0`, endpoint `ep-frosty-tooth-b3446kf8`), which currently serves as our baseline development and demonstration database branch, distinct from an actual customer-facing live production environment. All timestamps stored in UTC; formatted in `Asia/Kolkata` (IST) at application boundary.
- **Security:** Signed HMAC-SHA256 HTTP-only session cookies (`eq_buyer_session`), browser-enforced CSRF / Same-Origin verification (`verifySameOrigin`), server-side RBAC foundation, server-only Gemini API key, request-level idempotency (`clientMessageId`), explicit DPDP digital consent capture and opt-out revocation.
- **AI Concierge:** Google Gemini 3.8 Flash (`gemini-3.8-flash`) with SDK native bounded retries (`attempts: 3`, exponential backoff with jitter on 429/503/504), typed error classification, sanitized user-facing messages, verified-facts grounding, RERA disclaimer, and direct offline human sales escalation (`POST /api/chat/handoff`).
- **Background Jobs:** Inngest Cloud for 24h & 2h pre-visit reminder jobs (persistent `ReminderJob` state machine, bounded retries `maxAttempts = 3`, idempotency key `${visitId}:${reminderType}`).

---

## 2. Milestone Execution History

| Milestone | Description | Status | Verification Summary |
|---|---|---|---|
| **M1** | Project Scaffold, Folder Structure, `.env.example`, `docs/TDD_DRAFT.md`, `deployment.md` | ✅ COMPLETE & PUSHED | `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS (5.9s) |
| **M2** | Database Architecture: Prisma 7, 13 Models, Partial Index, BigInt DTOs, Neon Migration & Guarded Seed | ✅ COMPLETE & PUSHED (`2e3bd3c`) | `prisma validate` PASS \| `prisma generate` PASS \| `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS (1.8s) \| Neon Migration `20261103165535_init` APPLIED \| Live `one_active_booking_per_slot` VERIFIED in `pg_indexes` \| Guarded Seed COMMITTED & VERIFIED (4 Users, 2 Projects, 7 Facts, 3 Leads, 12 Slots, 2 Visits, 4 Reminders, ₹30L Spend, 0 Orphans) |
| **M3** | Core Backend Services (`LeadService`, `BookingService`, `ReminderService`) & Integration Tests | ✅ COMPLETE & PUSHED (`cdb8f14`) | `vitest` unit tests PASS (38/38) \| `vitest` integration tests PASS (22/22 across 4 files) \| Isolated test endpoint `ep-mute-butterfly-b3a54tpa` verified \| `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS (Turbopack, `/api/inngest` live) |
| **M4** | `AIConciergeService` (EN/HI/GU, VERIFIED-only Fact Sheet retrieval, Zod tool calling, Handoff) | ✅ COMPLETE (Committed locally: `1e9831e`) | Security Review: APPROVED \| 38 unit tests PASS \| 29 integration tests PASS across 5 files \| `tsc --noEmit` PASS \| `lint` PASS (0 errors/warnings) \| `build` PASS (Turbopack, `/api/chat` live) \| Next: Milestone 5 |
| **M5** | Buyer Concierge Experience (Phase 1: Public Property Landing Page; Phase 2: Secure Buyer Sessions & Functional AI Concierge) | ✅ COMPLETE (Working tree verified; pending commit) | 62 unit tests PASS across 5 files \| 41 integration tests PASS across 6 files \| `tsc --noEmit` PASS (0 errors) \| `lint` PASS (0 errors, 0 warnings) \| `build` PASS (8 routes compiled, Turbopack) \| Signed cookie session binding (`eq_buyer_session`) \| DPDP consent & opt-out \| Request-level idempotency (`clientMessageId`) \| Direct offline handoff (`/api/chat/handoff`) \| CSRF verification (`verifySameOrigin`) \| Gemini 3.8 Flash bounded retries \| Visual review verified via CDP screenshots |
| **M6** | Sales Executive & Sales Head Portal (RBAC auth, Lead List, Handoff Queue, Fact Sheet Editor, Slot Manager) | ⬜ NOT STARTED | After M5 |
| **M7** | Source Attribution & ROI Dashboard + Complete Vitest Suite | ⬜ NOT STARTED | After M6 |
| **M8** | Final Submission Packaging (`TDD.pdf`/`docx` + `deployment.md` zip `<25MB`, zero secrets) | ⬜ NOT STARTED | Final |

---

## 3. Database Schema Reference (13 Models in `prisma/schema.prisma`)

1. **`User`**: Authentication, roles (`BUYER`, `SALES_EXEC`, `SALES_HEAD`).
2. **`Project`**: 2 projects in Ahmedabad (Prakriti Heights & Vaastu Enclave, 210 units each = 420 total). RERA: `DEMO-ONLY-NOT-VERIFIED`.
3. **`FactSheet`**: AI grounding facts (`PORTFOLIO`, `PROJECT_1`, `PROJECT_2`). Dual-flag AI retrieval: `WHERE status = 'VERIFIED' AND isActive = true`.
4. **`Lead`**: Master lead profile with immutable first-touch `source`, optional `projectId` FK, nullable unique `phone` (`String? @unique`) for DPDP erasure collision prevention, and soft-delete/anonymization fields (`isAnonymized`, `deletedAt`).
5. **`LeadSourceEvent`**: Multi-touch channel attribution log when leads re-engage.
6. **`ConsentRecord`**: DPDP Act 2023 digital consent timestamp and opt-out registry (`optedOut: true`, `optOutAt`).
7. **`Conversation`**: Buyer chat sessions with AI Concierge (`EN`, `HI`, `GU`).
8. **`ChatMessage`**: Turn-by-turn chat history with `groundingFactIds` text array. Atomic idempotency backed by primary key constraint (`chat_messages_pkey`).
9. **`Handoff`**: Escalation queue with `escalationReason`, summary, and dynamic `assignedToId` (PostgreSQL `SALES_EXEC`).
10. **`VisitSlot`**: Appointment slots (`AVAILABLE`, `BOOKED`).
11. **`SiteVisit`**: Decoupled `bookingStatus` (`CONFIRMED`, `CANCELLED`, `COMPLETED`) and `attendanceOutcome` (`UNRECORDED`, `ATTENDED`, `NO_SHOW`). Partial unique index: `@@unique([slotId], map: "one_active_booking_per_slot", where: raw("booking_status = 'CONFIRMED'"))`.
12. **`ReminderJob`**: Pre-visit notifications with `idempotencyKey` and `simulationNote`.
13. **`SourceSpend`**: Monthly acquisition spend with `amountPaise BigInt`. Unique `[source, monthYear]`.

---

## 4. Key Architecture Decisions (Decision Log Summary)

- **D-001 through D-019:** See Section 14 in `docs/TDD_DRAFT.md` for foundational decisions (Next.js 16 App Router, Modular Monolith, Partial Unique Index, BigInt DTOs, Neon Test Branch, Atomic Lead Enrichment, Reminder State Machine, Grounding Facts Scoping, and Cache Components `instant = false`).
- **D-020 (M5.2):** Signed HMAC-SHA256 HTTP-Only Cookie Buyer Session Architecture and DPDP Consent Binding (`BuyerSessionService`). Solves the M4 bearer token observation. Session tokens are 32-byte cryptographically secure random values signed with HMAC-SHA256, issued via HTTP-only cookie (`eq_buyer_session`) with `SameSite=Lax`, `Path=/`, and 24-hour expiration. Prevents JavaScript token access (XSS defense) and eliminates bearer token spoofing. Requires explicit DPDP consent before session initialization.
- **D-021 (M5.2):** Request-Level Idempotency via Client Message IDs and PostgreSQL Primary Key Constraint. Solves race conditions under concurrent identical requests and prevents duplicate user turns on retries. Clients supply a stable `clientMessageId`; `ChatMessage.create` uses this as the record primary key. PostgreSQL's primary key constraint (`chat_messages_pkey`) atomically deduplicates simultaneous submissions (`P2002`), while retries reuse the existing unreplied record. Intentional consecutive user turns generate fresh client IDs and insert cleanly.
- **D-022 (M5.2):** Decoupled Direct Human Handoff Endpoint for Zero-LLM-Dependency Escalation (`POST /api/chat/handoff`). Guarantees that buyers can escalate to a human sales executive even during upstream AI provider outages (503/429/timeouts). Queries an active `SALES_EXEC` from PostgreSQL, creates or reuses `Handoff`, persists a localized system confirmation message, and sets `firstResponseAt` without invoking Gemini.
- **D-023 (M5.2):** Standardized Cross-Site Request Forgery (CSRF) & Same-Origin Enforcement (`src/lib/security.ts`). Centralizes browser security checks across all state-changing API endpoints (`/api/chat`, `/api/chat/handoff`, `/api/chat/session`, `/api/chat/session/opt-out`). Enforces `Sec-Fetch-Site: cross-site` rejection, `Origin` vs `Host`/`X-Forwarded-Host` validation, and fallback to `Referer` validation.
- **D-024 (M5.2):** Gemini 3.8 Flash Transition, SDK Bounded Backoff with Jitter, and Sanitized Error Telemetry. Upgraded deprecated model identifier to stable `gemini-3.8-flash`. Configured native `@google/genai` HTTP-level exponential backoff (`attempts: 3`, initial delay 1.0s, max delay 4.0s, jitter 0.5 on 429/503/504) to avoid nested retry loops. Classifies errors via `classifyGeminiError` and returns sanitized, friendly messages to the client with working retry actions, never exposing raw JSON, stack traces, or API keys.

---

## 5. Verification Results (Milestone 5 Phase 2 Verified)

| Check | Command | Result |
|---|---|---|
| Prisma Validate | `npx prisma validate` | ✅ PASS (`The schema at prisma\schema.prisma is valid 🚀`) |
| Prisma Generate | `npx prisma generate` | ✅ PASS (`Generated Prisma Client v7.10.1`) |
| TypeScript | `npx tsc --noEmit` | ✅ PASS (0 errors across entire workspace) |
| ESLint | `npm run lint` | ✅ PASS (0 errors, 0 warnings) |
| Production Build | `npm run build` | ✅ PASS (Next.js 16.4.4 Turbopack, 8 static & dynamic routes compiled in 6.3s: `ƒ /`, `○ /_not-found`, `ƒ /api/chat`, `ƒ /api/chat/handoff`, `ƒ /api/chat/session`, `ƒ /api/chat/session/opt-out`, `ƒ /api/inngest`, `○ /concierge`) |
| Automated Unit Tests | `npm test` | ✅ PASS (62/62 tests passed across 5 files in 4.45s: `security.test.ts` [7], `serializers.test.ts` [18], `lead-validation.test.ts` [20], `buyer-session.test.ts` [9], `ai-error-handling.test.ts` [8]) |
| Integration Tests | `npm run test:integration` | ✅ PASS (41/41 tests passed across 6 files against Neon test branch `ep-mute-butterfly-b3a54tpa` in 22.58s: `db-connection.test.ts` [4], `lead-service.test.ts` [5], `booking-service.test.ts` [5], `reminder-service.test.ts` [8], `buyer-session.test.ts` [9], `ai-service.test.ts` [10]) |
| Visual CDP Review | Chrome DevTools Protocol Screenshots | ✅ VERIFIED: High-DPI screenshots and edge viewport review inspected; resolved 420 apartments excessive stat wrapping by extracting clean numeric metric; updated pricing label from "VERIFIED PRICING" to "PRICE RANGE" in accordance with project brief scope |
| Whitespace & Git Diff | `git diff --check` | ✅ PASS (0 trailing whitespace or EOF formatting errors) |

---

## 6. Known Issues & Operational Limitations

1. **Live Gemini Provider Availability:** Automated unit and integration tests execute deterministically with high test fidelity using mocked and simulated Gemini clients. During live smoke testing against Google Gemini 3.8 Flash, transient HTTP 503 UNAVAILABLE responses were observed from the upstream provider due to temporary model capacity limits. The application handles this gracefully via bounded SDK retries, typed classification (`AITransientError`), sanitized buyer error banners, working retry buttons, and zero-LLM manual human escalation (`POST /api/chat/handoff`). Live conversational generation remains subject to external provider availability and account quota limits.
2. **Seed Data Environment:** Seeded leads and demonstration records reside on Neon's default branch (`neondb`), which functions as our shared development and demonstration baseline rather than a live customer-facing production database.
3. **Milestone 6 Preparation:** Milestone 5 completes the buyer-facing experience (landing page + mobile concierge + session security). Milestone 6 will implement the internal portal for Sales Executives and Sales Heads with Auth.js, Argon2id passwords, and RBAC authorization.

---

## 7. Exact Next Action

Request user review and git commit checkpoint for Milestone 5 (`feat(m5): complete public landing page and secure buyer concierge with session binding, idempotency, and offline handoff`), then proceed to **Milestone 6** (Sales Executive & Sales Head Portal).
