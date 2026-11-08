# ENQUIVO — Project State & Handover Document

> **Authoritative Current State Document**
> **Milestone 1:** Completed and pushed to version control (`1a57d2d`).
> **Milestone 2:** Schema implementation, live Neon PostgreSQL migration (`20261103165535_init`), live partial unique index verification, and guarded atomic seed execution (`npx prisma db seed`) COMPLETE & PUSHED (`2e3bd3c`).
> **Milestone 3:** Core Backend Services (`LeadService`, `BookingService`, `ReminderService`), Inngest background job processor, and integration test suite COMPLETE & PUSHED (`cdb8f14`).
> **Milestone 4:** `AIConciergeService` (EN/HI/GU, VERIFIED-only Fact Sheet retrieval with portfolio/project scope separation, Zod tool calling, server-derived lead identity, dynamic salesperson assignment, direct `BookingService` delegation, and automated handoff) COMPLETE (Committed locally: `1e9831e`). Independent Security Review: APPROVED.
> **Milestone 5:** Buyer Concierge Experience — Phase 1 (Public Property Landing Page) & Phase 2 (Secure Buyer Sessions & Functional AI Concierge) COMPLETE & PUSHED (`27d0d8d`).
> **Milestone 6:** Staff Operations Dashboard — Phase 1 (Staff Authentication & Portal Shell), Phase 2 (Lead Pipeline & Ingestion Interface), Phase 3 (Handoff Queue & Lead Assignment), and Phase 4 (Fact Sheet Approval Editor, Slot Manager & Visit Attendance) COMPLETE & PUSHED (`99a604e`).
> **Milestone 7:** Source Attribution & ROI Dashboard — First-touch attribution engine, spend-efficiency metrics (CPL, CPV, visit conversion rates), multi-touch engagement distribution, median first-response time tracking vs 14h baseline, Recharts data visualizations, and server-side role privacy scoping (`SALES_HEAD` full spend visibility vs `SALES_EXEC` restricted spend privacy) COMPLETE & VERIFIED (`6142b5c`).
> **Visual Transformation & Brand Polish:** Dedicated premium visual transformation inspired by luxury architectural technology aesthetics. Coordinated Deep Ocean (`#102F43`), Jade Teal (`#13A99A`), Champagne Gold (`#D6B56D`), Pale Aqua (`#E7F4F4`), Porcelain (`#F7F8F4`), and Dark Blue-Green (`#183442`) design system. Signature 3D isometric residential development scene via Three.js. Comprehensive 100% buyer localization across English, Hindi, and Gujarati (`EN`, `HI`, `GU`). Coordinated staff portal shell, navigation, and charts. COMPLETE & VERIFIED.
> **Documentation Sync:** `docs/PROJECT_STATE.md`, `docs/TDD_DRAFT.md`, `docs/ARCHITECTURE_DECISIONS.md`, and `docs/ENGINEERING_LOG.md` are synchronized.
> **Reference Time:** 2026-11-08T20:25:00+05:30 (November 8, 2026)

---

## 1. Project Overview & Architecture Status

- **Architecture:** Modular Monolith on Next.js 16.4.4 App Router, TypeScript (strict), Tailwind CSS v4, Three.js (`^0.174.0`).
- **Brand Palette & Design Tokens:**
  - **Deep Ocean (`#102F43`):** Primary brand anchor, headers, luxury buyer cards.
  - **Jade Teal (`#13A99A`):** Vibrant interactive accent, live indicators, primary CTAs.
  - **Champagne Gold (`#D6B56D`):** Luxury accents, verified fact badges, timeline markers.
  - **Pale Aqua (`#E7F4F4`):** Soft container fills, AI chat bubbles, statutory notice fills.
  - **Porcelain (`#F7F8F4`):** Luminous, spacious surfaces for buyer experiences.
  - **Dark Blue-Green (`#183442`):** Surface depth, secondary dark cards, sidebar footers.
- **ORM & Database:** Prisma 7.10.1 Stable with `@prisma/adapter-pg` driver adapter targeting hosted Neon PostgreSQL (`neondb`). All timestamps stored in UTC; formatted in `Asia/Kolkata` (IST) at application boundary.
- **Localization (i18n):** Centralized translation dictionary (`src/lib/i18n/concierge-translations.ts`) translating 100% of visible buyer interface elements across English (`EN`), Hindi (`HI`, authentic Devanagari script), and Gujarati (`GU`, authentic Gujarati script).
- **Security & Authentication:**
  - **Buyer Session:** Signed HMAC-SHA256 HTTP-only session cookies (`eq_buyer_session`), browser-enforced CSRF / Same-Origin verification (`verifySameOrigin`), DPDP Act 2023 digital consent capture and opt-out revocation.
  - **Staff Authentication:** Argon2id password verification via `@node-rs/argon2`, signed HMAC-SHA256 HTTP-only cookie (`eq_staff_session`, 12h expiry, SameSite=Lax, Secure in prod) embedding a 32-byte `rawToken`, persistent serverless session tracking via PostgreSQL `StaffSession` records storing only `tokenHash = SHA-256(rawToken)`, brute-force login throttling, and strict live database revalidation on every protected request.
- **AI Concierge:** Google Gemini 3.8 Flash (`gemini-3.8-flash`) with bounded retries (`attempts: 3`), typed error classification, verified-facts grounding, RERA disclaimer, and direct offline human sales escalation (`POST /api/chat/handoff`).
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
| **M6** | Staff Operations Dashboard (Phase 1 Auth Shell, Phase 2 Lead Pipeline, Phase 3 Handoff Queue, Phase 4 Fact Sheet & Slots) | ✅ COMPLETE & PUSHED (`99a604e`) | 191 unit tests PASS \| 98 integration tests PASS \| `tsc --noEmit` PASS \| `lint` PASS \| `build` PASS (31 routes compiled) \| Automatic content demotion \| 1-capacity slots \| Attendance verification \| Reminder suppression |
| **M7** | Source Attribution & ROI Dashboard (First-touch attribution, ₹30L demo spend efficiency, CPL/CPV metrics, lead-to-visit rates, show-up rate, Recharts visualizations, SALES_HEAD vs SALES_EXEC spend privacy) | ✅ COMPLETE & PUSHED (`6142b5c`) | 203 unit tests PASS across 13 files \| 100 integration tests PASS across 12 files against Neon test branch `ep-mute-butterfly-b3a54tpa` \| `tsc --noEmit` PASS (0 errors) \| `lint` PASS (0 errors, 0 warnings) \| `build` PASS (32 routes compiled, Turbopack) \| Role-scoped spend privacy enforced \| No fabricated revenue disclaimer |
| **Polish & Transform** | Dedicated Premium Visual Transformation (Coordinated Deep Ocean & Jade Teal palette, Three.js 3D architectural massing scene, 100% EN/HI/GU localization, mobile drawer navigation, responsive table wrappers, synchronized staff portal) & Staff Authentication Fix (`window.location.replace`, Server Component request-time boundary `await connection()`, anti-redirect loop safeguards) | ✅ COMPLETE & VERIFIED | 212 unit tests PASS across 14 files (`buyer-localization.test.ts` [6]) \| 100 integration tests PASS across 12 files against Neon test branch `ep-mute-butterfly-b3a54tpa` \| 11/11 real-browser CDP acceptance tests PASS (9 scenarios) \| `tsc --noEmit` PASS (0 errors) \| `lint` PASS (0 errors, 0 warnings) \| `build` PASS (32 routes compiled) \| 13 visual screenshots captured |
| **Feature Branch** | Cinematic Architectural Hero Scene (`feat/cinematic-architectural-hero`) | ⬜ PENDING CHECKPOINT | Branch created after master commit & push checkpoint |
| **M8** | Final Submission Packaging (`TDD.pdf`/`docx` + `deployment.md` zip `<25MB`, zero secrets) | ⬜ NEXT | Final packaging & submission bundle |

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

- **D-001 through D-033:** Documented in `docs/TDD_DRAFT.md` and `docs/ARCHITECTURE_DECISIONS.md`.
- **D-034 (Visual Transformation & Design System):** Premium Luxury Architectural Identity & Three.js Integration (`src/lib/design-tokens.ts`, `src/components/buyer/architectural-scene-3d.tsx`, `src/app/globals.css`). Established an Awwwards-inspired real-estate technology design system based on Deep Ocean (`#102F43`), Jade Teal (`#13A99A`), Champagne Gold (`#D6B56D`), Pale Aqua (`#E7F4F4`), Porcelain (`#F7F8F4`), and Dark Blue-Green (`#183442`). To visualize the dual Ahmedabad developments without heavy video assets or external rendering dependencies, created an interactive 3D architectural massing scene using vanilla Three.js (`three` + `@types/three`), featuring stepped high-rise towers for Prakriti Heights (SG Highway) and biophilic terrace courtyards for Vaastu Enclave (Shela), damped mouse tracking, automatic rotation, and full `prefers-reduced-motion` compliance.
- **D-035 (Buyer Concierge Localization Architecture):** Centralized Trilingual Localization Dictionary (`src/lib/i18n/concierge-translations.ts`, `tests/unit/buyer-localization.test.ts`). Replaced partial hardcoded strings with a centralized translation dictionary ensuring 100% of visible intake form labels, placeholders, DPDP consent affirmations, quick inquiry pills, typing indicators, error alerts, and opt-out modals are dynamically localized in English, Hindi (Devanagari script), and Gujarati (Gujarati script). Verified via automated unit tests enforcing complete key parity and native unicode script bounds.

---

## 5. Verification Results (Current Visual Transformation Verified)

| Check | Command | Result |
|---|---|---|
| Prisma Validate | `npx prisma validate` | ✅ PASS (`The schema at prisma\schema.prisma is valid 🚀`) |
| Prisma Generate | `npx prisma generate` | ✅ PASS (`Generated Prisma Client v7.10.1`) |
| TypeScript | `npx tsc --noEmit` | ✅ PASS (0 errors across entire workspace) |
| ESLint | `npm run lint` | ✅ PASS (0 errors, 0 warnings across all files) |
| Production Build | `npm run build` | ✅ PASS (Next.js 16.4.4 Turbopack, 32 static & dynamic routes compiled) |
| Automated Unit Tests | `npm test` | ✅ PASS (212/212 tests passed across 14 files, including `buyer-localization.test.ts` [6]) |
| Integration Tests | `npm run test:integration` | ✅ PASS (100/100 tests passed across 12 files against Neon test branch `ep-mute-butterfly-b3a54tpa`) |
| Visual Capture & Audit | `node scripts/capture-visual-audit.mjs` | ✅ PASS (13 visual screenshots captured across desktop and mobile viewports) |
| Database Reseed Guard | `src/lib/seed-guard.ts` | ✅ GUARDED: Seed script strictly protected by endpoint allowlist; not executed during test verification |

---

## 6. Known Issues & Operational Limitations

1. **Synthetic Demonstration Data:** All project specifications, pricing, and registration status (`RERA Reg: DEMO-ONLY-NOT-VERIFIED`) are synthetic seed data for technical evaluation purposes only.
2. **Post-Check Interval in Reminder Dispatch:** State changes committed before the pre-dispatch database check suppress reminder delivery. A narrow post-check interval remains between database authorization and external provider invocation; provider idempotency ensures duplicate messages are not sent.
3. **Monthly Reporting Period:** Marketing performance analytics (`SourceSpend`) are structured on a monthly calendar cadence (`YYYY-MM`), aligned with real developer marketing contracts.

---

## 7. Immediate Next Action

- **Milestone 8 Execution:** Prepare final submission bundle (`TDD.pdf`/`docx` + `deployment.md` zip `<25MB`, zero secrets).
