# ENQUIVO — Technical Design Document (DRAFT)

> **Status:** DRAFT — Updated incrementally per milestone.
> **GitHub URL:** *(to be added at Milestone 8)*
> **Live URL:** *(to be added at Milestone 8)*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema — 14 Models](#4-database-schema--14-models)
5. [Timezone Strategy](#5-timezone-strategy)
6. [Security Architecture](#6-security-architecture)
7. [RERA & DPDP Compliance](#7-rera--dpdp-compliance)
8. [Fact Sheet Approval Policy](#8-fact-sheet-approval-policy)
9. [Booking Lifecycle & Concurrency Control](#9-booking-lifecycle--concurrency-control)
10. [Scheduled Reminder Processing](#10-scheduled-reminder-processing)
11. [AI Concierge Design](#11-ai-concierge-design)
12. [Analytics & Metric Definitions](#12-analytics--metric-definitions)
13. [Decision Log](#13-decision-log)
14. [Assumptions Register](#14-assumptions-register)
15. [Milestone Completion Tracker](#15-milestone-completion-tracker)

---

## 1. Executive Summary

ENQUIVO is an AI-powered lead-response and site-visit assistant for a residential real estate developer operating in Ahmedabad. The system addresses two core problems:

1. **Slow lead response** — the industry baseline is ~14 hours for a first human response; ENQUIVO's AI Concierge responds instantly in English, Hindi, or Gujarati (EN/HI/GU), 24 × 7.
2. **Site-visit leakage** — leads who enquire but never book a visit, or book and no-show, represent lost pipeline. ENQUIVO automates slot booking, 24-hour and 2-hour reminders, and tracks attendance for ROI attribution.

**Scope of client brief:**
- 2 live projects in Ahmedabad
- 420 apartments total (2 BHK and 3 BHK configurations)
- Price range: ₹65 lakh to ₹1.2 crore
- 3 user roles: Buyer (mobile), Sales Executive, Sales Head

---

## 2. Architecture Overview

ENQUIVO is a **modular monolith** built on Next.js 16 App Router. Business logic is encapsulated in independent TypeScript service modules under `src/services/`. Route Handlers in `src/app/api/` are thin — they validate input with Zod, delegate to services, and return responses.

```
┌────────────────────────────────────────────────────────────────┐
│                       Vercel Edge / Node.js                    │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │               Next.js 16 App Router                      │  │
│  │                                                           │  │
│  │  src/app/(buyer)/      ← Buyer Mobile Concierge UI       │  │
│  │  src/app/(portal)/     ← Sales Exec + Sales Head Portal  │  │
│  │  src/app/(auth)/       ← Auth.js sign-in pages           │  │
│  │  src/app/api/          ← Route Handlers (REST)           │  │
│  └──────────────┬────────────────────────────────────────────┘  │
│                 │ calls                                          │
│  ┌──────────────▼────────────────────────────────────────────┐  │
│  │                   Service Layer                            │  │
│  │  LeadService  BookingService  ReminderService  AIService  │  │
│  └──────────────┬────────────────────────────────────────────┘  │
│                 │ Prisma ORM                                     │
│  ┌──────────────▼────────────────────────────────────────────┐  │
│  │           Neon PostgreSQL (UTC timestamps)                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                │
│  Inngest Cloud ──► ReminderService (background jobs)          │
│  Google Gemini API ──► AIConciergeService (server-side only)  │
└────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| App structure | Modular monolith | Avoids operational complexity of microservices for a take-home scope; services can be extracted later |
| Router | Next.js App Router only | No Pages Router; App Router provides Server Components, route groups, and typed `RouteContext` |
| API style | REST Route Handlers | Simple, reviewable; GraphQL is unnecessary complexity here |
| DB access | Prisma ORM | Type-safe queries, migration history, seed scripts, Neon compatibility |
| Auth | Auth.js v5 (beta) with Prisma adapter | Built-in session management, HTTP-only cookies, role-aware session |
| Styling | Tailwind CSS v4 + shadcn/ui | Utility-first; shadcn gives accessible, unstyled primitives |
| AI | Google Gemini API (`@google/genai`) | Required by client brief; server-side only |
| Background jobs | Inngest | Durable job execution, built-in retries, idempotency, Vercel-native |
| Testing | Vitest + React Testing Library + Playwright | Standard modern stack; Vitest is fast and ESM-native |

---

## 3. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 16.4.4 |
| Language | TypeScript | ^5 |
| UI Library | React | 19.3.0 |
| Styling | Tailwind CSS | ^4 |
| Component Library | shadcn/ui | (Milestone 5) |
| Icons | Lucide React | ^1.16.0 |
| Charts | Recharts | (Milestone 7) |
| Forms | React Hook Form + Zod | (Milestone 5) |
| ORM | Prisma | 7.10.1 |
| Database | Neon PostgreSQL (@prisma/adapter-pg) | hosted |
| Auth | Auth.js v5 + Prisma adapter | (Milestone 6) |
| Password Hashing | Argon2id (`@node-rs/argon2`) | (Milestone 6) |
| AI | Google Gemini API (`@google/genai`) | (Milestone 4) |
| Background Jobs | Inngest | (Milestone 3) |
| Date Handling | date-fns (4.4.0) + date-fns-tz (3.2.0) | 4.x / 3.x |
| Unit Tests | Vitest (scoped via `vitest.config.mts`) | 5.1.0 (Milestone 3 Phase 1) |
| Integration Tests | Vitest + Isolated Neon Branch (`vitest.integration.config.mts`) | 5.1.0 (Milestone 3 Phase 1) |
| E2E Tests | Playwright | (Milestone 7) |
| Deployment | Vercel | (Milestone 8) |
| CI | GitHub Actions | (Milestone 8) |
| Package Manager | npm | — |

---

## 4. Database Schema — 14 Models

All 14 models are defined in `prisma/schema.prisma` targeting PostgreSQL (hosted on Neon) using Prisma 7.10.1 with `previewFeatures = ["partialIndexes"]`. *(Note: Neon assigns the label `[default] production` to the initial database branch, which currently serves as our baseline development and demonstration environment, distinct from a customer-facing live production deployment).*

| # | Model | Key Fields & Constraints | Audit & Delete Policy |
|---|---|---|---|
| 1 | `User` | `id` (cuid), `email` (unique), `passwordHash`, `name`, `role` (`BUYER`, `SALES_EXEC`, `SALES_HEAD`) | Governs Fact Sheet creation/verification and handoff assignment. |
| 2 | `StaffSession` | `id` (cuid), `userId` (FK), `tokenHash` (SHA-256 unique), `expiresAt`, `revokedAt`, `createdAt` | Serverless persistent session tracking and instant global revocation across lambdas. Cascade on User. |
| 3 | `Project` | `id`, `name`, `location`, `reraNumber` (`DEMO-ONLY-NOT-VERIFIED`), `totalUnits` (210 each) | Cascades to scoped FactSheets; referenced by Leads via `projectId` (SetNull). |
| 4 | `FactSheet` | `id`, `key`, `value` (Text), `scope` (`PORTFOLIO`, `PROJECT_1`, `PROJECT_2`), `status` (`VERIFIED`, `DRAFT`, `UNVERIFIED`), `isActive` (Boolean, default: true) | Explicit relations: `createdBy` (Restrict), `verifiedBy` (SetNull). AI only retrieves `status = VERIFIED AND isActive = true`. |
| 5 | `Lead` | `id`, `leadCode` (unique), `name`, `phone` (unique, nullable in DB for anonymisation, required by Zod on creation), `email`, `source` (immutable first-touch), `projectId` (FK, SetNull), `configuration`, `firstResponseAt`, `isAnonymized`, `deletedAt` | DPDP Soft-delete: phone set to NULL to prevent unique collisions across anonymised records; visits/attribution preserved for audit. Transcript/handoff PII redaction scheduled for M3/M4. |
| 6 | `LeadSourceEvent` | `id`, `leadId`, `source`, `campaign`, `occurredAt` | Multi-touch attribution log. Retains full history when duplicate phone merges. Cascade on Lead. |
| 7 | `ConsentRecord` | `id`, `leadId` (unique, 1:1), `consentText`, `consentedAt`, `optedOut`, `optOutAt` | DPDP Act 2023 explicit digital consent tracking and opt-out state. Cascade on Lead. |
| 8 | `Conversation` | `id`, `leadId`, `language` (`EN`, `HI`, `GU`), `startedAt`, `endedAt` | Restrict deletion on Lead to preserve conversation audit history. |
| 9 | `ChatMessage` | `id`, `conversationId`, `role` (`USER`, `AI`), `content` (Text), `groundingFactIds` (text[]) | Cascade on Conversation. Stores exact grounding fact IDs retrieved for each turn. |
| 10 | `Handoff` | `id`, `conversationId` (unique, 1:1), `escalationReason`, `summary`, `status`, `assignedToId` | Escalation queue for Sales Execs. Assigned to User (SetNull). Cascade on Conversation. |
| 11 | `VisitSlot` | `id`, `startsAt`, `endsAt`, `status` (`AVAILABLE`, `BOOKED`), `location` | Indexed on `[startsAt, status]`. Only future slots are released upon cancellation. |
| 12 | `SiteVisit` | `id`, `slotId`, `leadId`, `bookingStatus` (`CONFIRMED`, `CANCELLED`, `COMPLETED`), `attendanceOutcome` (`UNRECORDED`, `ATTENDED`, `NO_SHOW`), `bookedAt`, `cancelledAt`, `attendedAt` | Restrict on slot and lead. Protected by partial unique index on active bookings. |
| 13 | `ReminderJob` | `id`, `siteVisitId`, `reminderType` (`REMINDER_24H`, `REMINDER_2H`), `status` (`PENDING`, `PROCESSING`, `SENT`, `FAILED`), `idempotencyKey` (unique), `scheduledFor`, `simulationNote` | Idempotent background jobs with bounded retry (`maxAttempts = 3`). Cascade on SiteVisit. |
| 14 | `SourceSpend` | `id`, `source`, `monthYear`, `amountPaise` (BigInt), `note` | Unique `[source, monthYear]`. Currency stored in paise to eliminate floating-point drift. |

### Partial Unique Index (Concurrency Defense)

```prisma
@@unique([slotId], map: "one_active_booking_per_slot", where: raw("booking_status = 'CONFIRMED'"))
```

Generated PostgreSQL DDL:
```sql
CREATE UNIQUE INDEX "one_active_booking_per_slot"
  ON "site_visits"("slot_id")
  WHERE (booking_status = 'CONFIRMED'::"BookingStatus");
```

- **Guarantees:** At most one `CONFIRMED` booking can actively hold any `VisitSlot`.
- **Cancellation & Rebooking:** Transitioning a booking to `CANCELLED` removes it from the partial index predicate, permitting the slot to be rebooked immediately while retaining the historical audit record.
- **Completed Past Bookings:** Marked `COMPLETED` and `BOOKED` historically; temporal guards (`startsAt > NOW()`) prevent past slots from being scheduled in the future.

---

## 5. Timezone Strategy

| Context | Standard |
|---|---|
| Database storage | **UTC** — all `DateTime` fields in Prisma use `@default(now())` which stores UTC |
| API responses | UTC ISO 8601 strings |
| UI display | **IST (Asia/Kolkata, UTC+5:30)** — converted using `date-fns-tz` |
| Reminder scheduling | Stored in UTC; IST displayed in reminder message payloads |

**Date logic for seed data:**
- Today = **November 3, 2026** (reference date locked per client brief)
- Hardik Patel's `2026-11-01 11:00 IST` booking is in the **past** — treated as historical, no future reminders queued
- New `AVAILABLE` slots seeded from **November 4, 2026** onward for live booking tests

---

## 6. Security Architecture

### Authentication
- **Buyer Sessions:** Signed HMAC-SHA256 HTTP-only cookies (`eq_buyer_session`) bound to explicit DPDP Act 2023 consent, non-destructive lead deduplication, and server-derived conversation identity.
- **Staff Authentication:** Argon2id password hashing via `@node-rs/argon2` (memory-hard; resistant to GPU brute-force). Issued sessions are signed HMAC-SHA256 tokens stored in secure, HTTP-only cookies (`eq_staff_session`, SameSite=Lax, Secure in production).
- **Persistent Serverless Session Revocation & Two-Layer Defense:** In serverless architectures (Next.js on Vercel), in-memory revocation registries fail due to isolated memory per lambda instance and cold restarts. The authentication system uses a hardened two-layer defense: the browser cookie is an HTTP-only bearer credential containing a 32-byte cryptographically secure random `rawToken` inside an HMAC-SHA256 signed envelope. PostgreSQL stores only the deterministic one-way `SHA-256(rawToken)` (`StaffSession` model, `tokenHash`). On every protected request, the server verifies the HMAC signature first, extracts `rawToken`, computes `SHA-256(rawToken)` on the fly, and queries PostgreSQL to verify the session exists, is not revoked (`revokedAt IS NULL`), and has not expired. On logout, `revokedAt = NOW()` is recorded in PostgreSQL. This guarantees instant global session revocation across serverless instances and ensures that a database read leak does not expose valid bearer session credentials.
- **Live Account Revalidation:** Every protected staff request executes a live database query (`findUnique` on `StaffSession` including `user`), asserting that: (1) the session is not revoked in PostgreSQL, (2) the session has not expired (application check comparing `new Date() > persistedSession.expiresAt`), (3) the user account exists in PostgreSQL, and (4) the user's live database role matches the session claim and has authorized staff privileges (`SALES_HEAD` or `SALES_EXEC`). Note that `User` does not currently contain an explicit `isActive` column; account suspension is enforced either by demoting the role to `BUYER` or deleting the user (which cascades to delete all `StaffSession` records).

### Role-Based Access Control (RBAC)
- Enforced server-side in every Route Handler and Service method
- Never rely on client-side role checks alone (IDOR prevention)

| Role | Permitted Access |
|---|---|
| `BUYER` | Own lead profile, own conversations, own site visits |
| `SALES_EXEC` | Assigned leads, handoff queue, assigned conversations |
| `SALES_HEAD` | All leads, all flagged chats, Fact Sheet editor, Slot Manager, Analytics dashboard |

### AI Security
- Gemini API key stored exclusively in server environment (`GEMINI_API_KEY`)
- Never referenced in any `NEXT_PUBLIC_*` variable
- Every AI tool-call argument validated with **Zod** before execution
- AI may only retrieve `ACTIVE + VERIFIED` FactSheet records

### Input Validation
- All Route Handler request bodies validated with Zod schemas in `src/lib/validations/`
- Zod parse errors return `400 Bad Request` with structured field errors

---

## 7. RERA & DPDP Compliance

### RERA

> [ASSUMPTION] — RERA registration numbers are placeholders only.

- **Real RERA numbers must never be fabricated.** All seeded and displayed RERA fields use the placeholder: `RERA Reg: DEMO-ONLY-NOT-VERIFIED`
- A compliance disclaimer is displayed in the Buyer UI: *"RERA registration details shown are for demonstration purposes only and have not been verified."*

### DPDP Act 2023 (India Digital Personal Data Protection)

- Explicit consent is captured before the AI Concierge chat begins
- `ConsentRecord` stores: `consentTimestamp` (UTC), `consentText` (exact wording shown), `optedOut` (boolean), `optOutTimestamp`
- Opt-out is honoured immediately — AI Concierge will not initiate new conversations for opted-out leads
- No real WhatsApp/SMS messages are ever sent (mock messaging provider only)

---

## 8. Fact Sheet Approval Policy

| Status | Who can create | Who can approve | AI can use? |
|---|---|---|---|
| `VERIFIED` | `SALES_HEAD` (approve action) | `SALES_HEAD` | ✅ Yes |
| `DRAFT` | `SALES_HEAD` | — | ❌ No |
| `UNVERIFIED` | System / seed | `SALES_HEAD` | ❌ No |

### Scope Rules
- Portfolio-level facts (`PORTFOLIO` scope) cover both projects and must not be presented as individually verified `PROJECT_1` or `PROJECT_2` data
- Seeded `VERIFIED` facts are limited to information explicitly stated in the client brief:
  - 2 live projects in Ahmedabad
  - 420 apartments total
  - 2 BHK and 3 BHK configurations
  - Price range: ₹65 lakh to ₹1.2 crore
- Any missing project-specific detail, unlisted amenity, or price negotiation request triggers `handoffToExecutive()` immediately

---

## 9. Lead Ingestion & Attribution Engine (`LeadService`)

### Architecture & Service Design
`LeadService` (`src/services/lead/lead.service.ts`) governs lead intake, deduplication, first-touch attribution, and DPDP digital consent. It adopts constructor dependency injection (`constructor(private db: PrismaClient = defaultPrisma)`), enabling test harnesses to inject isolated test clients (`testPrisma`) targeting ephemeral Neon database branches without mutating the production application singleton.

### Ingestion Flow & Guarantees
1. **Input Validation & Strict Normalization:**
   - Phone numbers are validated using a strict regex allow-list (`/^\+?[\d\s\-()]+$/`) and normalized to E.164 (e.g. `98765 43210` -> `+919876543210`). Alphabetic characters or misplaced `+` signs are rejected with informative errors.
   - Email addresses are trimmed and converted to lowercase.
   - Lead codes are generated using the pattern `LD-[A-Z0-9]{5}-[A-Z0-9]{8}` (`LD-` + base-36 timestamp + 8-char random hex from `crypto.randomUUID()`).
2. **First-Touch Attribution Immutability:**
   - When an incoming phone matches an existing active lead (`deletedAt: null`), the original `Lead.source` is **never updated**.
   - The new interaction channel is appended to `LeadSourceEvent` with the campaign identifier and timestamp, preserving multi-touch attribution history.
3. **Non-Destructive Conditional Field Enrichment:**
   - When an existing lead submits additional profile fields (email, configuration preference, project interest), updates are executed conditionally via PostgreSQL atomic queries:
     ```typescript
     await tx.lead.updateMany({
       where: { id: existing.id, email: null, deletedAt: null },
       data: { email },
     });
     ```
   - This prevents lost updates or clobbering existing non-null data under concurrent ingestion.
4. **PostgreSQL Concurrency & Error Discrimination:**
   - **Phone Uniqueness Race (P2002):** If two concurrent requests attempt to insert the same new phone number simultaneously, PostgreSQL raises unique violation `23505` (`P2002`). Because PostgreSQL transaction semantics transition the interactive transaction block into an `ABORTED` state, the error is caught **outside** the dead transaction. The winning committed lead is queried via `this.db.lead.findFirst`, and a fresh transaction is opened to merge and append the audit event.
   - **Lead Code Collision (P2002):** Uniqueness collisions on `lead_code` are caught independently and trigger a bounded retry loop (up to 3 attempts) generating a fresh code.
   - **WAN Latency Resilience:** Interactive transactions configure `{ maxWait: 10000, timeout: 15000 }` to avoid premature connection pool acquisition timeouts (`P2028`) over remote cloud network connections.
5. **DPDP Act 2023 Digital Consent & Opt-Out Invariance:**
   - Digital consent requires explicit affirmation (`affirmed: true`).
   - Consent records are created using atomic `upsert` with `update: {}`:
     ```typescript
     await tx.consentRecord.upsert({
       where: { leadId: existing.id },
       create: { leadId: existing.id, consentText, consentedAt: new Date(), optedOut: false },
       update: {},
     });
     ```
   - Using PostgreSQL `ON CONFLICT ("lead_id")` prevents transaction abort errors. Crucially, `update: {}` leaves existing records untouched: if a buyer has previously exercised their DPDP right to opt out (`optedOut: true`), routine re-ingestion **never silently re-opts them in**.

### Explicit Design Limitations & Assumptions Register Alignment
- **Append-Only Event Ledger (Webhook Idempotency Limitation):** `LeadSourceEvent` does not currently enforce a composite unique constraint or store an external provider event ID (e.g. `webhookEventId`). Repeated webhook retries from the same ad campaign will append multiple audit rows. This is an explicit MVP design decision to prevent data loss in webhook ingestion pipelines pending formal dead-letter queue and external delivery ID specifications in Milestone 6/7.

---

## 10. Booking Lifecycle & Concurrency Control

```
VisitSlot.status:   AVAILABLE ──► BOOKED ──► AVAILABLE (on cancellation)

SiteVisit.status:   CONFIRMED ──► CANCELLED
                    CONFIRMED ──► ATTENDED
                    CONFIRMED ──► NO_SHOW
```

### Service Implementation & Atomic Booking Transaction
`BookingService` (`src/services/booking/booking.service.ts`) and validation schemas (`src/lib/validations/booking.ts`) implement the core appointment lifecycle without schema changes or external packages.

#### 1. Atomic Booking (`bookVisit`)
- Validates active lead status (`deletedAt: null`).
- Executes atomic conditional reservation:
  ```typescript
  const updateResult = await tx.visitSlot.updateMany({
    where: {
      id: slotId,
      status: VisitSlotStatus.AVAILABLE,
      startsAt: { gt: now },
    },
    data: { status: VisitSlotStatus.BOOKED },
  });
  if (updateResult.count !== 1) throw new SlotUnavailableError("Slot is no longer available for booking");
  ```
- Creates `SiteVisit` with `bookingStatus = CONFIRMED` and `attendanceOutcome = UNRECORDED`.
- Stages 24h (`REMINDER_24H`) and 2h (`REMINDER_2H`) `ReminderJob` records relative to `startsAt`, strictly excluding past times (`scheduledFor > now`).
- Partial unique index `one_active_booking_per_slot` (`WHERE booking_status = 'CONFIRMED'`) acts as a second line of defence against concurrent insertions.

#### 2. Atomic Cancellation (`cancelBooking`)
- Validates that visit is currently `CONFIRMED`.
- Updates `SiteVisit` to `bookingStatus = CANCELLED` and sets `cancelledAt = now`, preserving the historical row for attribution audits.
- Releases `VisitSlot` back to `AVAILABLE` only if `startsAt > now` (past slots remain `BOOKED`).
- Deletes only `PENDING` reminder jobs for the visit, preventing unwanted dispatches without misusing `FAILED`.

#### 3. Attendance Recording (`recordAttendance`)
- Supports visits with `(CONFIRMED + UNRECORDED)` (only after `startsAt <= now`) and `(COMPLETED + UNRECORDED)` (historical records).
- Rejects `CANCELLED` visits or visits where attendance was already recorded.
- Transitions `bookingStatus` to `COMPLETED`.
- Sets `attendedAt` to `now` for `ATTENDED`; keeps it `null` for `NO_SHOW`.
- Does not modify `VisitSlot` status.

#### 4. Concurrency & Integration Tests
Covered in `tests/integration/booking-service.test.ts` (5 scenarios against isolated Neon branch):
1. Successful booking, slot reservation, and reminder staging.
2. Concurrent booking requests via `Promise.all` (1 succeeds, 1 gets `SlotUnavailableError`).
3. Cancellation, future slot release, and deletion of pending reminder jobs.
4. Rebooking a released slot with a second lead while preserving historical cancelled visit.
5. Past-slot rejection and attendance recording for both confirmed visits and historical completed visits.
- Independent Code Review: **APPROVED** (with low-severity observation that P2002 handling could more precisely inspect the constraint target).

---

## 11. Scheduled Reminder Processing

| Field | Value |
|---|---|
| Provider | Inngest (hosted cron `*/5 * * * *` and on-demand `enquivo/reminders.process`) |
| Endpoint | Next.js App Router handler `src/app/api/inngest/route.ts` via `serve({ client, functions })` |
| Reminder types | `REMINDER_24H`, `REMINDER_2H` |
| States | `PENDING → PROCESSING → SENT / FAILED` |
| Delivery Semantics | **At-least-once delivery with atomic conditional claiming** to prevent concurrent execution races. Crash-after-dispatch boundary condition documented below |
| Concurrency Defense | Atomic conditional claim: `UPDATE reminder_jobs SET status = 'PROCESSING', attempts = attempts + 1, last_attempt_at = NOW() WHERE id = $1 AND status = 'PENDING'` |
| Stale Lock Recovery | Pre-sweep reclamation: any job in `PROCESSING` with `lastAttemptAt <= NOW() - 10 minutes` is reverted to `PENDING` (if attempts < 3) or transitioned to `FAILED` with worker-timeout reason (if attempts >= 3) |
| Idempotency key | `${visitId}:${reminderType}` (enforced by PostgreSQL unique index `reminder_jobs_idempotency_key_key`). Passed downstream to notification provider as delivery identifier |
| Bounded retry policy | `maxAttempts = 3` with **5-minute backoff** (`scheduledFor = NOW() + 5m`). Transient errors revert to `PENDING`; permanently transitions to `FAILED` only after attempts >= 3 are exhausted |
| Booking Integrity | Re-verifies `SiteVisit.bookingStatus === 'CONFIRMED'`. If cancelled, deletes orphaned job to prevent ghost retries without misusing `FAILED` |
| DPDP Act 2023 | Re-checks `lead.consentRecord`. If `optedOut === true` or missing, suppresses dispatch and purges unsendable jobs from operational queue (`SKIPPED_OPTED_OUT`, `SKIPPED_NO_CONSENT`), keeping `FAILED` reserved strictly for genuine delivery failures |
| Delivery Provider | `MockNotificationProvider`: formats appointment time in `Asia/Kolkata` (IST) via `date-fns-tz`, includes recipient name, venue, and `idempotencyKey`, logging audit simulation note without external SMS/WhatsApp network calls |
| Distributed Systems Limitation | **Crash-After-Dispatch Limitation:** If a serverless worker process dies after successfully dispatching a notification via carrier API but before committing `status = 'SENT'` to PostgreSQL, stale recovery will eventually reclaim the job and retry it, resulting in a duplicate dispatch. Downstream deduplication requires carrier-level idempotency support |
| Test Coverage | `tests/integration/reminder-service.test.ts` (8 scenarios against isolated Neon test branch): successful processing, cancelled visit suppression, bounded retries with 5m backoff, retry exhaustion to FAILED, atomic claiming under concurrency, DPDP opt-out suppression, missing consent suppression, stale PROCESSING reclamation (<3 attempts), and stale PROCESSING exhaustion (>=3 attempts) |

---

## 12. AI Concierge Design

### Languages
Supports EN (English), HI (Hindi), GU (Gujarati). Language detected from buyer preference at conversation start (`Conversation.language`). System instruction dynamically enforces corresponding language and script (Devanagari for Hindi, Gujarati script for Gujarati).

### Grounding & Governance
- **Database Query Filter:** Retrieves strictly `status: VERIFIED, isActive: true` FactSheet records. `DRAFT` or `UNVERIFIED` proposals (such as unapproved penthouses) are excluded at the SQL level.
- **Scope Segregation:** Portfolio facts apply across all projects. Project inquiries retrieve portfolio facts plus matching `projectId` facts, preventing cross-project information leakage.
- **Grounding Provenance:** Referenced fact IDs are persisted in `ChatMessage.groundingFactIds: string[]`.
- **Identity & Booking Security:** `leadId` is never accepted as an AI tool argument; it is derived strictly from the validated `conversation.leadId` server-side.
- **RERA Compliance Notice:** Mandatory display of compliance disclaimer: `"RERA Reg: DEMO-ONLY-NOT-VERIFIED"`. Never represented as an actual government-verified registration.
- **First Response Attribution:** `Lead.firstResponseAt` is atomically set upon the first successfully persisted AI message turn (`WHERE firstResponseAt IS NULL`), never overwriting an existing timestamp.
- **Fault-Tolerant Chat Ingestion:** Inbound buyer messages (`ChatMessage` role `USER`) are persisted prior to calling Gemini, guaranteeing zero message loss if downstream LLM generation fails.

### Handoff Triggers (Automatic Server-Side Escalation)
- Missing project-specific detail not in FactSheet
- Unlisted amenity inquiry (private pool, pet park, helipad)
- Price negotiation or discount request
- Buyer explicitly requests a human salesperson
- Three consecutive unclear queries
- **Salesperson Assignment:** Queries active `SALES_EXEC` records directly from PostgreSQL (`User.findFirst({ where: { role: 'SALES_EXEC' } })`) rather than hardcoding names.

### Tool Functions (Server-Side Zod Validated)
- `getVerifiedFacts({ scope?, projectId? })` — retrieves active `VERIFIED` FactSheet entries
- `checkSlotAvailability({ startDate?, endDate? })` — queries available slots via `BookingService`
- `bookVisitSlot({ slotId, confirmed })` — reserves slot via `BookingService` using server-derived `leadId` after explicit buyer confirmation
- `handoffToExecutive({ escalationReason, summary })` — creates persistent `Handoff` record, assigning an active `SALES_EXEC` from database

### Security & Architectural Observations (Milestones 4 & 5 Review)
- **Review Determination:** APPROVED.
- **Verified Facts Governance:** Dual-flag filtering (`status = 'VERIFIED' AND isActive = true`) combined with scope isolation (`(scope = 'PORTFOLIO' OR projectId = :projectId)`) guarantees that draft facts and cross-project data are excluded from model context.
- **Identity Authorization:** Derived strictly from the database conversation record (`conversation.leadId`) bound to a signed HTTP-only buyer session (`eq_buyer_session`). Client-supplied `leadId` and `conversationId` cannot override server-authorized session records (anti-tampering check).
- **Observation 1 Resolution (Booking Security Gate — Resolved in M5.2):** Direct autonomous AI tool booking is blocked by default (`allowDirectToolBooking = false`). Gemini tool calls to `bookVisitSlot` return an informative prompt directing the buyer to interactive slot confirmation or direct sales executive connection, ensuring no unconfirmed visits are booked via AI hallucinations.
- **Observation 2 Resolution (Session Binding — Resolved in M5.2):** Bearer capability tokens eliminated. Guest buyer sessions are authenticated via high-entropy HMAC-SHA256 signed HTTP-only cookies (`eq_buyer_session`, `SameSite=Lax`, `Path=/`, 24h duration) managed by `BuyerSessionService`.
- **Request-Level Idempotency:** Implemented via client-supplied `clientMessageId` and backed by PostgreSQL primary key unique constraint on `ChatMessage` (`chat_messages_pkey`). Eliminates duplicate user turns under concurrent submissions or network retries.
- **Direct Human Handoff Decoupling:** Added `POST /api/chat/handoff` and `AIConciergeService.createManualHandoff`, allowing buyers to escalate to an active PostgreSQL `SALES_EXEC` with 100% availability even during external AI provider outages.
- **Standardized CSRF Defense:** Enforces `verifySameOrigin` from `src/lib/security.ts` across all state-changing endpoints (`/api/chat`, `/api/chat/handoff`, `/api/chat/session`, `/api/chat/session/opt-out`).

---

## 13. Analytics & Metric Definitions

> [ASSUMPTION — Illustrative Demo Allocation] Source spend figures are for demonstration only.

### Exact Formulas

| Metric | Formula | Notes |
|---|---|---|
| First Response Time | `median(firstResponseAt - leadCreatedAt)` in minutes | Compare to 14h industry baseline |
| Visit Conversion Rate | `(attendedVisits / totalLeads) × 100` | % of leads who attended a visit |
| Show-Up Rate | `(attendedPastVisits / (attendedPastVisits + noShowPastVisits)) × 100` | Excludes future bookings AND cancelled bookings |
| Cost Per Visit | `sourceSpend / attendedVisits` | Per source channel |

### Illustrative Source Spend Seed (₹30 lakh/month total)

| Source | Monthly Spend (₹) |
|---|---|
| Property Portal | 12,00,000 |
| Social Media Ad | 8,00,000 |
| Website | 5,00,000 |
| Hoarding Call | 5,00,000 |
| **Total** | **30,00,000** |

---

## 14. Decision Log

| # | Date | Decision | Rationale | Alternatives Considered |
|---|---|---|---|---|
| D-001 | 2026-11-03 | Next.js 16 App Router only (no Pages Router) | App Router is the modern standard; typed `RouteContext`, Server Components, route groups for separate Buyer/Portal layouts | Pages Router still supported but no new features |
| D-002 | 2026-11-03 | Modular monolith, not microservices | Take-home scope; avoids Kubernetes/networking overhead; services are independently testable and extractable | Microservices would add operational complexity with no benefit here |
| D-003 | 2026-11-03 | Route groups `(buyer)`, `(portal)`, `(auth)` | Enables separate root layouts per user type without URL pollution | Single root layout with conditional rendering — rejected (harder to maintain) |
| D-004 | 2026-11-03 | Argon2id for password hashing | Memory-hard algorithm; industry recommendation over bcrypt; `@node-rs/argon2` has native bindings for Vercel/Node | bcrypt — rejected (lower resistance to GPU attacks) |
| D-005 | 2026-11-03 | Inngest for background jobs | Durable, Vercel-native, built-in retry/idempotency; no need for Redis/BullMQ | BullMQ/Redis — rejected (unnecessary infrastructure per architecture rules) |
| D-006 | 2026-11-03 | Partial unique index on `SiteVisit.slotId WHERE status = 'CONFIRMED'` | Prevents double-booking at the database level regardless of application logic | App-level lock — rejected (race condition risk under concurrent requests) |
| D-007 | 2026-11-03 | UTC storage, IST display via `date-fns-tz` | UTC in DB is universal best practice; IST conversion at display layer avoids timezone bugs | Storing IST — rejected (DST changes, international complications) |
| D-008 | 2026-11-03 | Gemini API key strictly server-side only | Security requirement; keys in `NEXT_PUBLIC_*` would be exposed in browser bundle | Client-side key — rejected (critical security risk) |
| D-009 | 2026-11-03 | Prisma 7.10.1 stable with `@prisma/adapter-pg` over Prisma 8 RC | Prisma 8 is an unstable RC (8.0.0-rc.29) with breaking package splits and experimental TypeScript migrations; Prisma 7.10.1 is battle-tested, supports Node 24, and provides native `previewFeatures = ["partialIndexes"]` | Prisma 8 RC — rejected due to production stability risk |
| D-010 | 2026-11-03 | `amountPaise BigInt` with safe DTO serialization | Monetary values are stored in integer paise using PostgreSQL `BIGINT` mapped to JavaScript native `bigint`. This avoids IEEE-754 binary floating-point representation drift (`Float`), where base-10 fractions cannot be represented exactly in binary floating-point arithmetic. While arbitrary-precision `Decimal` is mathematically exact, storing amounts as integer paise on native integer types (`BIGINT`) avoids third-party decimal-library object-wrapping and string-parsing overhead in the JavaScript runtime while keeping basic arithmetic native. Furthermore, while standard 32-bit PostgreSQL `INTEGER` (capped at ~₹2.14 crore in paise) would risk column capacity overflow on cumulative marketing budgets, 64-bit `BIGINT` comfortably accommodates up to ~9 x 10^18 paise (~₹90,000 trillion). Because ECMAScript specification prevents `JSON.stringify` from serializing native `bigint` primitives (throwing `TypeError: Do not know how to serialize a BigInt`), safe DTO serializers (`src/lib/serializers.ts`) convert BigInt paise to numbers or formatted currency strings at API boundaries | `Float` — rejected due to IEEE-754 binary floating-point rounding errors; `Decimal` — rejected not for inaccuracy (it is exact), but to avoid object-wrapping and decimal library overhead when integer paise natively provides exactness; PostgreSQL 32-bit `INTEGER` / Prisma `Int` — rejected due to 2^31-1 column capacity overflow on paise |
| D-011 | 2026-11-03 | `FactSheet` dual-flag (`status = VERIFIED AND isActive = true`) | AI Concierge grounding strictly filters for active, verified facts. Deactivating outdated facts without mutating approval history preserves governance records | Single status flag — rejected because soft-deactivation would require demoting to UNVERIFIED |
| D-012 | 2026-11-03 | Decoupling booking lifecycle (`BookingStatus`) from attendance outcome (`AttendanceOutcome`) | The assessment brief confirms Hardik Patel booked on Nov 1, 2026, but does not confirm attendance. Separating status preserves data fidelity without falsifying attendance records | Combined status — rejected because it conflates scheduling with physical presence |
| D-013 | 2026-11-03 | DPDP Soft-delete, nullable unique phone, and transcript PII redaction | `Lead.phone` is declared nullable (`String?`) with `@unique`. In PostgreSQL standard SQL semantics, multiple `NULL` values do not violate a unique constraint. While standard lead ingestion requires a phone via Zod, setting `phone = NULL` upon DPDP erasure prevents unique collision across multiple anonymized leads. Furthermore, conversation transcripts (`ChatMessage.content`) and handoff summaries (`Handoff.summary`) must be scrubbed of buyer PII (regex pattern matching on phones/emails); this operational redaction logic is scheduled for implementation in Milestone 3 (`LeadService`) and Milestone 4 (`AIConciergeService`). This privacy-aware design assumption balances DPDP erasure with statutory record-retention requirements | Cascading hard delete — rejected because it violates audit integrity and statutory record-keeping |
| D-014 | 2026-11-05 | Test database isolation via Neon copy-on-write branch & service dependency injection | Integration testing requires live PostgreSQL constraints, cascades, and partial indexes, but executing tests against the baseline development branch risks mutating seeded demo leads and audit logs. A dedicated Neon branch (`enquivo-test`, branch ID `br-nameless-waterfall-b3omykg9`, endpoint `ep-mute-butterfly-b3a54tpa`) provides copy-on-write isolation. A dedicated test client helper (`tests/helpers/testPrisma.ts`) validates `TEST_DATABASE_URL` with strict hostname allow-listing (rejecting `ep-frosty-tooth-b3446kf8` and asserting `ep-mute-butterfly-b3a54tpa`). Implemented in `LeadService` (`constructor(private db: PrismaClient = defaultPrisma)`) and approved for upcoming `BookingService` and `ReminderService`, service classes accept an optional database client via constructor dependency injection, allowing integration test suites to inject `testPrisma` without mutating `src/lib/prisma.ts` | Mocking Prisma in integration tests — rejected (fails to test actual PostgreSQL constraints, partial index race conditions, and transactions); Local Docker PostgreSQL — rejected (differs from remote Neon driver adapter and adds setup friction); Running against baseline branch — rejected (destroys seed data fidelity) |
| D-015 | 2026-11-05 | Atomic conditional enrichment, PostgreSQL ON CONFLICT upsert for consent, and out-of-transaction P2002 recovery for lead ingestion | Concurrently ingesting leads introduces multiple race conditions: duplicate insertions for the same phone, clobbering existing profile fields during enrichment, and transaction aborts on consent creation. We resolved these by: (1) catching phone `P2002` outside aborted interactive transactions and merging against the winning committed lead in a fresh transaction; (2) using atomic conditional updates (`tx.lead.updateMany where email is null`) to prevent lost updates; (3) handling `ConsentRecord` via atomic `upsert` with `update: {}` so PostgreSQL executes `ON CONFLICT ("lead_id") DO NOTHING / no-op UPDATE`, avoiding transaction-aborting constraint errors while strictly preserving existing opt-out status (`optedOut: true`); and (4) hardening interactive transactions with `{ maxWait: 10000, timeout: 15000 }` to withstand remote WAN connection pool acquisition latencies | In-memory read-modify-write — rejected (lost updates under concurrency); Catching P2002 inside transaction for consent — rejected (aborts PostgreSQL transaction block); Automatic re-opt-in on re-ingestion — rejected (violates DPDP Act 2023 consent withdrawal) |
| D-016 | 2026-11-05 | Atomic conditional slot reservation, relative reminder staging, and safe cancellation in BookingService | Managing appointments requires strict concurrency and temporal guards: (1) `bookVisit` executes an atomic conditional update (`UPDATE visit_slots SET status = 'BOOKED' WHERE id = $1 AND status = 'AVAILABLE' AND starts_at > NOW()`), throwing `SlotUnavailableError` if count !== 1; (2) PostgreSQL's partial unique index `one_active_booking_per_slot` (`WHERE booking_status = 'CONFIRMED'`) serves as an immutable database-level fallback; (3) pre-visit reminders (24h and 2h) are scheduled relative to `startsAt`, omitting past execution times; (4) `cancelBooking` preserves the historical `SiteVisit` row, releases the slot only if `startsAt > NOW()`, and deletes only `PENDING` reminder jobs to prevent erroneous delivery without misusing `FAILED`; (5) `recordAttendance` transitions `bookingStatus` to `COMPLETED`, records `attendedAt` only for `ATTENDED`, and supports both `CONFIRMED + UNRECORDED` (post-start) and `COMPLETED + UNRECORDED` visits without modifying slot status. Independent code review determination: APPROVED (noting a low-severity observation that P2002 handling could more precisely inspect the constraint target) | Application-level lock — rejected (race conditions under concurrency); In-transaction try-catch without conditional update — rejected (aborts transaction block on conflict); Marking cancelled reminders as FAILED — rejected (pollutes delivery failure metrics); Deleting cancelled SiteVisit rows — rejected (destroys audit and marketing attribution history) |
| D-017 | 2026-11-05 | Inngest orchestration, atomic job claiming, stale recovery, and bounded retries for ReminderService | Pre-visit reminder dispatching requires high reliability without duplicate delivery across horizontal workers. We resolved this via: (1) Inngest Cloud cron (`*/5 * * * *`) and on-demand event trigger (`enquivo/reminders.process`) wired to Next.js route handler (`/api/inngest`); (2) atomic conditional claim (`UPDATE reminder_jobs SET status = 'PROCESSING', attempts = attempts + 1 WHERE id = $1 AND status = 'PENDING'`), guaranteeing at-least-once delivery with atomic claiming to prevent concurrent processing; (3) stale PROCESSING recovery reclaiming crashed jobs with `lastAttemptAt <= NOW() - 10m` to `PENDING` (if attempts < 3) or exhausting to `FAILED` (if attempts >= 3); (4) pre-dispatch re-verification of `SiteVisit.bookingStatus === 'CONFIRMED'`, deleting orphaned jobs upon cancellation rather than misusing `FAILED`; (5) pre-dispatch DPDP Act 2023 consent validation, suppressing dispatch and deleting unsendable jobs (`SKIPPED_OPTED_OUT`, `SKIPPED_NO_CONSENT`) to keep `FAILED` strictly reserved for delivery failure; (6) bounded retry state machine (`maxAttempts = 3`) with 5-minute backoff (`scheduledFor = NOW() + 5m`) before exhausting to `FAILED`; (7) constructor dependency injection (`ReminderService(db, notificationProvider)`) allowing mock notification provider injection without network calls; and (8) explicit recognition of the crash-after-dispatch boundary condition where worker death post-external send leads to duplicate delivery on recovery | Redis / RabbitMQ / BullMQ — rejected (unnecessary infrastructure dependencies per architecture rules); Non-atomic polling (`SELECT then UPDATE`) — rejected (race conditions under concurrent workers); Misusing `FAILED` for cancelled visits or DPDP opt-outs — rejected (pollutes delivery failure telemetry); Claiming "strictly exactly-once delivery" across external messaging boundaries — rejected (theoretically and practically impossible under worker crashes post-dispatch without carrier idempotency keys) |
| D-018 | 2026-11-05 | AI Concierge grounding, server-derived identity, multilingual prompting, and database salesperson assignment | Building a trustworthy real estate conversational assistant requires strict anti-hallucination guardrails and security: (1) dual-flag FactSheet retrieval (`status = 'VERIFIED' AND isActive = true`) with project/portfolio scoping, ensuring draft facts and facts from unrelated projects never enter model context; (2) server-side identity derivation where `leadId` is derived strictly from the validated `conversation.leadId` rather than accepted from Gemini tool arguments, preventing IDOR/identity spoofing; (3) reuse of `BookingService` for atomic slot checking and reservation after explicit buyer confirmation; (4) dynamic salesperson assignment querying active `SALES_EXEC` records from PostgreSQL rather than hardcoding employee names; (5) persistence of user messages prior to LLM calls to prevent message loss on model failure; (6) atomic `firstResponseAt` setting on first successful AI response (`WHERE firstResponseAt IS NULL`); and (7) constructor dependency injection (`AIConciergeService(db, bookingService, geminiClient)`) allowing automated integration tests to execute with deterministic mock Gemini clients without external API key dependencies. *Independent Security Review:* APPROVED on 2026-11-05, noting two observations carried to M5: LLM-evaluated confirmation requiring independent server-side buyer confirmation in M5, and bearer capability `conversationId` access requiring secure buyer-session binding before public exposure in M5 (with Auth.js/RBAC in M6). Live Gemini smoke testing remains pending API key configuration. | Client-side Gemini API calls — rejected (exposes API key and bypasses database governance); Accepting leadId or salesperson in tool arguments — rejected (critical security vulnerability / IDOR); Hardcoding employee names — rejected (fragile to org changes); System prompt only grounding without database filtering — rejected (model hallucination risk) |
| D-019 | 2026-11-06 | Next.js 16 Cache Components Compatibility (`export const instant = false`), Public Property Landing Page Architecture, and Secure Decoupling from Unauthenticated Endpoints | Next.js 16 with `cacheComponents: true` and `partialPrefetching = true` strictly forbids legacy route segment configs (`export const dynamic = "force-dynamic"` or `export const revalidate = 60`). Uncached runtime database queries on the landing page (`src/app/page.tsx`) require `export const instant = false` to explicitly authorize blocking server rendering while compiling as `ƒ /` dynamic without throwing prerender validation errors. Rendering verified project data directly from PostgreSQL ensures 100% data fidelity without client-side waterfalls. Crucially, the landing page completely decouples the public UI from `/api/chat`, maintaining the security boundary until signed buyer-session binding is implemented in Phase 2 | Client-side fetching via useEffect/SWR — rejected (causes layout shifts, waterfalls, and exposes database models); Legacy route segment configs `dynamic = "force-dynamic"` — rejected (prohibited by Next.js 16 build compiler); Wiring landing page directly to `/api/chat` without session binding — rejected (violates security boundaries established in M4 review) |
| D-020 | 2026-11-06 | Signed HMAC-SHA256 HTTP-only cookie buyer session architecture and DPDP consent binding (`BuyerSessionService`) | Resolves Milestone 4 bearer token observation. Buyer chat sessions are issued via cryptographically signed HTTP-only cookies (`eq_buyer_session`) with `SameSite=Lax`, `Path=/`, and 24h expiration. Enforces explicit DPDP Act 2023 digital consent before session issuance. Server derives `conversationId` and `leadId` from the verified session payload, rejecting client ID tampering and preventing IDOR across sessions. Opt-out endpoint (`POST /api/chat/session/opt-out`) updates `ConsentRecord.optedOut = true` and revokes active session | Bearer token in JSON payload — rejected (vulnerable to client tampering and session hijacking); Unencrypted localStorage tokens — rejected (vulnerable to XSS extraction); Requiring full password registration for guest buyers — rejected (adds severe drop-off friction for initial property discovery) |
| D-021 | 2026-11-06 | Request-level idempotency via client message IDs and PostgreSQL primary key constraint | Solves race conditions under concurrent identical requests and prevents duplicate user turns on retries. Clients supply a stable `clientMessageId`; `ChatMessage.create` uses this as the record primary key. PostgreSQL's primary key constraint (`chat_messages_pkey`) atomically deduplicates simultaneous submissions (`P2002`), while retries reuse the existing unreplied record. Intentional consecutive user turns generate fresh client IDs and insert cleanly | In-memory text matching — rejected (race conditions under concurrency); Global conversation locking — rejected (causes head-of-line blocking and deadlocks); Silent deletion of historical messages — rejected (destroys audit trail) |
| D-022 | 2026-11-06 | Decoupled direct human handoff endpoint for zero-LLM-dependency escalation (`POST /api/chat/handoff`) | Guarantees that buyers can connect with a sales executive even during upstream AI provider outages (503/429/timeouts). Queries an active `SALES_EXEC` from PostgreSQL, creates or reuses `Handoff`, persists a localized system confirmation message, and sets `firstResponseAt` without invoking Gemini | Routing human requests through Gemini prompt — rejected (fails when Gemini is down with 503 or quota limits); Client-side direct DB updates — rejected (violates modular monolith architecture and security rules) |
| D-023 | 2026-11-06 | Standardized cross-site request forgery (CSRF) & same-origin enforcement (`src/lib/security.ts`) | Centralizes browser security checks across all state-changing API endpoints (`/api/chat`, `/api/chat/handoff`, `/api/chat/session`, `/api/chat/session/opt-out`). Enforces `Sec-Fetch-Site: cross-site` rejection, `Origin` vs `Host`/`X-Forwarded-Host` validation, and fallback to `Referer` validation | Inline repetitive origin checks — rejected (inconsistent security coverage); Relying solely on SameSite cookies — rejected (defense-in-depth requires explicit server-side origin verification) |
| D-024 | 2026-11-06 | Gemini 3.8 Flash transition, SDK bounded backoff with jitter, and sanitized error telemetry | Upgraded deprecated model identifier to stable `gemini-3.8-flash`. Configured native `@google/genai` HTTP-level exponential backoff (`attempts: 3`, initial delay 1.0s, max delay 4.0s, jitter 0.5 on 429/503/504) to avoid nested retry loops. Classifies errors via `classifyGeminiError` and returns sanitized, friendly messages to the client with working retry actions, never exposing raw JSON, stack traces, or API keys | Nested retry loops inside service code — rejected (causes exponential retry storms); Exposing raw Gemini error responses — rejected (risks leaking internal paths and credentials); Suppressing errors without retry UI — rejected (poor buyer experience) |
| D-025 | 2026-11-07 | Argon2id Staff Authentication and PostgreSQL Live Role Revalidation (`StaffAuthService`, `src/lib/auth-guard.ts`) | Implements production-grade credential security without shared passwords or placeholder hashes. Staff credentials are verified via Argon2id (`@node-rs/argon2`). Issued session tokens are signed HMAC-SHA256 strings stored in HTTP-only cookies (`eq_staff_session`, 12h duration, SameSite=Lax, Secure in production). Crucially, during every protected staff request or navigation, the server guard (`requireStaffSession` / `requireStaffRole`) revalidates the user account against live PostgreSQL (`prisma.user.findUnique`), ensuring deactivated users, deleted accounts, or demoted roles (`BUYER`) are rejected immediately, eliminating stale-token privilege escalation | Client-side-only role checks — rejected (vulnerable to IDOR and cookie forgery); Shared demo passwords — rejected (insecure and violates auditability); Relying on token payload role without DB lookup — rejected (demoted/terminated users retain access until token expiry) |
| D-026 | 2026-11-07 | Brute-Force Login Throttling and Same-Origin CSRF Defense on Staff Authentication Endpoints (`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`) | Prevents credential stuffing by tracking failed login attempts per client IP and email. Exceeding 5 failed attempts within 15 minutes triggers a 429 Too Many Requests response with `Retry-After` header. State-changing auth endpoints enforce `verifySameOrigin` CSRF protection | Unbounded login attempts — rejected (vulnerable to brute-force credential stuffing); Permanent account lockout — rejected (enables denial-of-service on legitimate staff accounts) |
| D-027 | 2026-11-07 | Persistent Serverless Staff Session Revocation via PostgreSQL `StaffSession` Records & Two-Layer Token Architecture | In serverless hosting (Vercel), in-memory session revocation registries fail because separate serverless functions run in isolated memory spaces, and container cold starts purge in-memory maps. To guarantee immediate, global session revocation on logout while defending against database-only leaks, `StaffAuthService` generates a 32-byte random `rawToken`, computes its deterministic SHA-256 hash (`tokenHash`), and stores ONLY `tokenHash` in the PostgreSQL `staff_sessions` table. The client cookie (`eq_staff_session`) receives an HMAC-SHA256 signed envelope containing `rawToken`, completely concealing `tokenHash` from the browser. On every request, `verifySessionAndFetchUser` verifies the HMAC signature first, hashes `rawToken` on the fly, and verifies the session in PostgreSQL (`revokedAt IS NULL`, `expiresAt > NOW()`, live role match). This achieves instant, serverless revocation, tamper resistance, and database breach protection without requiring Redis | In-memory revocation Map — rejected (fails across multiple serverless lambda instances and cold restarts); Exposing tokenHash in client cookie — rejected (unnecessary exposure of database primary lookup key); Storing raw tokens in database — rejected (unnecessary security risk if database read replicas are inspected; SHA-256 tokenHash is one-way deterministic); External Redis cluster — rejected (violates architecture rule against adding unnecessary infrastructure) |
| D-028 | 2026-11-07 | Dynamic Relational Derivation of Lead Lifecycle Status & Role-Based Record-Level Access Control (`LeadService`, `src/lib/validations/lead.ts`, `ADR-008`) | The brief requires tracking lead lifecycle stages (`NEW`, `ENGAGED`, `ESCALATED`, `BOOKED`, `VISITED`) and enforcing strict data isolation between staff roles (`SALES_HEAD` vs `SALES_EXEC`). Rather than mutating the schema or introducing a fragile desynchronized status column, `computeLeadLifecycleStatus()` evaluates status dynamically from authoritative relational events (`VISITED` > `BOOKED` > `ESCALATED` > `ENGAGED` > `NEW`). Database queries map these lifecycle states to native Prisma relational queries (`siteVisits.some`, `conversations.some`), allowing PostgreSQL to handle `COUNT`, `SKIP`, and `TAKE` pagination directly. Data isolation is strictly enforced on the server via role-based record-level access control: `SALES_HEAD` queries all active leads (`where: { deletedAt: null }`), while `SALES_EXEC` queries are scoped to leads assigned to that specific executive via conversation handoffs (`where: { deletedAt: null, conversations: { some: { handoff: { assignedToId: user.id } } } }`). Detail retrieval (`getLeadDetail`) applies the same scope and returns `null` (HTTP 404) for unauthorized leads to eliminate IDOR enumeration | Schema mutation (adding mutable `status` and `assignedToId` to `Lead`) — rejected (violates schema lock, risks dual-source-of-truth desynchronization bugs); Client-side filtering — rejected (leaks confidential buyer data over the wire and introduces IDOR vulnerability) |
| D-029 | 2026-11-08 | Handoff Queue, Role-Scoped Ownership, In-Conversation System Audit Trails, and Boundary Isolation (`HandoffService`, `src/lib/chat-message.ts`, `ADR-009`) | Managing AI and buyer escalations requires role-scoped queues and ownership controls without schema alterations. `getStaffHandoffScope` enforces `{}` for `SALES_HEAD` and `{ assignedToId: user.id }` for `SALES_EXEC`, with anti-IDOR detail lookup returning `null` (404) for unauthorized records. `assignHandoff` executes inside `prisma.$transaction` under serialized Last-Write-Wins (LWW) concurrency, asserting `SALES_HEAD` authorization and valid `SALES_EXEC` target role (the schema intentionally has no independent `isActive` flag; staff suspension is governed by role demotion to `BUYER` or user deletion), updating `assignedToId` and appending an internal audit entry (`ChatMessageRole.AI` with `[Ownership Assigned]` or `[Ownership Reassigned]`) to preserve accountability. Strict boundary isolation (`filterBuyerFacingMessages`, `isInternalAuditMessage`) ensures internal audit messages are visible only to staff in `TranscriptModal` and `/dashboard/leads/[id]`, while being completely stripped from buyer APIs (`/api/chat/session`), buyer UI, and Gemini prompt context. Because `LeadService.getStaffLeadScope()` derives lead ownership via `conversations.some.handoff.assignedToId`, assigning an escalation immediately updates lead visibility across `/dashboard/leads` without separate database updates | Schema mutation (adding `HandoffAssignmentHistory` table) — rejected (violates schema lock protocol); Client-side filtering — rejected (vulnerable to IDOR data leaks) |
| D-030 | 2026-11-08 | Database Seed Safety Guard, Exact Development Endpoint Allowlist, and Destructive Baseline Reset Invariants (`src/lib/seed-guard.ts`) | The seed protocol performs a table-wide destructive wipe across all 14 schema models before inserting the Day-0 baseline dataset. To prevent catastrophic data loss in production, accidental wiping of the isolated test branch, or loss of evaluator test records: (1) `validateSeedTarget` enforces that seeding is strictly blocked in production (`NODE_ENV === "production"`); (2) requires explicit authorization flag `ALLOW_DESTRUCTIVE_SEED === "true"`; (3) enforces an exact hostname allowlist (`APPROVED_SEED_ENDPOINTS`) matching only the approved Neon development endpoint (`ep-frosty-tooth-b3446kf8`, direct and pooled variants), failing closed on test database (`ep-mute-butterfly-b3a54tpa`), localhost, or unknown endpoints; and (4) runs before Prisma client initialization or database connection without logging credentials. Crucially, documentation establishes that deterministic seeding is destructive by design and must never be executed after evaluator testing begins unless a full Day-0 reset is deliberately intended | Blacklist-only filtering — rejected (fails closed on unknown hosts); Allowing seed without flag — rejected (accidental wipe risk); Allowing seed against test branch — rejected (pollutes integration test state) |

---

## 15. Assumptions Register

| ID | Assumption | Label | Impact if Wrong |
|---|---|---|---|
| A-001 | RERA registration numbers are placeholders (`DEMO-ONLY-NOT-VERIFIED`) | `[ASSUMPTION]` | Must be replaced with real RERA numbers before production launch |
| A-002 | Today's reference date is November 3, 2026 | `[ASSUMPTION]` | Hardik Patel's historical booking logic changes; seed date offsets change |
| A-003 | Hardik Patel's `2026-11-01 11:00` booking is in the past — no future reminders | `[ASSUMPTION]` | If reference date changes, seed logic must be re-evaluated |
| A-004 | Source spend of ₹30 lakh/month is illustrative only | `[ASSUMPTION — Illustrative Demo Allocation]` | Actual spend figures must be provided by client for real analytics |
| A-005 | The 420 apartments and price range (₹65L–₹1.2Cr) are taken directly from the client brief verbatim | `[ASSUMPTION]` | If figures are incorrect, FactSheet seed must be updated |
| A-006 | `SALES_HEAD` role is introduced to govern Fact Sheet editor and daily flagged-chat review (not in original scope) | `[ASSUMPTION]` | Role design may need adjustment based on actual org structure |
| A-007 | "Website" as a lead source channel exists alongside the 3 briefed channels | `[ASSUMPTION]` | Drop if client confirms only 3 channels (portal, social, hoarding) |
| A-008 | Historical reminders seeded as SENT represent simulated test data | `[ASSUMPTION — Simulated Historical Demonstration Record]` | Must not be presented as carrier delivery receipts |
| A-009 | Project names "Prakriti Heights" and "Vaastu Enclave" are illustrative demo titles for Project 1 and Project 2 | `[ASSUMPTION]` | Can be updated to official client brand names |
| A-010 | Soft-deletion with nullable unique phone (`Lead.phone = NULL`) and chat transcript/handoff PII redaction is a privacy-aware design assumption balancing DPDP compliance with statutory audit retention. Service-level redaction logic is scheduled for implementation in M3/M4 | `[ASSUMPTION — Privacy & Data Retention Design]` | Specific corporate legal counsel policies may mandate different retention periods or irreversible scrubbing schedules |

---

## 16. Milestone Completion Tracker

| Milestone | Description | Status | Commit |
|---|---|---|---|
| M1 | Project Scaffold, Folder Structure, `.env.example`, `docs/TDD_DRAFT.md`, `deployment.md` | ✅ Complete | `1a57d2d` |
| M2 | Prisma Schema (13 models + partial unique index), Neon Migration & Guarded Seed | ✅ Complete | `2e3bd3c` |
| M3 | Core Backend Services (LeadService, BookingService, ReminderService) & Integration Tests | ✅ Complete | `cdb8f14` |
| M4 | AIConciergeService (EN/HI/GU, VERIFIED-only facts, Zod tool calling, handoff) | ✅ Complete | `1e9831e` (local) |
| M5 | Buyer Concierge Experience (Landing Page + Secure Mobile Concierge UI & Functional AI) | ✅ Complete | `27d0d8d` |
| M6 Phase 1 | Staff Authentication & Operations Portal Shell (Argon2id, DB role revalidation, login throttling, CSRF, layout) | ✅ Complete | `bf7e04b` |
| M6 Phase 2 | Lead Pipeline & Ingestion Interface | ✅ Complete | `ecf0655` |
| M6 Phase 3 | Salesperson Assignment & Handoff Management Queue | ✅ Complete | Pending commit |
| M6 Phase 4 | Site Visits, Attendance Management & Fact Sheet Administration | ⬜ Next | — |
| M6 Phase 5 | Source Analytics, E2E QA, and Integration Review | ⬜ Pending | — |
| M7 | Source Attribution & ROI Dashboard + Complete Vitest Suite | ⬜ Pending | — |
| M8 | Final Submission Packaging (TDD.pdf + deployment.md zip, <25MB, zero secrets) | ⬜ Pending | — |

