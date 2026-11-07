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
