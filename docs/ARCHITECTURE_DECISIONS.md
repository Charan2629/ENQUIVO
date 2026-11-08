# ENQUIVO — Architecture Decision Records (ADRs)

This document contains concise, evidence-based Architecture Decision Records (ADRs) for the core systems of the ENQUIVO platform. Each record details the context, evaluated alternatives, decision rationale, trade-offs, consequences, and code/test verification evidence.

---

## Index of Architecture Decision Records

1. [ADR-001: Modular Monolith Architecture & Technology Stack](#adr-001-modular-monolith-architecture--technology-stack)
2. [ADR-002: Atomic Site-Visit Booking & Concurrency Defense](#adr-002-atomic-site-visit-booking--concurrency-defense)
3. [ADR-003: Scheduled Reminder Processing, Idempotency, Retries & Stale Recovery](#adr-003-scheduled-reminder-processing-idempotency-retries--stale-recovery)
4. [ADR-004: Anti-Hallucination AI Fact Grounding & Decoupled Offline Human Fallback](#adr-004-anti-hallucination-ai-fact-grounding--decoupled-offline-human-fallback)
5. [ADR-005: Cryptographic Buyer Sessions, Deduplication & DPDP Consent Binding](#adr-005-cryptographic-buyer-sessions-deduplication--dpdp-consent-binding)
6. [ADR-006: Staff Authentication, Argon2id Passwords, RBAC & Live Role Revalidation](#adr-006-staff-authentication-argon2id-passwords-rbac--live-role-revalidation)
7. [ADR-007: PostgreSQL-Backed Persistent Staff Session Revocation (Superseding In-Memory Map)](#adr-007-postgresql-backed-persistent-staff-session-revocation-superseding-in-memory-map)
8. [ADR-008: Dynamic Relational Derivation of Lead Lifecycle Status & Role-Based Record-Level Access Control](#adr-008-dynamic-relational-derivation-of-lead-lifecycle-status--role-based-record-level-access-control)
9. [ADR-009: Handoff Queue, Role-Scoped Ownership, and In-Conversation System Audit Trails](#adr-009-handoff-queue-role-scoped-ownership-and-in-conversation-system-audit-trails)

---

## ADR-001: Modular Monolith Architecture & Technology Stack

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Principal Engineering Mentor & Implementation Partner

### Context
ENQUIVO serves a residential real estate developer in Ahmedabad managing 2 live projects (420 apartments, ₹65L–₹1.2Cr). The platform needs to ingest leads across multiple channels, run an AI concierge in 3 languages (EN/HI/GU), schedule appointments with reminders, and provide staff dashboards. We needed to choose an architectural paradigm and foundational tech stack that maximizes developer velocity and operational reliability while preventing unnecessary distributed-systems overhead.

### Alternatives Considered
1. **Microservices Architecture:** Splitting lead ingestion, AI chat, booking, and analytics into independent services (Node.js/Go/Python). *Rejected:* Introduces distributed transactions, network latency, multi-repo CI/CD friction, and high operational overhead with zero business justification for a 420-unit development.
2. **Next.js Pages Router / Express + SPA:** Traditional decoupled frontend/backend. *Rejected:* Loses Next.js 16 Server Components, unified TypeScript types across API boundaries, and co-located route handlers.
3. **Prisma 8 Release Candidate:** *Rejected:* Prisma 8 (8.0.0-rc.29) had breaking package splits and experimental migrations; Prisma 7.10.1 stable with `@prisma/adapter-pg` offers rock-solid Node 24 support and native partial indexes.

### Decision
Build a **modular monolith** on **Next.js 16.4.4 App Router** with TypeScript (strict), Tailwind CSS v4, Prisma 7.10.1 ORM targeting hosted **Neon PostgreSQL**, and Vitest for testing. Encapsulate all business logic inside independent TypeScript service modules (`src/services/{lead,booking,reminder,ai,auth}`) using constructor dependency injection (`constructor(private db: PrismaClient = defaultPrisma)`).

### Trade-offs & Consequences
- **Positive:** Single repository, zero distributed network latency between modules, shared Zod validation schemas, unified deployment on Vercel, and easy end-to-end integration testing.
- **Negative:** Service boundaries are enforced by discipline and TypeScript imports rather than hard network boundaries. Unchecked cross-service imports could degrade modularity if not strictly reviewed.

### Code & Test Evidence
- **Services:** `src/services/lead/lead.service.ts`, `src/services/booking/booking.service.ts`, `src/services/reminder/reminder.service.ts`, `src/services/ai/ai.service.ts`, `src/services/auth/staff-auth.service.ts`.
- **Database Client Adapter:** `src/lib/prisma.ts`.
- **Tests:** 80 unit tests (`npm test`) and 52 integration tests (`npm run test:integration`).

---

## ADR-002: Atomic Site-Visit Booking & Concurrency Defense

- **Status:** Accepted
- **Date:** 2026-11-03 (Schema/Index), 2026-11-05 (Service)
- **Deciders:** Principal Engineering Mentor & Implementation Partner

### Context
When multiple buyers concurrently attempt to book the same physical visit slot (`VisitSlot`), naive application-level checks (`if (slot.status === 'AVAILABLE') book()`) suffer from Time-of-Check to Time-of-Use (TOCTOU) race conditions, resulting in catastrophic double-bookings. Furthermore, when a buyer cancels, historical booking records must be retained for attribution while releasing future slots.

### Alternatives Considered
1. **Application-Level Locks / Mutexes:** Memory locks in the Node.js process. *Rejected:* Does not work across serverless lambdas or multiple horizontally scaled web instances.
2. **Distributed Redis Locks (`Redlock`):** *Rejected:* Violates architecture constraint forbidding external cache infrastructure (no Redis).
3. **Database Row Locks (`SELECT FOR UPDATE`):** Can cause lock contention, deadlocks, and slow connection pool exhaustion under high traffic.

### Decision
Implement a **two-tier defense-in-depth concurrency model**:
1. **Application-Level Atomic Conditional Update:** Inside `prisma.$transaction`, execute `tx.visitSlot.updateMany({ where: { id: slotId, status: 'AVAILABLE', startsAt: { gt: new Date() } }, data: { status: 'BOOKED' } })`. If `count !== 1`, abort immediately with `SlotUnavailableError`.
2. **Database-Level Partial Unique Index:** Create PostgreSQL partial unique index `one_active_booking_per_slot` on `SiteVisit(slotId)` filtered by `WHERE (booking_status = 'CONFIRMED')`. If any race condition ever bypassed application logic, the database engine enforces single-booking exclusivity at the storage layer (`P2002`).

When a booking is cancelled, `SiteVisit.bookingStatus` transitions to `CANCELLED` (retaining attribution and audit history), and `VisitSlot.status` is released back to `AVAILABLE` only if `startsAt > NOW()`.

### Trade-offs & Consequences
- **Positive:** Zero double-bookings possible even under high concurrency. Cancelled visits retain their historical records while releasing future slots.
- **Negative:** Requires PostgreSQL engine support for partial indexes (supported natively by PostgreSQL and Prisma 7 via `previewFeatures = ["partialIndexes"]`).

### Code & Test Evidence
- **DDL:** Migration `20261103165535_init` generating `CREATE UNIQUE INDEX "one_active_booking_per_slot" ON "site_visits"("slot_id") WHERE (booking_status = 'CONFIRMED'::"BookingStatus");`.
- **Service Implementation:** `src/services/booking/booking.service.ts` (`bookVisit`, `cancelBooking`).
- **Tests:** `tests/integration/booking-service.test.ts` (Scenario 2: simultaneous `Promise.all` bookings where exactly 1 succeeds and 1 receives `SlotUnavailableError`; Scenario 4: rebooking a slot after cancellation).

---

## ADR-003: Scheduled Reminder Processing, Idempotency, Retries & Stale Recovery

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Principal Engineering Mentor & Implementation Partner

### Context
Site-visit leakage is severe when buyers forget appointments. The client brief mandates 24-hour and 2-hour pre-visit notifications. In serverless environments, background workers can crash, scale horizontally, or suffer network dropouts during messaging API calls. We needed a resilient background job engine with strict idempotency and bounded retries.

### Alternatives Considered
1. **BullMQ / Celery with Redis:** *Rejected:* Requires dedicated Redis cluster; violates architecture rules.
2. **Node.js `cron` / `node-schedule`:** *Rejected:* In-memory timers die when serverless functions terminate.
3. **Vercel Cron Only:** Can invoke HTTP endpoints, but lacks native retries, state machine management, and fine-grained scheduling.

### Decision
Adopt **Inngest Cloud** with a persistent **`ReminderJob` state machine** in PostgreSQL:
1. When a booking is confirmed, stage two `ReminderJob` records with deterministic `idempotencyKey = ${siteVisitId}:${reminderType}`.
2. An Inngest cron (`*/5 * * * *`) and on-demand events call `/api/inngest`, delegating to `ReminderService.processDueReminders()`.
3. **Atomic Claiming:** Workers claim pending jobs using `UPDATE reminder_jobs SET status = 'PROCESSING', attempts = attempts + 1 WHERE id = $1 AND status = 'PENDING'`. Only the worker with `count === 1` proceeds.
4. **Stale Recovery:** Jobs stuck in `PROCESSING` for >10 minutes are reclaimed to `PENDING` (if `attempts < 3`) or exhausted to `FAILED` (if `attempts >= 3`).
5. **Pre-Dispatch Checks:** Before dispatching, re-verify that `SiteVisit.bookingStatus === 'CONFIRMED'` and that the lead has not opted out under DPDP Act 2023. If cancelled or opted out, delete the reminder rather than polluting failure metrics.
6. **Bounded Exponential Backoff:** Transient provider errors retry up to 3 attempts with 5-minute backoff before permanently marking `FAILED`.

### Trade-offs & Consequences
- **Positive:** Zero duplicate reminder deliveries under concurrent workers; resilient to worker crashes; non-intrusive compliance checks; clean separation of failure telemetry.
- **Negative:** In external messaging networks, if a worker dies *after* the mock SMS/WhatsApp API call returns but *before* writing `status = 'SENT'` to PostgreSQL, recovery will resend the notification. This is the classic two-generals network boundary.

### Code & Test Evidence
- **Service Implementation:** `src/services/reminder/reminder.service.ts`.
- **Inngest Endpoint:** `src/app/api/inngest/route.ts` & `src/lib/inngest/client.ts`.
- **Tests:** `tests/integration/reminder-service.test.ts` (8 exhaustive scenarios including atomic claim, stale recovery, DPDP opt-out suppression, and bounded retry exhaustion).

---

## ADR-004: Anti-Hallucination AI Fact Grounding & Decoupled Offline Human Fallback

- **Status:** Accepted
- **Date:** 2026-11-05 (AI Grounding), 2026-11-06 (Direct Fallback)
- **Deciders:** Principal Engineering Mentor & Implementation Partner

### Context
Real estate conversational AI assistants often hallucinate unverified amenities, negotiate prices without authority, or fail when the upstream LLM provider suffers outages (e.g. Gemini 503 high-demand or rate limits). RERA regulations strictly prohibit misleading advertising.

### Alternatives Considered
1. **Unconstrained LLM Prompting with System Context:** *Rejected:* High hallucination risk; models blend portfolio-level facts with specific projects.
2. **Vector DB (RAG) Embeddings with Similarity Search:** *Rejected:* Vector search returns probabilistic chunks that can include unverified draft facts or outdated promotional materials.
3. **Routing Human Handoffs Through Gemini Prompting:** *Rejected:* If Gemini returns 503 UNAVAILABLE or quota exhausted, the buyer is trapped and cannot reach a sales executive.

### Decision
1. **Dual-Flag FactSheet Retrieval:** Only facts with `status = 'VERIFIED' AND isActive = true` are retrieved from PostgreSQL. Facts are strictly partitioned by `scope` (`PORTFOLIO`, `PROJECT_1`, `PROJECT_2`). Portfolio facts are never presented as individually verified project facts.
2. **Server-Side Identity Derivation:** Gemini tool calling for appointment checking/booking never accepts client-supplied `leadId`. The service resolves `leadId` strictly from the server-authorized `Conversation` record, preventing IDOR.
3. **Booking Security Gate:** Gemini tools can check slot availability and stage proposals, but cannot independently finalize a booking without explicit buyer confirmation.
4. **Decoupled Direct Human Handoff (`POST /api/chat/handoff`):** An independent route handler and service method (`createManualHandoff`) that assigns an active `SALES_EXEC` from PostgreSQL, persists the handoff record, and records a system confirmation message with **zero LLM dependency**. Even if Gemini is 100% offline, buyers can connect with human staff.
5. **Gemini SDK Native Backoff:** Configured `@google/genai` with HTTP-level backoff (`attempts: 3`, exponential backoff with jitter on 429/503/504) to avoid nested retry loops, paired with sanitized buyer-facing error messages.

### Trade-offs & Consequences
- **Positive:** 100% RERA compliance; zero unverified fact leakage; zero model hallucination on pricing/amenities; uninterrupted human escalation during provider outages.
- **Negative:** AI Concierge immediately halts and escalates when asked questions outside verified database facts, requiring active sales executive involvement.

### Code & Test Evidence
- **Service Implementation:** `src/services/ai/ai.service.ts` (`getVerifiedFacts`, `createManualHandoff`, `classifyGeminiError`).
- **Route Handler:** `src/app/api/chat/handoff/route.ts`.
- **Tests:** `tests/integration/ai-service.test.ts` (10 scenarios: verified facts filtering, dual-flag scoping, server-derived identity, zero-LLM handoff, and transient 503 retry classification).

---

## ADR-005: Cryptographic Buyer Sessions, Deduplication & DPDP Consent Binding

- **Status:** Accepted
- **Date:** 2026-11-06
- **Deciders:** Principal Engineering Mentor & Implementation Partner

### Context
Buyers enquiring via property portals or mobile ads need a low-friction entry point without full password registration. However, allowing arbitrary client-supplied `conversationId` or `leadId` in chat API calls creates critical IDOR vulnerabilities. Furthermore, India's DPDP Act 2023 mandates verifiable digital consent and immediate opt-out compliance.

### Alternatives Considered
1. **Full Password / OTP Registration:** *Rejected:* Extreme drop-off friction for casual prospective buyers on property portals.
2. **Unauthenticated LocalStorage Tokens:** *Rejected:* Accessible via XSS; vulnerable to client-side tampering.
3. **Bearer Token in Request JSON Body:** *Rejected:* Easily spoofed; allows cross-session tampering.

### Decision
Implement **`BuyerSessionService`** with signed HMAC-SHA256 HTTP-only cookies (`eq_buyer_session`):
1. **Explicit DPDP Consent:** Before session issuance, the buyer provides phone and name with explicit consent. `ConsentRecord` records timestamp, legal consent text, and `optedOut = false`.
2. **Non-Destructive Deduplication:** Ingesting an existing phone preserves first-touch attribution (`Lead.source`), appends a `LeadSourceEvent`, and reuses active conversations.
3. **Signed Session Cookie:** Issues an HTTP-only, `SameSite=Lax`, `Secure` (prod) cookie containing `{ conversationId, leadId, phone, issuedAt, expiresAt }` signed with server `SESSION_SECRET`.
4. **Server-Derived Identity:** All chat endpoints (`/api/chat`, `/api/chat/handoff`) derive `conversationId` and `leadId` exclusively from the verified cookie. Client-supplied IDs in the JSON body are completely ignored.
5. **Instant Opt-Out:** `POST /api/chat/session/opt-out` sets `ConsentRecord.optedOut = true`, records `optOutAt`, and revokes the active session.

### Trade-offs & Consequences
- **Positive:** Seamless mobile buyer experience; zero IDOR vulnerability; full DPDP Act 2023 statutory compliance; immutable first-touch attribution.
- **Negative:** Session is bound to the buyer's browser cookie. Clearing browser data requires re-authenticating with phone number.

### Code & Test Evidence
- **Service Implementation:** `src/services/buyer/buyer-session.service.ts`.
- **Routes:** `src/app/api/chat/session/route.ts`, `src/app/api/chat/session/opt-out/route.ts`.
- **Tests:** `tests/integration/buyer-session.test.ts` (9 scenarios including consent capture, duplicate lead merging, tamper rejection, and DPDP opt-out revocation).

---

## ADR-006: Staff Authentication, Argon2id Passwords, RBAC & Live Role Revalidation

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Principal Engineering Mentor & Implementation Partner

### Context
Staff operations handle buyer contact PII, negotiation summaries, and verified fact sheet governance. Using shared demo passwords, placeholder hashes, or client-side-only role toggles creates severe security vulnerabilities (privilege escalation, IDOR, credential stuffing).

### Alternatives Considered
1. **Bcrypt Password Hashing:** *Rejected:* Bcrypt has a fixed 4 KB memory footprint, rendering it vulnerable to modern GPU/ASIC parallel cracking clusters.
2. **Pure Stateless JWTs:** *Rejected:* If an executive is terminated or demoted from `SALES_HEAD` to `BUYER`, a stateless JWT remains valid until expiration (up to 12 hours) unless an external cache is maintained.
3. **Shared Demo Credentials:** *Rejected:* Violates auditability and allows credential reuse across environments.

### Decision
Implement **`StaffAuthService`** with Argon2id, signed HTTP-only cookies, and **live database revalidation**:
1. **Argon2id Hashing:** Password hashes generated via `@node-rs/argon2` (memory-hard, resistant to GPU attacks).
2. **Dedicated Evaluator Accounts:** Seed dedicated synthetic accounts (`sales-head@enquivo.in`, `vikram.mehta@enquivo.in`, `priya.desai@enquivo.in`) with unique strong passwords. Demo autofill buttons are strictly environment-gated (`NODE_ENV === 'development' || NEXT_PUBLIC_ENABLE_DEMO_LOGINS === 'true'`).
3. **Brute-Force Lockout:** Sliding-window throttling tracks failed login attempts by `IP:email`. 5 failed attempts within 15 minutes triggers an immediate HTTP 429 response with `Retry-After`.
4. **Live PostgreSQL Role Revalidation:** Every protected request (`requireStaffSession`, `requireStaffRole`) verifies the cryptographic HMAC signature, then queries PostgreSQL `staffSession.findUnique` with the `user` relation. If the account is deleted, disabled, or demoted in PostgreSQL, access is immediately revoked on the very next request.

### Trade-offs & Consequences
- **Positive:** Elimination of stale-token privilege escalation; robust brute-force defense; high-grade password storage; server-enforced RBAC.
- **Negative:** Every protected staff request incurs a single-digit millisecond PostgreSQL indexed query.

### Code & Test Evidence
- **Service Implementation:** `src/services/auth/staff-auth.service.ts`.
- **Server Guards:** `src/lib/auth-guard.ts` (`requireStaffSession`, `requireStaffRole`, `requireSalesHead`).
- **Tests:** `tests/unit/staff-auth.test.ts` (18 unit tests); `tests/integration/staff-auth.test.ts` (11 integration tests verifying live role demotion, account deletion, and brute-force throttling).

---

## ADR-007: PostgreSQL-Backed Persistent Staff Session Revocation (Superseding In-Memory Map)

- **Status:** Accepted (Supersedes In-Memory Revocation Map)
- **Date:** 2026-11-07
- **Deciders:** Principal Engineering Mentor & Implementation Partner

### Context & Historical Evolution
In the initial M6.1 implementation, server-side session revocation was tracked using a static in-memory map: `StaffAuthService.revokedTokens = new Map<string, number>()`.

During the M6.1 architectural review, this was identified as **unreliable for serverless production deployment**:
- In serverless hosting (e.g. Next.js App Router on Vercel), each incoming HTTP request can be routed to an independent lambda instance running in an isolated process memory space (`heap`).
- A logout executed on Lambda Instance A only recorded revocation in Instance A's memory. A subsequent replayed token hitting Lambda Instance B (or Instance A after a cold restart) found an empty map and accepted the revoked token.
- Application restarts, worker recycling, and horizontal scaling immediately purged the revocation registry.

### Alternatives Considered
1. **In-Memory `Map`:** *Rejected & Superseded:* Inherently broken in multi-instance or serverless environments.
2. **External Redis / Upstash Blocklist:** *Rejected:* Introduces external infrastructure and network dependencies, violating the architecture rule against unnecessary infrastructure.
3. **Database-Backed Persistent Sessions (PostgreSQL):** *Selected:* Reuses existing managed PostgreSQL connection pool via Neon with zero additional infrastructure.

### Decision
Supersede the in-memory map by introducing the **`StaffSession` Prisma model** in PostgreSQL:
1. **Schema Model:**
   ```prisma
   model StaffSession {
     id         String    @id @default(cuid())
     userId     String    @map("user_id")
     tokenHash  String    @unique @map("token_hash")
     expiresAt  DateTime  @map("expires_at")
     revokedAt  DateTime? @map("revoked_at")
     createdAt  DateTime  @default(now()) @map("created_at")
     user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
     @@map("staff_sessions")
   }
   ```
2. **Hardened Bearer Token & Storage Architecture:**
   - **Generation:** On login, a cryptographically secure 32-byte random `rawToken` is generated via `randomBytes(32).toString('base64url')`.
   - **Database Persistence:** The server computes `tokenHash = SHA-256(rawToken)` and persists **only** `tokenHash` in PostgreSQL (`staff_sessions.token_hash`). `rawToken` is **never** written to the database.
   - **Cookie Payload:** The client cookie (`eq_staff_session`) contains `{ userId, email, name, role, rawToken, createdAt, expiresAt }` signed with server-side HMAC-SHA256 (`AUTH_SECRET`). `tokenHash` is **never** exposed to the client in the cookie payload.
   - **Request Verification:** On every protected request, `verifySessionAndFetchUser` first verifies the HMAC-SHA256 signature using constant-time comparison `timingSafeEqual`. Tampered cookies fail immediately before any database query is issued. Upon signature verification, the server extracts `rawToken`, computes `SHA-256(rawToken)`, and uses that hash to look up the session record in PostgreSQL.
   - **Logout Revocation:** `revokeSession` verifies the HMAC signature, extracts `rawToken`, computes `SHA-256(rawToken)`, and marks `revokedAt = NOW()` in PostgreSQL.
3. **Session Verification Assertions:**
   - The session record exists in PostgreSQL.
   - `revokedAt === null` (rejects with `StaffSessionRevokedError` if revoked).
   - `new Date() <= persistedSession.expiresAt` (application code check against persisted expiration timestamp).
   - User account exists and live database role matches token claim (`dbUser.role === payload.role`).
4. **Honest Logout Handling:** In `POST /api/auth/logout`, `await staffAuthService.revokeSession(token)` writes `revokedAt = NOW()` in PostgreSQL. If a database error occurs during revocation, the endpoint clears the client cookie but returns HTTP 500 `{ success: false, serverRevoked: false }`, honestly reporting that server-side revocation failed.
5. **Fail Closed:** Any database error during `verifySessionAndFetchUser` fails closed, denying access.

### Trade-offs & Consequences
- **Positive:** 100% reliable session revocation across all serverless lambda instances and cold restarts; zero external cache infrastructure; relational cascade deletion on user deletion (`onDelete: Cascade`).
- **Two-Layer Defense-in-Depth:**
  - *Layer 1 (Cookie Integrity & Client Security):* The browser cookie is an HTTP-only bearer credential. Its integrity is protected by HMAC-SHA256 signing using the server secret (`AUTH_SECRET`). Clients cannot forge tokens, alter user roles, or tamper with expiry without detection.
  - *Layer 2 (Database Compromise Protection):* Because PostgreSQL stores only the one-way `SHA-256(rawToken)` and the cookie requires the unhashed `rawToken`, an attacker who obtains read access to PostgreSQL cannot derive the valid bearer tokens needed to construct client session cookies.
- **Account Status Clarification:** The Prisma `User` model currently defines authentication fields (`id`, `email`, `passwordHash`, `name`, `role`, timestamps). There is currently **no explicit `isActive` or `disabledAt` column** on `User`. Instead, account deactivation is modeled either by: (1) deleting the `User` row (which cascades and deletes all `StaffSession` records), or (2) demoting the user's role to `BUYER`, which immediately fails the `ALLOWED_STAFF_ROLES.includes(dbUser.role)` guard on the subsequent request. Documentation has been strictly updated to reflect this exact reality.
- **Negative:** Requires an indexed database read on protected staff requests. Expired/revoked rows accumulate and should be pruned periodically via background cleanup.

### Code & Test Evidence
- **Migration:** `prisma/migrations/20261107065456_add_staff_sessions/migration.sql` (applied to dev baseline `neondb` and test branch `ep-mute-butterfly-b3a54tpa`).
- **Service Implementation:** `src/services/auth/staff-auth.service.ts` (`authenticateStaff`, `verifySessionAndFetchUser`, `revokeSession`, `hashRawToken`).
- **Logout Route:** `src/app/api/auth/logout/route.ts`.
- **Unit Tests:** `tests/unit/staff-auth.test.ts` (21 unit tests: verifies DB persistence of hash only, rawToken in cookie without exposing tokenHash, revoked rejection, role demotion rejection, tampered rejection before DB lookup, and fail-closed behavior on database error).
- **Integration Tests:** `tests/integration/staff-auth.test.ts` (12 integration tests: Scenario 8 verifies `staffSession` row in PostgreSQL with hash mismatch to rawToken, logout revocation, and rejection across a separate `StaffAuthService` instance; Scenario 11 verifies rejection when database `expiresAt` has elapsed; Scenario 12 verifies tampered signature rejection before database query).

---

## ADR-008: Dynamic Relational Derivation of Lead Lifecycle Status & Role-Based Record-Level Access Control

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Principal Engineering Mentor & Implementation Partner

### Context
Milestone 6.2 transforms the staff operations portal into a live, database-backed lead pipeline. The assessment requires tracking lead lifecycle milestones (`NEW`, `ENGAGED`, `ESCALATED`, `BOOKED`, `VISITED`), providing multi-channel attribution, and enforcing strict data isolation between staff roles (`SALES_HEAD` vs. `SALES_EXEC`).
However, our Prisma `Lead` model purposefully contains immutable acquisition channel attribution (`source`), contact fields, and relational foreign keys, but does not contain a static mutable `status` column or an `assignedToId` column. We needed an architecture that satisfies strict lifecycle tracking and role-based record-level access control without mutating the database schema or creating dual-source-of-truth synchronization hazards.

### Alternatives Considered
1. **Schema Mutation (Adding `status` and `assignedToId` to `Lead`):** Adding a mutable `status` enum column and `assignedToId` FK to the `Lead` model. *Rejected:* Violates the strict schema lock protocol and creates dual-source-of-truth desynchronization bugs (e.g. if a site visit is cancelled or attendance marked, background jobs or complex distributed triggers would need to update the `Lead` table row).
2. **Client-Side Record Filtering:** Sending all leads to the browser and filtering out unassigned leads in JavaScript. *Rejected:* Critical security vulnerability (Insecure Direct Object Reference / IDOR) that leaks confidential buyer contact information and inquiries over the wire.
3. **Dynamic Relational Derivation & Server-Side Query Scoping:** Computing lifecycle state from authoritative domain events and enforcing scoping inside PostgreSQL queries. *Accepted.*

### Decision
1. **Deterministic Funnel Progression:** In `LeadService.computeLeadLifecycleStatus()`, dynamically evaluate the lead's lifecycle status using a strict priority hierarchy:
   - `VISITED`: Any associated `SiteVisit` has `attendanceOutcome === AttendanceOutcome.ATTENDED`.
   - `BOOKED`: Any associated `SiteVisit` has `bookingStatus in [CONFIRMED, COMPLETED]` without attended status.
   - `ESCALATED`: Any associated `Conversation` has an active `Handoff` record.
   - `ENGAGED`: `firstResponseAt !== null` or at least one `Conversation` exists without visits or escalations.
   - `NEW`: Default baseline state (no responses, conversations, or site visits).
2. **Database-Level Query Filtering & Pagination:** In `getLifecycleStatusFilter()`, translate lifecycle filters into native Prisma relational query conditions (`siteVisits: { some: { attendanceOutcome: "ATTENDED" } }`, etc.). This enables accurate SQL `COUNT`, `SKIP`, and `TAKE` pagination directly inside PostgreSQL without loading unpaginated datasets into application memory.
3. **Server-Side Relational Record Scoping:** In `getStaffLeadScope()`:
   - `SALES_HEAD`: Organizational visibility across all active leads (`where: { deletedAt: null }`).
   - `SALES_EXEC`: Strict relational scoping restricting queries to leads assigned to that specific executive via conversation handoffs (`where: { deletedAt: null, conversations: { some: { handoff: { assignedToId: staffUser.id } } } }`).
   - `BUYER` / Other: Immediately rejected with `StaffSessionForbiddenError` (HTTP 403).
4. **IDOR Defense on Single-Lead Detail:** In `LeadService.getLeadDetail(leadId, staffUser)`, apply the identical server-side scope inside the database query. If an executive requests a lead that does not belong to them, the query returns `null` and the API/route handler responds with HTTP 404, preventing attackers from probing the existence of valid lead IDs.

### Trade-offs & Consequences
- **Positive:**
  - Zero schema migration required; 100% compliant with existing 14-model architecture.
  - Zero data desynchronization bugs between booking/attendance events and lead status.
  - Server-side IDOR defense guarantees executives cannot inspect or enumerate unauthorized lead records.
  - Full relational pagination avoids memory bloat in Vercel serverless functions.
- **Negative:**
  - Status filtering requires relational `JOIN`/`EXISTS` queries in PostgreSQL. Indexed foreign keys (`site_visits(lead_id)`, `conversations(lead_id)`, `handoffs(conversation_id)`) ensure optimal execution times under volume.

### Code & Test Evidence
- **Service:** `src/services/lead/lead.service.ts` (`computeLeadLifecycleStatus`, `getStaffLeadScope`, `getLifecycleStatusFilter`, `getLeads`, `getLeadDetail`, `getLeadMetrics`).
- **Validation:** `src/lib/validations/lead.ts` (`leadQuerySchema`, `leadLifecycleStatusValues`).
- **API Endpoints:** `src/app/api/leads/route.ts`, `src/app/api/leads/metrics/route.ts`, `src/app/api/leads/[id]/route.ts`.
- **UI Components & Pages:** `src/app/(portal)/dashboard/leads/page.tsx`, `src/app/(portal)/dashboard/leads/[id]/page.tsx`, `src/components/portal/leads/lead-pipeline-client.tsx`, `src/components/portal/leads/ingest-lead-modal.tsx`.
- **Unit Tests:** `tests/unit/lead-pipeline.test.ts` (19 tests: validates lifecycle status progression, staff scoping filters, query schema validation, and error cases).
- **Integration Tests:** `tests/integration/lead-pipeline.test.ts` (7 tests against isolated Neon test branch: verifies SALES_HEAD pagination, SALES_EXEC scoping, keyword search, lifecycle filtering, source filtering, IDOR prevention on getLeadDetail, and live getLeadMetrics).

---

## ADR-009: Handoff Queue, Role-Scoped Ownership, and In-Conversation System Audit Trails

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Principal Engineering Mentor & Implementation Partner

### Context
Milestone 6.3 establishes the operations queue for managing AI-escalated and buyer-requested handoffs (`/dashboard/handoffs`). The platform must empower Sales Heads to monitor unassigned queues across the entire developer portfolio, inspect AI-generated summaries and complete multi-turn chat transcripts, balance executive workloads, and atomically assign/reassign handoffs to sales executives. Concurrently, Sales Executives must only access their individually assigned handoffs and be strictly barred from viewing or assigning other executives' records. Furthermore, an immutable audit trail of ownership transfers must be preserved without mutating or migrating the locked 14-model schema.

### Alternatives Considered
1. **Schema Migration (Adding a Dedicated `HandoffAssignmentHistory` Model):** Adding a new relational table to record every assignment change with actor and timestamp foreign keys. *Rejected:* Violates the project's strict schema lock rule. The existing 14-model architecture intentionally provides full conversation logging (`ChatMessage`) and handoff state (`Handoff.assignedToId`), making an additional table redundant for a take-home assessment.
2. **Client-Side Queue Scoping:** Sending all organization handoffs to the client browser and filtering out unassigned or rival items in React. *Rejected:* Critical Insecure Direct Object Reference (IDOR) flaw that exposes buyer inquiries, unverified pricing discussions, and contact information.
3. **In-Conversation System Audit Trails & Relational Interlock:** Executing assignment transactions with atomic ownership updates and recording immutable internal audit turns directly into `ChatMessage` with server-side role scoping. *Accepted.*

### Decision
1. **Server-Side Role-Based Queue Scoping (`getStaffHandoffScope`):**
   - `SALES_HEAD`: Unrestricted visibility across all handoff records in the database (`{}`).
   - `SALES_EXEC`: Strict relational scoping restricted exclusively to handoffs assigned to that specific executive (`{ assignedToId: staffUser.id }`).
   - `BUYER` / Other: Immediately throws `HandoffForbiddenError` (HTTP 403).
2. **Anti-IDOR Single Handoff Detail Lookup:**
   - In `HandoffService.getHandoffDetail(handoffId, staffUser)`, apply the role scope directly in the database lookup (`where: { id: handoffId, ...roleScope }`). If an executive queries an unassigned or rival handoff, the method returns `null` and the API responds with HTTP 404, preventing enumeration attacks.
3. **Atomic Assignment & Audit Trail (`assignHandoff`):**
   - Executes inside `prisma.$transaction`.
   - Enforces that only `SALES_HEAD` can assign or reassign (`requireSalesHead` at API route level and role verification in service).
   - Validates that the target executive exists and currently holds the `SALES_EXEC` role. Eligibility is strictly governed by whether the user currently holds the `SALES_EXEC` role in PostgreSQL (the User model does not have an independent account activation field; suspension is enforced via role demotion to `BUYER` or user deletion).
   - Atomically updates `Handoff.status` to `ASSIGNED` and `Handoff.assignedToId` to the target executive.
   - Appends an audit message turn into `ChatMessage` (`role: ChatMessageRole.AI`, content: `[Ownership Assigned] ...` or `[Ownership Reassigned] ...`) recording the exact timestamp, target executive, and acting Sales Head.
   - **Concurrency Semantics:** Executes under serialized Last-Write-Wins (LWW). When two concurrent Sales Head assignment requests target the same handoff simultaneously, PostgreSQL serializes the updates on the row-level write lock. Both transactions commit atomically with their matching audit notes without deadlock, P2002 collision, or orphaned records. The final database ownership unambiguously matches whichever transaction committed last.
   - **Relational Interlock:** Because `LeadService.getStaffLeadScope()` derives lead ownership through `conversations.some.handoff.assignedToId`, assigning a handoff immediately grants the executive access to that lead in `/dashboard/leads` without requiring duplicate database columns or synchronization hooks.
4. **Internal Audit Message Isolation & Boundary Defense (`src/lib/chat-message.ts`):**
   - Centralized helpers `isInternalAuditMessage()` and `filterBuyerFacingMessages()` strictly isolate internal audit entries:
     - An audit message must satisfy BOTH: its role is `AI` (ChatMessageRole.AI) and its content starts with a recognized prefix (`[Ownership Assigned]`, `[Ownership Reassigned]`, etc.). Ordinary buyer messages with role `USER` starting with similar text are never suppressed (anti-spoofing).
     - **Staff Visibility:** Visible only to authorized staff in `TranscriptModal` and `/dashboard/leads/[id]` with dedicated audit formatting.
     - **Buyer API & UI Isolation:** Stripped from `GET /api/chat/session`, `POST /api/chat/session`, and the buyer concierge interface (`concierge-chat.tsx`).
     - **AI Prompt Context Isolation:** Excluded from the `history` array passed to Gemini (`AIConciergeService.sendMessage`), ensuring Gemini is never prompted with staff names, emails, or internal reassignments and cannot leak them to buyers.
5. **Workload Distribution Metrics:**
   - In `getEligibleSalesExecutives()`, aggregate active lead counts across all staff users who currently hold the `SALES_EXEC` role, presenting live workload badges in the assignment modal to assist the Sales Head with fair distribution.
6. **Resolution Control (`updateHandoffStatus`):**
   - Allows `SALES_HEAD` or the assigned `SALES_EXEC` to transition an escalation to `RESOLVED` (setting `resolvedAt`), while preventing unauthorized executives from resolving rival cases.

### Trade-offs & Consequences
- **Positive:**
  - Zero schema migrations required; 100% compliant with the 14-model architecture.
  - Complete ACID transaction guarantees under serialized LWW without race conditions or orphaned audit notes.
  - Full boundary isolation preventing internal audit leakages to buyers or Gemini context windows.
  - Relational access control automatically propagates lead visibility across both `/dashboard/handoffs` and `/dashboard/leads`.
  - Comprehensive anti-IDOR defense on both listing queries and individual transcript lookups.
- **Negative:**
  - Audit turns share the `ChatMessage` table, requiring centralized prefix filtering (`[Ownership Assigned]`, `[Ownership Reassigned]`) to maintain complete separation between buyer dialogue turns and staff audit logs.

### Code & Test Evidence
- **Domain Service:** `src/services/handoff/handoff.service.ts` (`getStaffHandoffScope`, `getHandoffs`, `getHandoffDetail`, `getHandoffMetrics`, `getEligibleSalesExecutives`, `assignHandoff`, `updateHandoffStatus`).
- **Isolation Helpers:** `src/lib/chat-message.ts` (`isInternalAuditMessage`, `filterBuyerFacingMessages`).
- **Validation Schemas:** `src/lib/validations/handoff.ts` (`handoffQuerySchema`, `assignHandoffSchema`, `updateHandoffStatusSchema`).
- **API Endpoints:**
  - `GET /api/handoffs` (list with filters, search, pagination, role scoping).
  - `GET /api/handoffs/metrics` (portfolio/queue aggregate metrics).
  - `GET /api/handoffs/[id]` (anti-IDOR transcript & lead details).
  - `PATCH /api/handoffs/[id]/assign` (Sales Head assignment with CSRF protection).
  - `PATCH /api/handoffs/[id]/status` (resolution update with CSRF protection).
  - `GET /api/chat/session` & `POST /api/chat/session` (hardened with `filterBuyerFacingMessages`).
- **UI Components & Pages:**
  - `src/app/(portal)/dashboard/handoffs/page.tsx` (Server component with session & metrics).
  - `src/components/portal/handoffs/handoff-queue-client.tsx` (Client queue table & mobile cards with debounced search, filters, pagination).
  - `src/components/portal/handoffs/assign-handoff-modal.tsx` (Sales Head assignment modal with live executive workload badges).
  - `src/components/portal/handoffs/transcript-modal.tsx` (Multi-turn chat transcript viewer with grounding facts and audit formatting).
  - `src/components/buyer/concierge-chat.tsx` (Hardened with `filterBuyerFacingMessages`).
  - `src/app/(portal)/dashboard/leads/[id]/page.tsx` (Staff lead dossier with system audit formatting).
- **Unit Tests:** `tests/unit/handoff.test.ts` (23 tests passed: validates role scoping filters, query/assign/status Zod schemas, error classes, and audit message isolation helpers).
- **Integration Tests:** `tests/integration/handoff-queue.test.ts` (13 tests passed against isolated Neon PostgreSQL test branch: validates SALES_HEAD vs SALES_EXEC scoping, search, filters, anti-IDOR detail lookup, atomic assignment, reassignment, 403 authorization rejection, invalid assignee rejection, serialized LWW concurrent assignment execution, workload metrics, status resolution, and buyer/API/AI audit isolation regression).

---

## ADR-010: Fact Sheet Approval Governance, Content Demotion Invariant, and AI Grounding Isolation

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Principal Engineering Mentor & Implementation Partner

### Context
In real estate AI concierge applications, preventing hallucinations requires deterministic database grounding. If property specifications, starting prices, or configurations can be casually modified without human executive sign-off, stale or unauthorized marketing claims can enter the LLM context window, resulting in RERA non-compliance and legal liability.

### Alternatives Considered
1. **Unconstrained Direct Editing:** Allow staff to edit fact sheet records directly in PostgreSQL without changing their verification status. *Rejected:* Extreme risk of unverified or hallucinated facts leaking into Gemini's grounding context without approval.
2. **Dual-Table Architecture (DraftFacts vs VerifiedFacts):** Maintain separate tables for staging and production facts. *Rejected:* Violates the strict 14-model schema freeze; creates data duplication and schema migration overhead.
3. **Automatic Content Demotion Invariant (Chosen):** Utilize the existing 14-model `FactSheet` schema (`status: VERIFIED | DRAFT | UNVERIFIED`, `isActive: Boolean`, `verifiedById: String?`). Any content modification (`key`, `value`, `scope`, or `projectId`) on an existing `VERIFIED` fact automatically demotes its status to `UNVERIFIED` and sets `verifiedById = null`.

### Decision
1. **Server-Side Role Governance:** All Fact Sheet mutations (`createFactSheet`, `updateFactSheet`, `verifyFactSheet`, `deleteFactSheet`) are restricted strictly to `SALES_HEAD` accounts via `requireSalesHead(req)`. Requests from `SALES_EXEC` or unauthorized roles are rejected with HTTP 403.
2. **Automatic Content Demotion Invariant:** When `FactSheetService.updateFactSheet()` detects a modification to content fields (`key`, `value`, `scope`, or `projectId`) on a currently `VERIFIED` record, it automatically sets `status = FactSheetStatus.UNVERIFIED` and disconnects `verifiedById`. This guarantees that unreviewed changes can never remain active in production AI grounding.
3. **AI Grounding Isolation:** `AIConciergeService.getVerifiedFacts()` retrieves records strictly matching `WHERE status = 'VERIFIED' AND isActive = true`. Draft, unverified, demoted, and deactivated entries are completely excluded from Gemini's prompt context.
4. **Approval & Rejection Lifecycle:**
   - `VERIFY` action: Sets `status = VERIFIED`, `isActive = true`, and connects `verifiedById = staffUser.id`.
   - `REJECT` action: Sets `status = UNVERIFIED`, `isActive = false`, and disconnects `verifiedById`.

### Trade-offs & Consequences
- **Positive:**
  - Zero schema migrations required.
  - Fail-safe anti-hallucination protection: accidental or unauthorized edits instantly remove facts from AI retrieval.
  - Complete auditability: every verified fact records both its creator (`createdById`) and authorized approver (`verifiedById`).
- **Negative:**
  - Editing a typo on a live fact temporarily removes it from AI retrieval until the Sales Head clicks "Approve / Verify".

### Code & Test Evidence
- **Domain Service:** `src/services/fact-sheet/fact-sheet.service.ts` (`getFactSheets`, `getFactSheetMetrics`, `createFactSheet`, `updateFactSheet`, `verifyFactSheet`, `deleteFactSheet`).
- **Validation Schemas:** `src/lib/validations/fact-sheet.ts` (`factSheetQuerySchema`, `createFactSheetSchema`, `updateFactSheetSchema`, `verifyFactSheetSchema`).
- **API Endpoints:**
  - `GET /api/fact-sheet`, `POST /api/fact-sheet`
  - `GET /api/fact-sheet/metrics`
  - `PATCH /api/fact-sheet/[id]`, `DELETE /api/fact-sheet/[id]`
  - `POST /api/fact-sheet/[id]/verify`
- **UI Components:** `src/app/(portal)/dashboard/fact-sheet/page.tsx`, `src/components/portal/fact-sheet/fact-sheet-client.tsx`, `src/components/portal/fact-sheet/fact-sheet-modal.tsx`.
- **Unit Tests:** `tests/unit/fact-sheet.test.ts` (19 tests passed: validates schemas, role guards, automatic demotion, approval/rejection lifecycle).
- **Integration Tests:** `tests/integration/fact-sheet.test.ts` (9 tests passed against isolated Neon PostgreSQL test branch: validates Sales Head creation, DRAFT exclusion from AI, verification flow, AI retrieval inclusion, demotion on update, immediate AI exclusion after demotion, and anti-IDOR authorization rejection).

---

## ADR-011: Slot Capacity Model, Attendance Verification, and Executive Scope Enforcement

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Principal Engineering Mentor & Implementation Partner

### Context
Site visits represent high-intent buyer commitments. The system must prevent overbooking, protect slot modification integrity when active bookings exist, verify physical visit attendance (`ATTENDED` vs `NO_SHOW`), and prevent sales executives from tampering with visits of leads assigned to other team members (anti-IDOR).

### Alternatives Considered
1. **Numeric Slot Capacity Counter:** Add an integer `capacity` column to `VisitSlot`. *Rejected:* Unnecessary schema migration; introduces decrement race conditions.
2. **1-Capacity Relational Model (Chosen):** Each `VisitSlot` represents a discrete, atomic appointment window (1 booking capacity), enforced relationally by the PostgreSQL partial unique index `one_active_booking_per_slot` (`WHERE booking_status = 'CONFIRMED'`).
3. **Allowing Premature Attendance Recording:** Allow staff to mark attendance ahead of time. *Rejected:* Violates domain reality; leads cannot be verified as attended before their appointment start time has arrived.

### Decision
1. **1-Capacity Slot Reservation Model:** Enforced at the PostgreSQL level via partial unique index `one_active_booking_per_slot`. A slot is `AVAILABLE` (0 booked / 1 capacity) or `BOOKED` (1 booked / 1 capacity).
2. **Slot Modification & Deletion Guards:**
   - Modifying start/end times or location on a slot with an active confirmed booking is rejected (`409 Conflict`).
   - Deleting a slot with booking history (even past or cancelled visits) is rejected to preserve attribution audit trails and prevent foreign key cascade errors.
3. **Temporal Attendance Guard:** Staff can record attendance outcomes only after the visit start time has arrived (`startsAt <= NOW()`) or for historical records (`COMPLETED` + `UNRECORDED`). Cancelled visits or visits with already recorded outcomes are rejected.
4. **Attendance Outcome State Machine:**
   - `ATTENDED`: Transitions `bookingStatus = COMPLETED`, records `attendedAt = NOW()`, and automatically transitions the lead's dynamically computed lifecycle stage to `VISITED`.
   - `NO_SHOW`: Transitions `bookingStatus = COMPLETED`, leaves `attendedAt = null`.
5. **Server-Side Anti-IDOR Role Scoping:**
   - `SALES_HEAD`: Full visibility and attendance recording authority across all portfolio visits and slots.
   - `SALES_EXEC`: Scoped strictly to visits where the buyer lead is assigned to them (`lead.conversations.some.handoff.assignedToId === user.id`). Attempts to record attendance or cancel unassigned visits are rejected with HTTP 409 / 403.
   - Slot creation, modification, and deletion are restricted strictly to `SALES_HEAD`.
6. **Dual-Defense Reminder Suppression & Dispatch Boundary:**
   - Recording attendance (`ATTENDED`/`NO_SHOW`) or cancelling a booking immediately purges all `PENDING` and in-flight `PROCESSING` reminder jobs for that visit in PostgreSQL.
   - In `ReminderService.processReminderJob`, an atomic pre-dispatch check immediately before calling `notificationProvider` verifies that the job remains active in `PROCESSING` and that the visit remains `CONFIRMED` and `UNRECORDED`, suppressing dispatch for any state changes committed before that query.
   - *Time-of-Check to Time-of-Use (TOCTOU) Boundary:* If staff records attendance after the pre-dispatch check completes but before the provider function executes, the message will still be dispatched. Holding a database transaction open across remote network I/O is deliberately avoided to prevent connection pool exhaustion and lock starvation. Downstream carrier `idempotencyKey` prevents duplicate deliveries, but cannot recall an authorized in-flight request.

### Trade-offs & Consequences
- **Positive:**
  - Zero schema migrations required.
  - Concurrency safety guaranteed by PostgreSQL partial unique index.
  - Zero IDOR vulnerability: executives cannot inspect or record attendance on rival leads.
  - Dynamic pipeline progression: attendance recording immediately cascades into the master lead pipeline without secondary database syncs.
- **Negative:**
  - Slots are single-booking windows; group or batch visit tours require staging multiple consecutive slot records.

### Code & Test Evidence
- **Domain Service:** `src/services/booking/booking.service.ts` (`createSlot`, `updateSlot`, `deleteSlot`, `getAllSlots`, `getSlotMetrics`, `getVisits`, `getVisitMetrics`, `recordAttendance`, `cancelVisitByStaff`).
- **Validation Schemas:** `src/lib/validations/slot.ts` (`slotQuerySchema`, `createSlotSchema`, `updateSlotSchema`), `src/lib/validations/booking.ts` (`visitQuerySchema`, `recordAttendanceSchema`).
- **API Endpoints:**
  - `GET /api/slots`, `POST /api/slots`, `GET /api/slots/metrics`, `PATCH /api/slots/[id]`, `DELETE /api/slots/[id]`
  - `GET /api/visits`, `GET /api/visits/metrics`, `POST /api/visits/[id]/attendance`, `POST /api/visits/[id]/cancel`
- **UI Components:** `src/app/(portal)/dashboard/visits/page.tsx`, `src/components/portal/visits/visits-manager-client.tsx`, `src/components/portal/visits/create-slot-modal.tsx`, `src/components/portal/visits/edit-slot-modal.tsx`, `src/components/portal/visits/record-attendance-modal.tsx`.
- **Unit Tests:** `tests/unit/slot-management.test.ts` (15 tests passed), `tests/unit/visit-attendance.test.ts` (11 tests passed).
- **Integration Tests:** `tests/integration/visit-attendance.test.ts` (9 tests passed against isolated Neon PostgreSQL test branch: validates slot creation, modification guards, booking, anti-IDOR scoping, attendance recording, dynamic `VISITED` lifecycle transition, and duplicate recording rejection).
