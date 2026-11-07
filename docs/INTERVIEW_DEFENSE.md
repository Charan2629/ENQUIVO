# ENQUIVO — Engineering Interview Defense & Deep-Dive Guide

This document prepares the engineering team to defend every technical, architectural, and security decision implemented in the ENQUIVO platform. All statements reflect the **actual code and test suite in the repository**. Capabilities not implemented are explicitly identified as out of scope.

---

## 1. System Architecture & Stack Decisions

### Core Concept & Execution Flow
ENQUIVO is designed as a **modular monolith** on Next.js 16 App Router. Business logic is strictly isolated in TypeScript service classes (`src/services/`) and exposed to the browser via thin Next.js Route Handlers (`src/app/api/`). Database queries and mutations flow through Prisma 7.10.1 targeting Neon PostgreSQL.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js 16 App Router                           │
│                                                                        │
│   (buyer) Public UI       (portal) Staff UI       (auth) Login UI      │
│   src/app/page.tsx        src/app/(portal)/*      src/app/(auth)/*     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                        HTTP / Secure Session Cookies
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Route Handlers & Guards                          │
│   src/app/api/{chat, auth, inngest}/*    src/lib/auth-guard.ts         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                        TypeScript Service Layer
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│   LeadService       BookingService     ReminderService   StaffAuthService│
│   src/services/lead src/services/book  src/services/rem  src/services/auth│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                           Prisma Client ORM
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                     Neon Hosted PostgreSQL (14 Models)                 │
│         Partial Unique Index: one_active_booking_per_slot              │
│         Persistent Staff Sessions: staff_sessions                      │
└────────────────────────────────────────────────────────────────────────┘
```

### Trade-off Defense: Modular Monolith vs. Microservices
- **Why Monolith:** For a residential development with 420 apartments, microservices would introduce distributed transactions (2-phase commit or saga orchestrators), network serialization overhead, eventual consistency edge cases, and multiple deployment pipelines with zero performance benefit.
- **Why Modular:** Organizing business logic into independent services with constructor dependency injection (`constructor(private db: PrismaClient = defaultPrisma)`) provides clean domain boundaries. In tests, we inject an isolated test client (`testPrisma`) targeting an ephemeral Neon branch without mutating the baseline database singleton.

### Likely Interview Questions

> **Q: Why Next.js 16 App Router rather than a separate Node.js Express backend and React SPA?**
>
> **Answer:** *"Next.js 16 App Router gives us a unified TypeScript type system across both frontend and backend without duplicating Zod schemas or DTO interfaces. Crucially, React Server Components allow us to perform data fetching (such as rendering verified project statistics on `/` or dashboard shells on `/dashboard`) entirely server-side, eliminating client-side layout shifts and loading waterfalls while preventing internal database models or queries from ever leaking into browser bundles."*

> **Q: Why did you choose Prisma 7 over Prisma 8 or raw SQL queries?**
>
> **Answer:** *"Prisma 8 is currently an unstable Release Candidate (8.0.0-rc.29) with breaking package restructuring and experimental migration tooling, which represents an unacceptable production risk. Prisma 7.10.1 is stable, battle-tested, supports Node 24 LTS, and provides native support for PostgreSQL partial indexes via `previewFeatures = ['partialIndexes']`. While raw SQL offers maximum performance, Prisma provides compile-time type safety across our 14 relational models, automated migration generation, and defense against SQL injection via parameterized queries."*

---

## 2. Concurrency & Site-Visit Booking Engine

### Core Files
- `src/services/booking/booking.service.ts`
- `prisma/migrations/20261103165535_init/migration.sql`
- `tests/integration/booking-service.test.ts`

### Concurrency Defense Pattern
When multiple buyers attempt to book the same physical visit slot simultaneously, application-level checks like `if (slot.status === 'AVAILABLE')` are subject to race conditions under concurrent requests. We enforce a two-tier defense:

1. **Atomic Conditional Update (Tier 1):**
   ```typescript
   const updated = await tx.visitSlot.updateMany({
     where: { id: slotId, status: "AVAILABLE", startsAt: { gt: new Date() } },
     data: { status: "BOOKED" },
   });
   if (updated.count !== 1) {
     throw new SlotUnavailableError("Selected visit slot is no longer available.");
   }
   ```
2. **PostgreSQL Partial Unique Index (Tier 2):**
   ```sql
   CREATE UNIQUE INDEX "one_active_booking_per_slot"
     ON "site_visits"("slot_id")
     WHERE (booking_status = 'CONFIRMED'::"BookingStatus");
   ```

### Failure Mode: What breaks if we remove this?
If we remove the conditional update and partial index, two simultaneous HTTP requests reading `status === 'AVAILABLE'` will both insert a `CONFIRMED` `SiteVisit`. Two families arrive at the site sales office at the same hour for the same executive. The partial unique index guarantees that even if application logic were completely bypassed, PostgreSQL rejects the second write with constraint violation `P2002`.

### Likely Interview Questions

> **Q: Why did you use a partial unique index instead of a standard unique constraint on `slotId`?**
>
> **Answer:** *"A standard unique constraint on `SiteVisit.slotId` would prevent rebooking a slot after a previous booking was cancelled. When Buyer A books Slot 101, a `SiteVisit` row is created. If Buyer A cancels, business requirements mandate that we keep Buyer A's cancelled `SiteVisit` record for lead attribution and audit history, while releasing Slot 101 back to `AVAILABLE`. A standard unique constraint would block Buyer B from booking Slot 101 because Slot 101's ID already exists in the table. The partial unique index `WHERE booking_status = 'CONFIRMED'` enforces that at most one active booking exists for a slot at any time, allowing any number of historical `CANCELLED` records on that same slot."*

> **Q: How does `cancelBooking` handle historical visit records?**
>
> **Answer:** *"In `src/services/booking/booking.service.ts`, `cancelBooking` executes in a transaction: it updates `SiteVisit.bookingStatus = 'CANCELLED'` and records `cancelledAt = new Date()`. It inspects `VisitSlot.startsAt`. Only if the slot is in the future (`startsAt > NOW()`) does it release `VisitSlot.status = 'AVAILABLE'`. If the visit was in the past, the slot remains untouched. Finally, it deletes pending pre-visit reminder jobs to prevent phantom notifications."*

---

## 3. Background Reminders, Idempotency & Stale Recovery

### Core Files
- `src/services/reminder/reminder.service.ts`
- `src/app/api/inngest/route.ts`
- `tests/integration/reminder-service.test.ts`

### Architecture & Job State Machine
Pre-visit notifications (24-hour and 2-hour) are orchestrated by Inngest Cloud calling `/api/inngest`, which delegates to `ReminderService`. The jobs transition through four states: `PENDING` -> `PROCESSING` -> `SENT` (or `FAILED`).

```
                ┌──────────────┐
                │   PENDING    │
                └──────┬───────┘
                       │ Atomic claim (attempts + 1)
                       ▼
                ┌──────────────┐
                │  PROCESSING  │
                └──────┬───────┘
         ┌─────────────┼─────────────┐
         │ Success     │ Failure     │ Stale >10m
         ▼             ▼             ▼
   ┌───────────┐ ┌───────────┐ ┌───────────┐
   │   SENT    │ │  PENDING  │ │  PENDING  │ (attempts < 3)
   └───────────┘ │ (Backoff) │ └───────────┘
                 └─────┬─────┘       │ (attempts >= 3)
                       │ >=3 att     ▼
                       ▼       ┌───────────┐
                 ┌───────────┐ │  FAILED   │
                 │  FAILED   │ └───────────┘
                 └───────────┘
```

1. **Idempotency Key:** When staged upon booking confirmation, each job receives an immutable `idempotencyKey = ${siteVisitId}:${reminderType}` with a unique constraint. Duplicate staging calls are rejected at the database layer.
2. **Atomic Claiming:** Under horizontal worker concurrency, workers execute:
   ```sql
   UPDATE reminder_jobs
   SET status = 'PROCESSING', attempts = attempts + 1, last_attempt_at = NOW()
   WHERE id = $1 AND status = 'PENDING';
   ```
   Only the single worker that receives `count === 1` proceeds with dispatch.
3. **Compliance & Cancellation Suppression:** Before external mock dispatch, the worker checks:
   - Is `SiteVisit.bookingStatus === 'CONFIRMED'`? If cancelled, delete the job.
   - Has the lead opted out under the DPDP Act 2023 (`ConsentRecord.optedOut === true`)? If opted out, delete the job (`SKIPPED_OPTED_OUT`).
   These jobs are pruned cleanly rather than marked `FAILED`, keeping delivery failure metrics unpolluted.

### Likely Interview Questions

> **Q: What happens if a background worker crashes mid-execution while sending a reminder?**
>
> **Answer:** *"If a worker crashes while processing a job, the job is left stranded in `PROCESSING` status. Our `ReminderService.reclaimStaleProcessingJobs()` query identifies jobs that have been in `PROCESSING` with `lastAttemptAt <= NOW() - 10 minutes`. If `attempts < 3`, it reclaims the job back to `PENDING` with a backoff so another worker can reprocess it. If `attempts >= 3`, it marks the job permanently `FAILED` and logs an audit simulation note. Note that if the worker crashed after calling the messaging API but before updating the database, this represents the classic two-generals network boundary where duplicate delivery could occur upon recovery."*

---

## 4. Anti-Hallucination AI Grounding & Offline Human Fallback

### Core Files
- `src/services/ai/ai.service.ts`
- `src/app/api/chat/handoff/route.ts`
- `tests/integration/ai-service.test.ts`

### Grounding & Fallback Implementation
1. **Dual-Flag Fact Retrieval:**
   `getVerifiedFacts()` filters facts with `WHERE status = 'VERIFIED' AND isActive = true`. Draft facts, rejected entries, or soft-deactivated facts never enter the model context.
2. **Project Scoping Separation:**
   Facts are strictly partitioned by `scope` (`PORTFOLIO`, `PROJECT_1`, `PROJECT_2`). If a buyer asks about Project 1, only `PORTFOLIO` and `PROJECT_1` facts are provided. Unlisted amenities or pricing negotiations trigger an immediate tool call to `handoffToExecutive()`.
3. **Decoupled Offline Human Escalation (`POST /api/chat/handoff`):**
   If upstream LLM providers suffer an outage (e.g. Gemini HTTP 503 or 429 quota exhaustion), the buyer can click "Talk to Sales Executive". The endpoint calls `createManualHandoff()`, which directly queries an active `SALES_EXEC` from PostgreSQL, creates or reuses a `Handoff` record, appends a localized system confirmation message, and sets `Lead.firstResponseAt` with **zero LLM API calls**.

### Likely Interview Questions

> **Q: How do you prevent Gemini tool calls from executing an unauthorized booking or spoofing a lead's identity?**
>
> **Answer:** *"We enforce strict server-side derivation. When Gemini invokes `checkSlotAvailability` or `stageBookingProposal`, the AI tool parameters do not accept a `leadId`. The service resolves `leadId` directly from the authenticated `Conversation.leadId` stored in PostgreSQL. Furthermore, Gemini cannot independently finalize a booking: direct AI tool booking is gated, requiring explicit buyer confirmation through the server-side booking endpoint."*

---

## 5. Staff Authentication & PostgreSQL-Backed Persistent Revocation

### Core Files
- `src/services/auth/staff-auth.service.ts`
- `src/lib/auth-guard.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `prisma/schema.prisma` (`StaffSession` model)
- `prisma/migrations/20261107065456_add_staff_sessions/migration.sql`
- `tests/unit/staff-auth.test.ts`
- `tests/integration/staff-auth.test.ts`

### Evolution: Why the In-Memory Map Was Superseded
In our initial implementation, `StaffAuthService` stored revoked session tokens in a static `Map<string, number>()`. During our security review, we identified that in serverless runtimes (Next.js on Vercel):
- Multiple stateless lambda instances execute in isolated memory spaces.
- Logout on Lambda A only updated Lambda A's local memory. Replay requests hitting Lambda B accepted the revoked token.
- Serverless cold starts or worker recycling wiped the in-memory map.

To solve this without adding Redis, we created the `StaffSession` model in PostgreSQL:

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

### Complete Verification Lifecycle
1. **Login (`authenticateStaff`):**
   - Validates password via Argon2id (`verify(user.passwordHash, password)`).
   - Generates a 32-byte cryptographically secure random token (`rawToken`) via `crypto.randomBytes(32).toString('base64url')`.
   - Computes deterministic SHA-256 hash: `tokenHash = createHash('sha256').update(rawToken).digest('hex')`.
   - Persists session row in PostgreSQL with `userId`, `tokenHash`, and `expiresAt` (12 hours). `rawToken` is **never** written to PostgreSQL.
   - Signs an HTTP-only cookie embedding `rawToken` (alongside `userId`, `email`, `name`, `role`, `createdAt`, `expiresAt`) using HMAC-SHA256 (`AUTH_SECRET`). The cookie **never** exposes `tokenHash`.
2. **Every Protected Request (`verifySessionAndFetchUser`):**
   - Cryptographically verifies HMAC-SHA256 signature first using constant-time comparison `timingSafeEqual`. Tampered or forged cookies reject before database query.
   - Parses payload and extracts `rawToken`.
   - Computes `tokenHash = createHash('sha256').update(rawToken).digest('hex')`.
   - Queries PostgreSQL: `this.db.staffSession.findUnique({ where: { tokenHash }, include: { user: true } })`.
   - Checks `revokedAt === null`. If not null, throws `StaffSessionRevokedError`.
   - Checks application expiration: `if (new Date() > persistedSession.expiresAt) throw new StaffSessionExpiredError()`.
   - Checks live database user: ensures user exists, role is `SALES_HEAD` or `SALES_EXEC`, and live role matches token's claimed role (`dbUser.role === payload.role`).
   - **Fails Closed on Database Errors:** If the database connection drops or times out during verification, the guard catches the error and treats the request as unauthenticated (`getStaffSession` returns `null`), preventing unauthorized bypass.
3. **Logout (`revokeSession`):**
   - Cryptographically verifies the HMAC signature of the incoming cookie.
   - Extracts `rawToken` and computes `tokenHash = SHA-256(rawToken)`.
   - Updates PostgreSQL: `UPDATE staff_sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`.
   - In `POST /api/auth/logout`, if the database update throws an error, the endpoint clears the browser cookie but returns HTTP 500 `{ success: false, serverRevoked: false }`, honestly reporting that server-side revocation failed.

### Likely Interview Questions

> **Q: Why Argon2id over bcrypt for password hashing?**
>
> **Answer:** *"Bcrypt uses a fixed 4 KB memory footprint, making it vulnerable to massively parallel GPU and ASIC hardware attacks. Argon2id, the winner of the Password Hashing Competition (PHC), is a hybrid algorithm combining Argon2d (data-dependent memory access for GPU resistance) and Argon2i (data-independent memory access for side-channel cache-timing attack resistance). By requiring configurable memory (e.g. 64 MB) alongside CPU iterations, Argon2id makes brute-force hardware cracking clusters economically and computationally infeasible."*

> **Q: How does the session token and database hash design protect against token forgery and database compromise?**
>
> **Answer:** *"The browser cookie is an HTTP-only bearer credential. It encapsulates a 32-byte random `rawToken` inside an HMAC-SHA256 signed envelope. PostgreSQL stores only the one-way deterministic `tokenHash = SHA-256(rawToken)`. This implements two independent layers of defense:
> 1. Client Integrity: An attacker or malicious client cannot modify user roles or forge sessions because all cookie claims are protected by the server-side HMAC secret (`AUTH_SECRET`). Any modification invalidates the signature and is rejected before any database lookup.
> 2. Database Leak Protection: If an attacker obtains read access to PostgreSQL (e.g. through SQL injection or database backups), the attacker only discovers `tokenHash`. Because SHA-256 is computationally irreversible, the attacker cannot invert `tokenHash` to determine `rawToken`, and therefore cannot craft valid client cookies. When a legitimate request arrives, the server hashes the cookie's `rawToken` on the fly to find the database record."*

> **Q: How does ENQUIVO handle deactivated staff accounts? Is there an `isActive` flag in the schema?**
>
> **Answer:** *"Inspecting `prisma/schema.prisma` shows that the `User` model does not currently have an `isActive` or `disabledAt` boolean column. Account access revocation is implemented through two active mechanisms: first, an administrator can demote an employee's role in PostgreSQL from `SALES_EXEC`/`SALES_HEAD` to `BUYER`. On the next protected request, `verifySessionAndFetchUser` checks `ALLOWED_STAFF_ROLES.includes(dbUser.role)` and immediately rejects the session with `StaffSessionForbiddenError`. Second, deleting the `User` row triggers a PostgreSQL foreign key cascade (`onDelete: Cascade`) on `StaffSession`, causing subsequent verification to fail with `StaffSessionInvalidError` because the session row no longer exists."*

> **Q: How does live database revalidation eliminate stale-token privilege escalation?**
>
> **Answer:** *"In pure stateless JWT systems, if an administrator terminates a rogue employee or demotes a Sales Head to Buyer, the user's JWT remains valid until expiration (e.g. 12 hours). In ENQUIVO, every protected request verifies the cryptographic signature and queries `staffSession.findUnique` with the live `user` record from PostgreSQL. If the user was deleted, `user.role` was demoted, or the session was revoked, the request is immediately rejected on the very next request."*
