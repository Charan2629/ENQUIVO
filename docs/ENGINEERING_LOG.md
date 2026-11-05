# ENQUIVO — Engineering Log & Milestone Journal

This engineering log provides an authoritative, chronological record of the technical design, implementation decisions, verification outcomes, and learning progression across all milestones of the ENQUIVO platform.

All timestamps are reported in **Asia/Kolkata (IST, UTC+5:30)**. Start/end durations for sub-tasks are noted as unrecorded unless captured by version control or system audit logs.

---

## Milestone 1: Project Scaffold, Modular Architecture & Documentation Foundation

- **Date:** 2026-11-03 (Committed at 16:59:06 IST)
- **Milestone & Task:** Milestone 1 — Project Scaffolding, Folder Structure Definition, Environment Configuration Template, and Initial Technical Design Document (`docs/TDD_DRAFT.md`) & Deployment Runbook (`deployment.md`).
- **Git Commit Hash:** `1a57d2d` (`feat(m1): complete project scaffold and initial documentation`)

### 1. Problem & Requirements Addressed
The client brief requires a reliable, performant, and compliant lead-response and site-visit assistant for residential real estate in Ahmedabad. The immediate requirement was to establish a production-grade foundation:
1. Establish a modular monolith layout using Next.js 16 App Router, avoiding unstructured code sprawl.
2. Define isolated route groups for three distinct user experiences: Buyer Concierge (`(buyer)`), Sales Portal (`(portal)`), and Authentication (`(auth)`).
3. Establish comprehensive documentation before writing business logic: a Technical Design Document with a rigorous Decision Log, an Assumptions Register, and a step-by-step deployment runbook.
4. Secure environment variable templates (`.env.example`) to guarantee zero secrets leak into version control.

### 2. Why We Chose This Approach
- **Modular Monolith over Microservices (Decision D-002):** A modular monolith encapsulates domain logic in isolated services (`src/services/`) without the operational overhead of container orchestrators, distributed tracing, or cross-network latency.
- **Next.js 16 App Router over Pages Router (Decision D-001):** App Router provides native React Server Components, server-side data fetching, nested layouts per route group, and typed route handlers.
- **Route Groups (`(buyer)`, `(portal)`, `(auth)`) (Decision D-003):** Route groups allow distinct layout trees (e.g. mobile-optimized clean canvas for buyers vs. sidebar navigation dashboard for sales managers) without prefixing URL paths.

### 3. Implementation Summary
- Scaffolding initialized using Next.js 16.4.4 with React 19, TypeScript strict mode, and Tailwind CSS v4.
- Scaffolded domain directories under `src/services/` (`lead`, `booking`, `reminder`, `ai`) and API stubs under `src/app/api/`.
- Authored initial `docs/TDD_DRAFT.md` including executive summary, architecture diagram, 13-model database schema design, and Decision Log entries D-001 through D-005.
- Created `deployment.md` detailing prerequisites, local development setup, environment variables, and background job architecture.
- Created sanitized `.env.example` defining configuration templates.

### 4. Important Files Created / Modified
- `src/app/layout.tsx`, `src/app/page.tsx` — Next.js root layout and entry point.
- `src/app/(buyer)/.gitkeep`, `src/app/(portal)/.gitkeep`, `src/app/(auth)/.gitkeep` — Route group directories.
- `src/services/lead/`, `src/services/booking/`, `src/services/reminder/`, `src/services/ai/` — Service layer directory stubs.
- `.env.example` — Sanitized environment variable reference.
- `docs/TDD_DRAFT.md` — Technical Design Document.
- `deployment.md` — Deployment and operations runbook.
- `docs/PROJECT_STATE.md` — Project state tracking document.

### 5. Technical Concepts Learned
- How Next.js App Router route groups with parenthesis syntax `(groupName)` isolate root layouts while preserving clean public URLs.
- Best practices for structuring `.env.example` with clear categorization (Database, Auth, AI, Background Jobs, Application) without embedding real secrets.
- Setting up documentation-driven development workflows where technical architecture and compliance assumptions are locked prior to code execution.

### 6. Challenges Encountered & Resolutions
- *Challenge:* Next.js 16 Turbopack build conventions differed slightly from earlier versions regarding configuration files.
- *Resolution:* Verified `next.config.ts` and Tailwind CSS v4 integration using `npm run build`, confirming static page generation (4/4 pages) without errors.

### 7. Verification Performed & Results
- `npx tsc --noEmit` — ✅ PASS (0 errors)
- `npm run lint` — ✅ PASS (0 warnings, 0 errors)
- `npm run build` — ✅ PASS (Compiled successfully in 5.9s, 4/4 static routes prerendered)
- `npm test` — ⚠️ NOT CONFIGURED (Test runner setup deferred to Milestone 3)

### 8. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Set project requirements, reviewed and approved architecture choices (modular monolith, route groups, Next.js 16), audited documentation for RERA and DPDP alignment, and directed commit boundaries.
- **AI Assistance:** Generated initial scaffold structure, authored technical design documentation drafts, configured TypeScript paths, and ran verification commands under explicit developer review.

### 9. Interview Preparation & Defense
- **How to explain this in an interview:** *"In Milestone 1, we established a modular monolith architecture on Next.js 16 App Router. We isolated our application into three distinct route groups—buyer mobile interface, sales portal, and authentication—sharing a unified domain service layer. Before writing code, we locked our architectural decisions in a formal TDD with a Decision Log and Assumptions Register to ensure team alignment and compliance with Ahmedabad real estate requirements."*
- **Likely Interview Question:** *Why did you choose a modular monolith instead of microservices for a multi-role real estate application?*
- **Technical Answer:** *For ENQUIVO's scope, microservices would introduce distributed transaction overhead, network serialization latency, and operational deployment complexity without business justification. By organizing our code as a modular monolith—with strict boundaries between independent service modules under `src/services/` and thin API route handlers—we achieve high cohesion and testability while maintaining single-command deployment on Vercel. If a specific service like reminder scheduling needs independent scaling in the future, it can be extracted cleanly.*
- **Key Engineering Trade-off:** Next.js Route Groups vs. Subdomains. Subdomains require multi-tenant DNS routing and cookie domain sharing; route groups achieve identical layout isolation in a single domain with zero DNS configuration.

---

## Milestone 2: 13-Model Database Architecture, Partial Index, Safe BigInt DTOs, Neon Migration & Guarded Seed

- **Date:** 2026-11-03 to 2026-11-04 (Committed at 2026-11-04 20:53:18 IST)
- **Milestone & Task:** Milestone 2 — Prisma 7 Schema (13 models, PostgreSQL enums, partial unique index), safe BigInt DTO serialization (`src/lib/serializers.ts`), Neon hosted PostgreSQL integration (direct vs. pooled connections), database migration (`20261103165535_init`), and guarded atomic seed script (`prisma/seed.ts`).
- **Git Commit Hash:** `2e3bd3c` (`feat(m2): implement 13-model database schema, Neon migration, partial index, and guarded seed`)

### 1. Problem & Requirements Addressed
1. Model the complete domain across 13 entities (`User`, `Project`, `FactSheet`, `Lead`, `LeadSourceEvent`, `ConsentRecord`, `Conversation`, `ChatMessage`, `Handoff`, `VisitSlot`, `SiteVisit`, `ReminderJob`, `SourceSpend`).
2. Guarantee at the database level that no appointment slot can ever be double-booked by concurrent requests, while preserving historical cancelled and completed bookings.
3. Prevent financial calculation inaccuracies on marketing spend by avoiding binary floating-point rounding errors without the overhead of arbitrary-precision decimal wrappers, while safely handling JavaScript JSON serialization boundaries and PostgreSQL column capacities.
4. Support DPDP Act 2023 soft-deletion without violating unique phone number constraints.
5. Apply migrations cleanly to a remote hosted Neon PostgreSQL database and seed sample assessment leads (`LD-58210`, `LD-58211`, `LD-58224`) on the initial development/demo branch without risking accidental data loss in an actual customer-facing production environment.

### 2. Why We Chose This Approach
- **PostgreSQL Partial Unique Index (Decision D-006):** Standard unique constraints on `slot_id` prevent a slot from being rebooked after a cancellation unless the cancelled row is deleted. We implemented `CREATE UNIQUE INDEX one_active_booking_per_slot ON site_visits(slot_id) WHERE (booking_status = 'CONFIRMED')`. Cancelled or completed visits naturally drop out of the index, enabling instant rebooking while retaining full audit history.
- **Prisma 7 with `@prisma/adapter-pg` over Prisma 8 RC (Decision D-009):** Prisma 8 was an unstable release candidate with breaking package splits. Prisma 7.10.1 Stable provides reliable driver adapters for Neon connection pooling and supports native `previewFeatures = ["partialIndexes"]`.
- **Dual Connection Strings (Direct vs. Pooled):** Prisma migrations require advisory locks unsupported by transaction poolers. We configured `DIRECT_URL` (direct compute endpoint) in `prisma.config.ts` for migrations, and pooled `DATABASE_URL` via PgBouncer for application queries in `src/lib/prisma.ts`.
- **`amountPaise BigInt` with DTO Serializers (Decision D-010):** Marketing spend is stored in integer paise using PostgreSQL `BIGINT` mapped to JavaScript native `bigint`. This avoids IEEE-754 binary floating-point rounding errors (`Float`). While arbitrary-precision `Decimal` is mathematically exact, storing amounts as integer paise on native integer types (`BIGINT`) avoids third-party decimal-object wrapping and parsing overhead in the JavaScript runtime while keeping basic integer arithmetic native. Furthermore, 64-bit `BIGINT` prevents column capacity overflow that standard 32-bit `INTEGER` (~₹2.14 crore in paise) would risk on cumulative marketing spend. Because native `JSON.stringify` does not support `bigint` primitives (throwing `TypeError: Do not know how to serialize a BigInt`), safe DTO serializers (`src/lib/serializers.ts`) convert BigInt values to numbers or formatted strings at API boundaries.
- **Nullable Unique `Lead.phone` (Decision D-013):** Standard SQL semantics treat `NULL` values as distinct. Setting `phone = NULL` upon DPDP erasure allows multiple anonymized leads to coexist without unique constraint collision.
- **Guarded Atomic Seed Transaction:** We wrapped the entire seed teardown and insertion sequence in a single Prisma interactive transaction (`await prisma.$transaction(async (tx) => { ... })`) with safety guards enforcing `NODE_ENV !== "production"` and explicit `ALLOW_DESTRUCTIVE_SEED=true`. *(Note: Neon labels its initial default database branch as `[default] production` [branch ID `br-billowing-bread-b384dwk0`, endpoint `ep-frosty-tooth-b3446kf8`], but it operates in our workflow as the baseline development and demonstration database containing seeded sample data, distinct from a live customer-facing production environment).*

### 3. Implementation Summary
- Authored all 13 models, 13 custom PostgreSQL enums, and foreign key relations with `ON DELETE RESTRICT` / `CASCADE` rules in `prisma/schema.prisma`.
- Configured Prisma 7 client singleton with `@prisma/adapter-pg` driver adapter.
- Generated and applied initial migration `20261103165535_init` to Neon PostgreSQL (`neondb`).
- Verified live PostgreSQL catalogs (`pg_indexes`, `information_schema.tables`, `pg_type`, `pg_constraint`).
- Authored `src/lib/serializers.ts` providing `serializeBigInt`, `formatPaiseToRupees`, and `formatPaiseToCurrencyString`.
- Executed atomic seed transaction inserting 4 users, 2 projects, 7 fact sheets, 3 assessment leads, 12 visit slots, 2 historical site visits, 4 simulated sent reminders, and ₹30L marketing spend.
- Performed orphan audit queries confirming 0 orphaned records across all relations.

### 4. Important Files Created / Modified
- `prisma/schema.prisma` — Complete 13-model schema with partial unique index.
- `prisma.config.ts` — Prisma 7 configuration file mapping direct connection and seed command.
- `prisma/migrations/20261103165535_init/migration.sql` — Applied initial PostgreSQL migration.
- `prisma/seed.ts` — Production-guarded date-aware atomic seed script.
- `src/lib/prisma.ts` — Prisma client singleton using `@prisma/adapter-pg`.
- `src/lib/serializers.ts` — Safe BigInt DTO serialization utilities.
- `src/types/index.ts` — Re-exports Prisma enums and domain types.

### 5. Technical Concepts Learned
- How PostgreSQL partial unique indexes function internally (`btree` index over a filtered subset where predicate evaluates to true).
- Why Prisma 7 moved database connection URLs out of `datasource db` in `schema.prisma` into driver adapters and `prisma.config.ts`.
- The architectural distinction between Neon compute direct connections (port 5432) and PgBouncer pooled connections (port 5432 with `-pooler` host flag).
- Why `process.exitCode = 1` must be preferred over `process.exit(1)` in Node.js async catch handlers to allow the `finally` block to complete asynchronous connection pool draining (`prisma.$disconnect()`).

### 6. Challenges Encountered & Resolutions
- *Challenge 1 (Prisma 7 URL deprecation):* Running `prisma migrate` reported that `datasource.url` is deprecated in `schema.prisma`.
  *Resolution:* Removed `url` from `schema.prisma` and configured `prisma.config.ts` with `defineConfig` pointing to `DIRECT_URL`.
- *Challenge 2 (ESLint unused imports in seed script):* Initial seed script had unused user variables.
  *Resolution:* Cleaned imports and directly awaited `tx.user.create()` calls.
- *Challenge 3 (Node ESM dynamic import URL scheme on Windows):* Dynamic import of local TypeScript files on Windows required `file:///` protocol format when invoked from Node eval scripts.
  *Resolution:* Used standard module paths within application code and `file:///` URLs in scratch evaluation scripts.
- *Challenge 4 (Trailing whitespace & formatting):* Review identified minor trailing spaces in `deployment.md` and trailing blank lines in documentation files.
  *Resolution:* Cleaned exact lines before staging M2 commit.

### 7. Verification Performed & Results
- `npx prisma validate` — ✅ PASS (Schema syntax valid)
- `npx prisma generate` — ✅ PASS (Generated Prisma Client v7.10.1)
- `npx tsc --noEmit` — ✅ PASS (0 errors)
- `npm run lint` — ✅ PASS (0 errors, 0 warnings)
- `npm run build` — ✅ PASS (Next.js Turbopack build compiled in 1.8s)
- **Live Catalog Check (`pg_indexes`):** `CREATE UNIQUE INDEX one_active_booking_per_slot ON public.site_visits USING btree (slot_id) WHERE (booking_status = 'CONFIRMED'::"BookingStatus")` confirmed present in Neon PostgreSQL.
- **Live Catalog Check (`information_schema.tables`):** All 13 tables + `_prisma_migrations` verified in `neondb`.
- **Live Seed Row Verification:** Confirmed 4 users, 2 projects, 7 fact sheets, 3 leads, 4 events, 3 consent records, 12 slots (10 available, 2 booked), 2 site visits, 4 reminders (all SENT, 0 pending), 4 spends (totaling ₹30,00,000).
- **SQL Orphan Check:** 0 orphaned visits, 0 orphaned reminders, 0 orphaned events, 0 orphaned consent records.

### 8. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Reviewed schema designs, caught and corrected Hardik Patel's attendance status (ensured UNRECORDED rather than prematurely marked ATTENDED), mandated partial unique index over application-level locks, enforced production safety guards on destructive seed operations, reviewed all SQL migration diffs, and executed Git commits.
- **AI Assistance:** Drafted Prisma schema models, authored SQL queries, created BigInt serializer utilities, authored the atomic seed transaction with safety checks, ran verification queries against Neon PostgreSQL, and generated documentation updates.

### 9. Interview Preparation & Defense
- **How to explain this in an interview:** *"In Milestone 2, we architected a normalized 13-model database schema using Prisma 7 and hosted Neon PostgreSQL. A key technical highlight was solving double-booking concurrency. Instead of relying on fragile application-level checks, we implemented a PostgreSQL partial unique index on `site_visits(slot_id)` scoped strictly to `booking_status = 'CONFIRMED'`. This enforces single-active-booking integrity at the database storage engine level while allowing cancelled bookings to remain in the table for attribution analytics. We also modeled all monetary spend in integer paise using PostgreSQL `BIGINT` and JavaScript native `bigint` with safe DTO serializers. This eliminates IEEE-754 binary floating-point rounding errors without the decimal-object wrapping overhead of `Decimal`, while safe DTO utilities handle JavaScript's native JSON serialization boundary."*
- **Likely Interview Question 1:** *Why not simply use a standard `@unique` constraint on `slotId` in the `SiteVisit` model?*
- **Technical Answer:** *A standard unique constraint requires `slotId` to be globally unique across all rows in `SiteVisit`. If a buyer books a visit on Friday at 11 AM and subsequently cancels, the record transitions to `CANCELLED`. If another buyer then attempts to book that now-available slot, PostgreSQL would throw a unique constraint violation because the slot ID already exists in the table. To resolve that with standard uniqueness, you would have to delete the cancelled record, destroying marketing attribution and audit history. With a partial unique index filtered on `WHERE booking_status = 'CONFIRMED'`, cancelled and completed visits naturally drop out of the index, enabling immediate rebooking while keeping full historical records intact.*
- **Likely Interview Question 2:** *Why do we use two different database connection strings in Neon?*
- **Technical Answer:** *Neon provides both direct compute endpoints and pooled connection endpoints via PgBouncer. Connection pooling is essential for serverless and auto-scaling application runtimes to avoid exhausting PostgreSQL client connection limits. However, PgBouncer in transaction-pooling mode does not support session-level features such as PostgreSQL advisory locks, which Prisma migrations require to prevent concurrent schema migrations. Therefore, we use `DIRECT_URL` for migration scripts and `DATABASE_URL` (with `-pooler`) for runtime application traffic.*
- **Key Engineering Trade-off:** `BigInt` vs. `Decimal` vs. `Float` for currency. `Float` suffers from IEEE-754 binary floating-point representation drift (`0.1 + 0.2 !== 0.3`). Arbitrary-precision `Decimal` is mathematically exact, but introduces object-wrapping and string-parsing overhead in JavaScript runtimes. Storing values in the smallest currency unit (integer paise) using PostgreSQL `BIGINT` and JavaScript `bigint` keeps arithmetic native and exact without decimal library overhead. Furthermore, while 32-bit `INTEGER` column capacity caps at ~₹2.14 crore in paise, 64-bit `BIGINT` accommodates up to ~9 x 10^18 paise (~₹90,000 trillion). Crucially, JavaScript's `JSON.stringify` does not serialize native `bigint` primitives and throws `TypeError`, requiring explicit DTO conversion (`src/lib/serializers.ts`) at API boundaries.

---

## Milestone 3: Core Backend Services & Integration Tests (IN PROGRESS)

### Phase 1, Step 1: Core & Testing Dependency Installation
- **Date:** 2026-11-04 (Evening, ~21:06 IST)
- **Task:** Installation of approved production dependencies (`zod`, `inngest`) and development dependencies (`vitest`, `@vitest/coverage-v8`, `@types/node`).
- **Git Commit Hash:** Uncommitted (Working tree change).

#### 1. Problem & Implementation Summary
Installed locked dependencies required for Milestone 3 backend services and testing without introducing unauthorized packages.
- Added `zod` (`^4.6.7`) for schema validation.
- Added `inngest` (`^4.26.2`) for background reminder job orchestration.
- Added `vitest` (`^5.1.0`) and `@vitest/coverage-v8` (`^5.1.0`) for unit and integration testing.
- Upgraded `@types/node` from `^20` to `^24.19.2` to resolve Vitest 5 peer dependency requirements on Node 24.

#### 2. Challenges Encountered & Resolutions
- *Challenge:* Running `npm install -D vitest @vitest/coverage-v8` initially resulted in an npm `ERESOLVE` peer dependency conflict with `@types/node@^20`.
- *Resolution:* Because the local development runtime is Node v24.12.0, updating `@types/node` to `^24.19.2` satisfied Vitest 5's peer dependency cleanly without `--legacy-peer-deps` or forced flags.

#### 3. Verification Performed & Results
- Verified dependency tree with `npm list zod inngest vitest`.
- Confirmed zero application source files modified and zero database access during package installation.

---

### Phase 1, Step 2: Unit Test Harness Setup & Serializer Unit Tests
- **Date:** 2026-11-04 (Evening, ~22:01 IST)
- **Task:** Initial Vitest configuration scoped strictly to unit tests, `package.json` test scripts, and comprehensive unit tests for `src/lib/serializers.ts`.
- **Git Commit Hash:** Uncommitted (Working tree change).

#### 1. Problem & Implementation Summary
1. Configure Vitest exclusively for unit testing, guaranteeing that integration tests (which require database setup) and E2E tests cannot run accidentally.
2. Establish a test suite for `src/lib/serializers.ts` verifying BigInt serialization, rupee conversion, and Indian currency string formatting across normal, boundary, and negative inputs.
3. Add `npm test`, `npm run test:watch`, and `npm run test:coverage` to `package.json` while preserving all existing scripts.
4. Enforce strict isolation: no Prisma client imports, no database access, no `.env.local` loading.

#### 2. Important Files Created / Modified
- `vitest.config.mts` — Scoped Vitest configuration (`environment: "node"`, `include: ["tests/unit/**/*.{test,spec}.ts"]`, mock resets, V8 coverage provider).
- `tests/unit/serializers.test.ts` — 18 unit tests for BigInt and currency utilities.
- `package.json` — Added test execution scripts.
- `eslint.config.mjs` — Added `coverage/**` to `globalIgnores`.

#### 3. Challenges Encountered & Resolutions
- *Challenge 1 (Vite loader warning):* Naming the file `vitest.config.ts` caused Vite to emit a warning regarding ESM syntax in a CommonJS package context.
  *Resolution:* Renamed to `vitest.config.mts` to explicitly indicate ECMAScript Module format to the Node and Vite loaders.
- *Challenge 2 (ESLint warning on coverage output):* Running `npm run test:coverage` generated HTML report artifacts in `coverage/` that ESLint attempted to scan.
  *Resolution:* Added `"coverage/**"` to `globalIgnores` in `eslint.config.mjs`.

#### 4. Verification Performed & Results
- `npm test` — ✅ PASS (1 test file, 18/18 tests passed in 363ms)
- `npm run test:coverage` — ✅ PASS (100% Stmts, 100% Branch, 100% Funcs, 100% Lines strictly on `src/lib/serializers.ts`; does not represent the wider application codebase, which is pending M3–M7 service implementations)
- `npm run lint` — ✅ PASS (0 errors, 0 warnings)
- `npx tsc --noEmit` — ✅ PASS (0 errors)

#### 5. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Approved package versions, specified unit-test-only scope for initial harness, mandated strict database isolation, and reviewed test assertions.
- **AI Assistance:** Authored `vitest.config.mts`, wrote the 18 serializer test cases covering edge cases (boundary zeros, negative values, large safe integers, nested objects), and resolved Vite/ESLint configuration nuances.

#### 6. Interview Preparation & Defense
- **How to explain this in an interview:** *"When introducing our testing infrastructure in Milestone 3, we adopted a staged approach. In Step 1, we established an isolated unit test configuration with Vitest that explicitly excludes integration and E2E folders and prevents any database or environment variable loading. We immediately validated the harness with a 100% coverage suite strictly on our BigInt serialization and currency formatting utilities (`src/lib/serializers.ts`). This decoupled our unit testing from remote database latency while leaving broader application test coverage to be added alongside service implementations."*
- **Key Engineering Trade-off:** Unit Test Scoping vs. Monolithic Test Config. Combining unit and integration tests in a single un-scoped config risks developers accidentally hitting remote databases during fast test loops. Explicitly separating unit tests via `tests/unit/**` and `environment: "node"` keeps local feedback loops under 500ms.

---

### Phase 1, Step 3: Test Database Isolation & Integration Test Harness
- **Date:** 2026-11-05 (Afternoon, ~13:10 IST)
- **Task:** Test-only Prisma client (`tests/helpers/testPrisma.ts`), dedicated integration test configuration (`vitest.integration.config.mts`), npm script `test:integration`, and read-only PostgreSQL catalog smoke test (`tests/integration/db-connection.test.ts`).
- **Git Commit Hash:** Uncommitted (Working tree change).

#### 1. Problem & Implementation Summary
1. **Database Isolation Requirement:** Integration tests require executing against real PostgreSQL tables, constraints, transactions, and partial indexes. Running integration tests against the baseline development branch (`[default] production`, endpoint `ep-frosty-tooth-b3446kf8`) risks mutating or corrupting seeded demo leads and marketing spend records.
2. **Neon Copy-on-Write Branch:** Leveraged an isolated test branch (`enquivo-test`, branch ID `br-nameless-waterfall-b3omykg9`, endpoint `ep-mute-butterfly-b3a54tpa`) cloned at the storage layer from the parent branch, inheriting the migrated 13-model schema and baseline records without risking parent data integrity.
3. **Dedicated Test Client with Hostname Allow-List:** Authored `tests/helpers/testPrisma.ts` which loads `.env.local`, reads only `TEST_DATABASE_URL`, validates the URL, and enforces strict runtime assertions:
   - Rejects the baseline development endpoint `ep-frosty-tooth-b3446kf8`.
   - Asserts that the hostname contains the dedicated test endpoint `ep-mute-butterfly-b3a54tpa`.
   - Instantiates a separate `PrismaClient` using `new PrismaPg({ connectionString: testConnectionString })`.
   - Exports `testPrisma` and an asynchronous `disconnectTestPrisma()` utility.
   - Completely avoids importing the application singleton from `src/lib/prisma.ts`.
4. **Service Dependency Injection Strategy (Design Decision for Upcoming Services):** Established an approved design pattern for upcoming backend services (`LeadService`, `BookingService`, `ReminderService` scheduled for subsequent phases) to accept an optional database client via constructor dependency injection (`constructor(private db: PrismaClient = prisma)`). When implemented, application route handlers will use the default `prisma` client (`DATABASE_URL`), while integration tests will inject `testPrisma` (`TEST_DATABASE_URL`). Note: The domain services themselves have not yet been implemented in Step 3; this architectural contract governs their forthcoming implementation.
5. **Separate Integration Test Configuration:** Authored `vitest.integration.config.mts` scoped strictly to `tests/integration/**/*.{test,spec}.ts`, added `"test:integration": "vitest run --config vitest.integration.config.mts"` to `package.json`, and preserved the unit test configuration in `vitest.config.mts`.
6. **Read-Only Database Smoke Test:** Authored `tests/integration/db-connection.test.ts` executing read-only catalog queries to verify database name (`neondb`), `public.leads` table, `public._prisma_migrations` table, and `public.one_active_booking_per_slot` partial unique index. Zero data mutation was performed.

#### 2. Important Files Created / Modified
- `tests/helpers/testPrisma.ts` — Isolated test client with URL validation, endpoint allow-listing, and safe disconnect utility.
- `vitest.integration.config.mts` — Dedicated Vitest configuration for integration tests.
- `tests/integration/db-connection.test.ts` — Read-only PostgreSQL smoke test suite.
- `package.json` — Added `test:integration` script.

#### 3. Challenges Encountered & Resolutions
- *Challenge 1 (Branch ID vs. Endpoint ID Discrepancy):* Neon uses distinct naming conventions for branches (`br-billowing-bread-b384dwk0`) and compute endpoints (`ep-frosty-tooth-b3446kf8`). An earlier draft mistakenly conflated the branch adjective with an endpoint identifier.
  *Resolution:* Queried `npx neonctl branches list` and `npx neonctl postgres computes list` to establish the exact mappings: baseline branch `[default] production` uses `ep-frosty-tooth-b3446kf8`, while test branch `enquivo-test` uses `ep-mute-butterfly-b3a54tpa`.
- *Challenge 2 (Safe Disconnect in Tests):* Asynchronous database connections can hang Vitest processes if connection pools are not drained on suite completion.
  *Resolution:* Exported `disconnectTestPrisma()` and invoked it in an `afterAll` hook inside `tests/integration/db-connection.test.ts`.

#### 4. Verification Performed & Results
- `npm run test:integration` — ✅ PASS (1 test file, 4/4 smoke tests passed in 5.04s against `ep-mute-butterfly-b3a54tpa`)
  - `current_database()` confirmed `neondb`.
  - `public.leads` confirmed via `to_regclass`.
  - `public._prisma_migrations` confirmed via `to_regclass`.
  - `public.one_active_booking_per_slot` confirmed via `to_regclass`.
- `npm test` — ✅ PASS (1 test file, 18/18 unit tests passed in 498ms with zero database access)
- `npm run lint` — ✅ PASS (0 errors, 0 warnings)
- `npx tsc --noEmit` — ✅ PASS (0 errors)

#### 5. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Formulated the test database isolation policy, mandated endpoint allow-list assertions (`ep-mute-butterfly-b3a54tpa`), caught the endpoint naming discrepancy, enforced read-only smoke testing, and approved the constructor dependency injection design decision for upcoming services.
- **AI Assistance:** Drafted `tests/helpers/testPrisma.ts`, `vitest.integration.config.mts`, and `tests/integration/db-connection.test.ts`, verified branch and compute metadata via `neonctl`, ran test suites, and maintained documentation synchronization.

#### 6. Interview Preparation & Defense
- **How to explain this in an interview:** *"For our integration testing strategy in Milestone 3, we rejected two common anti-patterns: mocking the database (which fails to validate PostgreSQL constraints and transaction rollbacks) and running tests against the baseline development database (which corrupts seed data). Instead, we leveraged Neon's copy-on-write branching to create an isolated `enquivo-test` database branch. We built a dedicated test Prisma client with strict endpoint allow-listing that refuses to connect to anything other than the test endpoint (`ep-mute-butterfly-b3a54tpa`). By establishing an architectural contract for our upcoming domain services to accept an optional database client via constructor dependency injection, our production application singleton will remain completely untouched while enabling deterministic, isolated integration testing as services are built."*
- **Likely Interview Question 1:** *Why use constructor dependency injection for `PrismaClient` instead of jest/vitest module mocking (`vi.mock('@/lib/prisma')`)?*
- **Technical Answer:** *Module-level mocking mutates the global module registry, making tests stateful and prone to race conditions if tests execute concurrently or across multiple files. Dependency injection via `constructor(private db: PrismaClient = prisma)` makes dependencies explicit and type-safe. In production route handlers, the service defaults cleanly to the shared singleton. In integration tests, the test harness passes `testPrisma` directly, guaranteeing that test queries route strictly to the isolated test branch without module-hijacking side effects.*
- **Likely Interview Question 2:** *Why is an endpoint allow-list validation guard necessary in code when `TEST_DATABASE_URL` is already in `.env.local`?*
- **Technical Answer:** *Defense in depth. Human error, copy-paste accidents, or misconfigured CI/CD pipelines can easily result in `TEST_DATABASE_URL` accidentally pointing to a staging or production database. If an integration test runs data setup and teardown (`DELETE FROM leads`) against the wrong database, data loss is immediate and catastrophic. Hardcoding a runtime assertion on the specific test endpoint hostname (`ep-mute-butterfly-b3a54tpa`) and explicitly blocking the baseline endpoint (`ep-frosty-tooth-b3446kf8`) ensures the test process aborts before any SQL query can be issued.*
- **Key Engineering Trade-off:** Cloud Branching Integration Tests vs. Local Docker Testcontainers. Docker Testcontainers require local Docker daemon resources, platform-specific binaries, and do not replicate Neon-specific connection pooling (`PgBouncer` pooler endpoints) or remote network latencies. Neon cloud branching creates instantaneous, byte-identical clones in the cloud, allowing integration tests to run against the exact PostgreSQL version and driver adapter configuration used in production.

---

### Phase 2: Lead Validation, LeadService Implementation & Integration Tests
- **Date:** 2026-11-05 (Afternoon, ~16:19 IST)
- **Task:** Implementation and verification of lead input validation schemas (`src/lib/validations/lead.ts`), unit tests (`tests/unit/lead-validation.test.ts`), core lead domain service (`src/services/lead/lead.service.ts`), and end-to-end integration tests (`tests/integration/lead-service.test.ts`) against the isolated Neon test branch.
- **Git Commit Hash:** Uncommitted (Working tree change).

#### 1. Problem & Requirements Addressed
ENQUIVO receives leads from four distinct channels: Property Portals, Social Media Ads, Website, and Hoarding Calls. The service requirements:
1. **Normalization & Sanitization:** Strict phone normalization into E.164 format (`+91...`), case-insensitive email sanitization (lowercase, trimmed), and collision-resistant human-readable lead code generation (`LD-[A-Z0-9]{5}-[A-Z0-9]{8}`).
2. **Duplicate Detection & Multi-Touch Attribution:** When an existing lead submits information through a second channel (e.g. Hardik Patel submitting via Property Portal and subsequently responding to a Facebook ad), recognize the returning buyer by phone, strictly preserve the immutable original acquisition source (`Lead.source`), and append the new touchpoint to the audit ledger (`LeadSourceEvent`).
3. **Non-Destructive Conditional Enrichment:** Populate missing fields (email, configuration, project preference) when provided by returning leads without ever overwriting or clobbering existing non-null data under concurrent ingestion.
4. **PostgreSQL Concurrency & Transaction Abort Recovery:** Handle simultaneous duplicate submissions gracefully:
   - Handle unique index violations (`P2002`) on `Lead.phone` outside the aborted interactive transaction block, fetching the winning committed record and merging in a fresh transaction.
   - Discriminate phone collisions from `lead_code` collisions, handling the latter with a bounded retry loop.
5. **DPDP Act 2023 Digital Consent & Opt-Out Invariance:** Enforce explicit affirmative consent (`affirmed: true`). Guarantee that routine web form submissions never silently re-opt-in a lead who previously exercised their DPDP right to opt out (`optedOut: true`).

#### 2. Why We Chose This Approach
- **PostgreSQL `ON CONFLICT` Upsert for Consent over In-Transaction Try/Catch:** In PostgreSQL, any statement that violates a unique constraint (error `23505`) aborts the entire transaction block. An initial draft attempted to catch `P2002` inside the transaction and immediately issue `tx.consentRecord.findUnique()`. In PostgreSQL, this causes an immediate `current transaction is aborted, commands ignored until end of transaction block` error. We resolved this using atomic `tx.consentRecord.upsert({ where: { leadId }, create: ..., update: {} })`. PostgreSQL executes this via `INSERT ... ON CONFLICT ("lead_id") DO UPDATE / DO NOTHING`, preventing constraint aborts completely while preserving prior consent history and opt-out state.
- **Out-of-Transaction P2002 Recovery for Phone Collisions:** When two concurrent requests for an unknown phone number execute `tx.lead.create` simultaneously, one transaction wins and the other is rejected by PostgreSQL's unique constraint on `phone`. Because the failing transaction is dead, `LeadService` catches `P2002` outside `this.db.$transaction`, queries the winning committed lead via `this.db.lead.findFirst`, and executes the merge in a fresh transaction.
- **Atomic Conditional Updates (`updateMany`) over In-Memory Read-Modify-Write:** In-memory checks (`if (!lead.email) lead.email = input.email; await tx.lead.update(...)`) are vulnerable to race conditions where two concurrent requests overwrite each other. Using `tx.lead.updateMany({ where: { id: existing.id, email: null, deletedAt: null }, data: { email } })` guarantees that only unpopulated database columns are updated; concurrent writes safely affect 0 rows.
- **Transaction Timeout Hardening for Cloud Latency (`P2028`):** Prisma's default transaction acquisition timeout (`maxWait: 2000`) is easily exceeded when multiple interactive transactions contend for pooled connections across WAN network latencies to Neon. Configuring `{ maxWait: 10000, timeout: 15000 }` eliminates spurious `P2028` failures during concurrent ingestion.

#### 3. Implementation Summary
- **Validation Layer (`src/lib/validations/lead.ts`):** Authored strict phone validation enforcing regex allow-list `/^\+?[\d\s\-()]+$/`, single leading `+`, and E.164 formatting; email trimming and lowercasing; `generateLeadCode()` combining `LD-`, base-36 timestamp, and 8-character random hex from `crypto.randomUUID()`; and Zod schemas (`ingestLeadSchema`, `consentInputSchema`).
- **Unit Tests (`tests/unit/lead-validation.test.ts`):** 20 unit tests verifying valid phone formatting, invalid character rejection, zero-only rejection, lowercase email normalization, lead code formatting, and strict DPDP `affirmed: true` enforcement (100% statement and line coverage, 97.9% branch coverage).
- **Domain Service (`src/services/lead/lead.service.ts`):** Implemented `LeadService` with constructor dependency injection (`constructor(private db: PrismaClient = defaultPrisma)`), `ingestLead()`, atomic conditional enrichment (`executeMerge`), out-of-transaction phone `P2002` recovery, bounded retry loop for `lead_code`, atomic `ConsentRecord` upsert with `update: {}`, and query helpers (`getLeadById`, `getLeadByPhone`).
- **Integration Tests (`tests/integration/lead-service.test.ts`):** 5 integration tests against isolated Neon test branch (`ep-mute-butterfly-b3a54tpa`):
  1. New lead creation with initial `LeadSourceEvent` touchpoint.
  2. Duplicate phone ingestion retaining first-touch `Lead.source` while appending `LeadSourceEvent`.
  3. Conditional enrichment populating missing fields without overwriting existing data.
  4. Concurrent ingestion of the same phone via `Promise.all` (exactly 1 Lead, 2 source events, zero uncaught errors).
  5. DPDP consent creation and strict opt-out preservation on subsequent re-ingestion.
  - Strict cleanup in `afterAll` tracking exact `createdLeadIds` and deleting child records (`ConsentRecord`, `LeadSourceEvent`) before parent `Lead`, cleanly calling `disconnectTestPrisma()`.

#### 4. Important Files Created / Modified
- `src/lib/validations/lead.ts` — Normalization utilities, lead code generator, and Zod schemas.
- `src/services/lead/lead.service.ts` — Core `LeadService` domain logic.
- `tests/unit/lead-validation.test.ts` — 20 unit tests for lead validation and generation.
- `tests/integration/lead-service.test.ts` — 5 integration tests against isolated Neon test branch.
- `docs/PROJECT_STATE.md`, `docs/TDD_DRAFT.md`, `docs/ENGINEERING_LOG.md` — Documentation synchronization.

#### 5. Technical Concepts Learned
- **PostgreSQL Transaction Abort States:** In PostgreSQL, an interactive transaction block (`BEGIN ... COMMIT`) cannot recover from a constraint failure inside the same block; subsequent queries on the transaction client fail with `current transaction is aborted`. Concurrency recovery must catch the error outside the failed transaction and query via an independent client connection.
- **Prisma Interactive Transaction Timeouts:** The distinction between `maxWait` (time allowed to acquire a connection from the pool before starting `BEGIN`) and `timeout` (maximum duration of the transaction execution). In serverless/cloud environments like Neon, network latency requires adjusting `maxWait`.
- **PostgreSQL `ON CONFLICT DO UPDATE / DO NOTHING` Semantics:** Prisma's `upsert` translates to `INSERT ... ON CONFLICT ("lead_id") DO UPDATE ...`. Providing `update: {}` acts as a no-op on conflict, executing atomically inside PostgreSQL without raising a unique violation error.
- **Non-Destructive Atomic SQL Updates:** Using `updateMany` with a `WHERE field IS NULL` clause provides safe, concurrency-proof conditional enrichment without optimistic locking versions.

#### 6. Challenges Encountered & Resolutions
- *Challenge 1 (Silent stripping of letters in phone normalization):* Early regex normalization stripped non-digits before validating characters, causing invalid strings like `"98765abc43210"` to silently turn into valid numbers.
  *Resolution:* Enforced a strict regex allow-list `/^\+?[\d\s\-()]+$/` before stripping formatting characters, rejecting alphabetic characters and misplaced plus signs upfront.
- *Challenge 2 (PostgreSQL transaction abort on concurrent consent):* An initial proposal attempted to catch `P2002` inside `executeMerge` on `tx.consentRecord.create` and immediately issue `tx.consentRecord.findUnique`. In PostgreSQL, `tx` was already aborted, causing `findUnique` to throw.
  *Resolution:* Replaced `try/catch` with `tx.consentRecord.upsert({ where: { leadId }, create: ..., update: {} })`. PostgreSQL handles this natively via `ON CONFLICT`, eliminating transaction aborts.
- *Challenge 3 (Prisma P2028 timeout under parallel execution):* Running two concurrent `$transaction` calls via `Promise.all` across WAN to Neon exceeded Prisma's default 2,000 ms `maxWait`, throwing `Unable to start a transaction in the given time`.
  *Resolution:* Configured `{ maxWait: 10000, timeout: 15000 }` on `this.db.$transaction`.
- *Challenge 4 (Lead code length mismatch in test assertion):* `generateLeadCode()` produces an 8-character random hex suffix (`randomUUID().slice(0, 8)`), but the test regex initially asserted `{6}` characters.
  *Resolution:* Corrected the test assertion regex to `/^LD-[A-Z0-9]{5}-[A-Z0-9]{8}$/`.

#### 7. Verification Performed & Results
- `npm test` — ✅ PASS (38/38 unit tests passed across 2 files: `serializers.test.ts` [18] and `lead-validation.test.ts` [20])
- `npm run test:integration` — ✅ PASS (9/9 integration tests passed across 2 files: `db-connection.test.ts` [4] and `lead-service.test.ts` [5] against `ep-mute-butterfly-b3a54tpa`)
- `npm run lint` — ✅ PASS (0 errors, 0 warnings)
- `npx tsc --noEmit` — ✅ PASS (0 errors)
- `npm run build` — ✅ PASS (Next.js 16.4.4 Turbopack build succeeded, 4/4 static pages prerendered in 2.3s)

#### 8. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Caught the flawed proposal to query an aborted transaction client inside `executeMerge` and mandated out-of-transaction recovery; mandated conditional SQL updates (`updateMany`) over in-memory read-modify-write; enforced strict phone character validation allow-lists over silent stripping; mandated explicit `affirmed: true` flag for DPDP consent and non-reversal of opt-out; reviewed all test assertions and isolation teardown safety.
- **AI Assistance:** Implemented validation functions and Zod schemas, authored `LeadService` methods under developer architectural constraints, wrote 20 unit tests and 5 integration tests, diagnosed the `P2028` cloud latency timeout, and maintained documentation synchronization.

#### 9. Interview Preparation & Defense
- **How to explain this in an interview:** *"In Milestone 3 Phase 2, we implemented the lead ingestion pipeline for ENQUIVO. Real estate leads originate from multiple channels—portals, social ads, website, and hoardings. The primary technical challenge was handling concurrency and attribution integrity. When an existing buyer returns through a new channel, we preserve immutable first-touch attribution (`Lead.source`) while recording subsequent touches in an append-only `LeadSourceEvent` ledger. To prevent lost updates during concurrent submissions, missing fields are enriched using atomic conditional updates (`updateMany where email is null`). If two requests for the same new phone arrive simultaneously, one wins and the loser catches PostgreSQL's `23505` (`P2002`) unique violation outside the dead transaction, queries the winner via our connection pool, and merges in a fresh transaction. For DPDP digital consent, we enforce affirmative consent (`affirmed: true`) and use PostgreSQL `ON CONFLICT` upserts with empty update payloads, ensuring routine web submissions never silently override a customer's prior opt-out."*
- **Likely Interview Question 1:** *What happens in PostgreSQL if you catch a unique constraint violation inside an interactive transaction block and attempt to continue querying?*
- **Technical Answer:** *In PostgreSQL, once any SQL statement inside a transaction block raises an error (such as code 23505 unique_violation), the transaction enters an `ABORTED` state. Any subsequent SQL statement sent over that same connection—even a simple `SELECT`—will fail with `ERROR: current transaction is aborted, commands ignored until end of transaction block`. The only operations PostgreSQL permits at that point are `ROLLBACK` (or rolling back to a previous `SAVEPOINT`). Therefore, application logic cannot recover by querying the database on the failed transaction client (`tx`). Concurrency recovery must allow the interactive transaction to roll back, catch the error outside `$transaction`, and issue subsequent queries on a healthy client connection or in a fresh transaction.*
- **Likely Interview Question 2:** *Why is `LeadSourceEvent` append-only, and what is its main limitation in an MVP?*
- **Technical Answer:** *`LeadSourceEvent` functions as an audit ledger recording every channel interaction a buyer has with our marketing channels. This is essential for first-touch and multi-touch ROI attribution. However, in our MVP schema, `LeadSourceEvent` lacks an external delivery ID (such as `webhookEventId`) or a composite unique index on `[leadId, source, campaign, occurredAt]`. Consequently, if a marketing webhook (e.g. from Meta Ads or MagicBricks) experiences a network retry and delivers the exact same payload twice, our service will append two source event records. We documented this as an explicit MVP trade-off: in early stages, capturing duplicate touchpoints is preferable to dropping real interactions, while production hardening in M6/M7 will introduce webhook idempotency tables.*
- **Key Engineering Trade-off:** Atomic Conditional Updates (`updateMany`) vs. Optimistic Concurrency Control (`@version`). Optimistic locking requires adding an integer version column to `Lead` and rolling back the transaction if the version changed between read and write, requiring an application retry loop. Conditional SQL updates (`UPDATE leads SET email = $1 WHERE id = $2 AND email IS NULL`) achieve non-destructive field enrichment in a single database round-trip without application retry loops or extra version columns.

---

### Phase 3: BookingService Implementation, Concurrency Defense & Integration Tests
- **Date:** 2026-11-05 (Late Afternoon, ~18:05 IST)
- **Task:** Implementation and verification of booking validation schemas (`src/lib/validations/booking.ts`), domain service (`src/services/booking/booking.service.ts`), and end-to-end integration tests (`tests/integration/booking-service.test.ts`) against the isolated Neon test branch. Independent code review determination: **APPROVED**.
- **Git Commit Hash:** Uncommitted (Working tree change).

#### 1. Problem & Requirements Addressed
Appointment scheduling in residential real estate requires strict concurrency guarantees, temporal validity, and compliance with cancellation and attendance audits:
1. **Atomic Double-Booking Prevention:** Guarantee that concurrent requests for the same appointment slot cannot result in duplicate confirmed bookings or corrupted slot states.
2. **Active Lead Verification:** Enforce that bookings are only permitted for active leads (`deletedAt: null`).
3. **Temporal Validity & Relative Reminder Scheduling:** Ensure slots whose start time has already passed cannot be booked. Automatically stage pre-visit reminders (24-hour and 2-hour) relative to `startsAt`, while omitting any reminder whose scheduled execution time is in the past.
4. **Non-Destructive Cancellation:** Ensure cancelled bookings retain their historical `SiteVisit` row in PostgreSQL for marketing attribution (`bookingStatus = CANCELLED`, `cancelledAt = NOW()`), release `VisitSlot` back to `AVAILABLE` only if its start time remains in the future, and delete only `PENDING` reminder jobs without misusing `FAILED`.
5. **Decoupled Attendance Recording:** Support recording attendance (`ATTENDED` vs. `NO_SHOW`) for both `CONFIRMED + UNRECORDED` visits (once the visit has started) and `COMPLETED + UNRECORDED` visits (such as historical seed data), without altering `VisitSlot` status or permitting double recording.

#### 2. Why We Chose This Approach
- **Atomic Conditional Slot Update (`updateMany`) over Read-Modify-Write:** An in-memory check (`if (slot.status === 'AVAILABLE')`) is susceptible to lost updates when two requests read simultaneously. Executing `UPDATE visit_slots SET status = 'BOOKED' WHERE id = $1 AND status = 'AVAILABLE' AND starts_at > NOW()` within a Prisma transaction ensures row-level locking at the database level. Exactly one transaction updates 1 row; concurrent attempts update 0 rows and immediately receive `SlotUnavailableError`.
- **Two-Layer Concurrency Defense:** PostgreSQL's partial unique index `one_active_booking_per_slot` (`WHERE booking_status = 'CONFIRMED'`) acts as an immutable database-level fallback behind the conditional update. Any collision raises error `23505` (`P2002`), which is caught and mapped to `SlotUnavailableError`.
- **Deleting Only PENDING Reminders over Marking FAILED:** `ReminderStatus` in Prisma schema comprises `PENDING`, `PROCESSING`, `SENT`, `FAILED`. Marking cancelled jobs as `FAILED` would corrupt delivery failure metrics and error logs. Deleting `PENDING` jobs cleans the dispatch queue safely, while historical `SENT` reminders remain intact.
- **Constructor Dependency Injection (`constructor(private db: PrismaClient = defaultPrisma)`):** Enables testing against the isolated Neon test branch (`testPrisma`) while keeping the production route handler singleton untouched.

#### 3. Implementation Summary
- **Validation Layer (`src/lib/validations/booking.ts`):** Authored Zod schemas (`getAvailableSlotsSchema`, `bookVisitSchema`, `cancelBookingSchema`, `recordAttendanceSchema`) and exported TypeScript types.
- **Domain Service (`src/services/booking/booking.service.ts`):** Implemented `BookingService` with custom error classes (`SlotUnavailableError`, `BookingNotFoundError`, `BookingConflictError`) and the 4 core methods:
  - `getAvailableSlots(input)`: Queries future `AVAILABLE` slots with optional date range filtering.
  - `bookVisit(input)`: Validates active lead, executes atomic conditional slot update, inserts `CONFIRMED` visit, and stages future pre-visit reminders (24h and 2h).
  - `cancelBooking(input)`: Validates `CONFIRMED` status, sets `CANCELLED` and `cancelledAt`, releases future slots to `AVAILABLE`, and deletes `PENDING` reminders.
  - `recordAttendance(input)`: Validates visit is not `CANCELLED` and attendance is `UNRECORDED`, enforces post-start timing for `CONFIRMED` visits, transitions to `COMPLETED`, records `attendedAt` for `ATTENDED`, and preserves slot status.
- **Integration Tests (`tests/integration/booking-service.test.ts`):** Authored 5 integration tests against isolated Neon test branch (`ep-mute-butterfly-b3a54tpa`):
  1. Successful booking, slot reservation, and reminder staging (24h & 2h).
  2. Concurrent booking race condition via `Promise.all` (1 succeeds, 1 gets `SlotUnavailableError`).
  3. Cancellation, future slot release, and deletion of pending reminder jobs.
  4. Rebooking a released slot with a second lead while preserving historical cancelled visit.
  5. Past-slot rejection and attendance recording for both confirmed visits and historical completed visits.
- **Teardown Safety:** Tracked created `slotIds`, `visitIds`, and `leadIds` in sets; cleaned up child records (`ReminderJob`, `SiteVisit`) before parent records (`VisitSlot`, `Lead`) in `afterAll`.

#### 4. Important Files Created / Modified
- `src/lib/validations/booking.ts` — Validation schemas and types for booking operations.
- `src/services/booking/booking.service.ts` — Core `BookingService` domain logic.
- `tests/integration/booking-service.test.ts` — 5 integration tests against isolated Neon test branch.
- `docs/PROJECT_STATE.md`, `docs/TDD_DRAFT.md`, `docs/ENGINEERING_LOG.md` — Documentation synchronization.

#### 5. Technical Concepts Learned
- **PostgreSQL Row-Level Locking in Conditional Updates:** How `UPDATE ... WHERE status = 'AVAILABLE'` acquires an exclusive row lock in PostgreSQL during evaluation, serializing concurrent writes without requiring explicit pessimistic locking (`SELECT ... FOR UPDATE`).
- **Partial Unique Index as Fallback Lock:** How a filtered index `WHERE (booking_status = 'CONFIRMED')` allows multiple historical records to exist on the same `slot_id` while strictly preventing duplicate active reservations.
- **Relative Scheduling Bounds:** Filtering reminder generation with `if (scheduledTime > now)` avoids staging obsolete jobs when visits are booked on short notice (e.g. booked 12 hours before visit, where the 24h reminder is already past).

#### 6. Challenges Encountered & Resolutions
- *Challenge 1 (ESLint unused import and explicit any):* In `tests/integration/booking-service.test.ts`, `beforeAll` was imported but unused, and `PromiseFulfilledResult<{ visit: any; slot: any }>` triggered `@typescript-eslint/no-explicit-any`.
  *Resolution:* Removed unused `beforeAll` import and replaced `any` with `Awaited<ReturnType<typeof bookingService.bookVisit>>`.
- *Challenge 2 (Independent Code Review Observation on P2002 target):* Code review noted that catching `P2002` could theoretically catch non-slot unique constraint violations if other models collided.
  *Resolution:* Reviewed and noted as low severity: `visit.id` is a newly generated `cuid()` and reminder idempotency keys are scoped to that unique ID, making non-slot collisions impossible in practice; the primary gate (`updateMany`) catches 100% of slot collisions prior to insert.

#### 7. Verification Performed & Results
- `npm test` — ✅ PASS (38/38 unit tests passed across 2 files: `serializers.test.ts` [18] and `lead-validation.test.ts` [20])
- `npm run test:integration` — ✅ PASS (14/14 integration tests passed across 3 files: `db-connection.test.ts` [4], `lead-service.test.ts` [5], and `booking-service.test.ts` [5] against `ep-mute-butterfly-b3a54tpa`)
- `npm run lint` — ✅ PASS (0 errors, 0 warnings)
- `npx tsc --noEmit` — ✅ PASS (0 errors)
- `npm run build` — ✅ PASS (Next.js 16.4.4 Turbopack build succeeded, 4/4 static pages prerendered in 3.1s)
- **Independent Code Review:** **APPROVED** (all 10 review checklist criteria satisfied).

#### 8. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Reviewed and approved `BookingService` architecture and state machine specifications; required alignment with existing `LeadService` DI convention; rejected unsupported cancellation reasons; specified clean deletion of `PENDING` reminders to prevent misusing `FAILED`; mandated attendance support for both `CONFIRMED + UNRECORDED` and `COMPLETED + UNRECORDED` visits; performed independent code review with determination APPROVED; and mandated document synchronization boundaries.
- **AI Assistance:** Implemented validation schemas, authored `BookingService` with conditional updates and temporal guards, authored 5 integration tests against the isolated test branch, fixed ESLint typing warnings, executed verification suites, and updated documentation.

#### 9. Interview Preparation & Defense
- **How to explain this in an interview:** *"In Milestone 3 Phase 3, we implemented the booking lifecycle engine for ENQUIVO. Double-booking prevention in real estate is a mission-critical reliability requirement. We solved this using a two-layer defense: first, an atomic conditional update (`UPDATE visit_slots SET status = 'BOOKED' WHERE id = $1 AND status = 'AVAILABLE' AND starts_at > NOW()`) inside a Prisma transaction, which guarantees that only one concurrent request can reserve the slot; and second, our PostgreSQL partial unique index on `site_visits(slot_id) WHERE booking_status = 'CONFIRMED'`, which enforces single-active-booking integrity at the database engine level. On cancellation, the slot is released only if it is still in the future, while the historical `SiteVisit` record is preserved for marketing attribution. To prevent cancelled visits from receiving reminders, we delete only `PENDING` queue items rather than misusing the `FAILED` status. Finally, attendance recording supports both confirmed visits after their start time and historical completed visits, transitioning the booking to `COMPLETED` and recording `attendedAt` without modifying the slot status."*
- **Likely Interview Question 1:** *Why do you execute an atomic conditional update if you already have a partial unique index on `SiteVisit`?*
- **Technical Answer:** *Separation of concerns and optimal resource utilization. The `VisitSlot` is the calendar inventory item, while `SiteVisit` is the reservation agreement. If we relied solely on the partial unique index on `SiteVisit`, two concurrent requests would both successfully update `VisitSlot.status = 'BOOKED'`, and then the loser's transaction would abort during the `SiteVisit` insert. The loser's rollback would leave the slot booked by the winner, but the database connection was held longer and threw an unhandled constraint exception. By performing `updateMany({ where: { status: 'AVAILABLE' } })` as the primary gate, the loser fails immediately on row-count check (`count === 0`) before attempting to insert child records, while the partial unique index remains an immutable fallback against application-level race conditions.*
- **Likely Interview Question 2:** *Why shouldn't you mark cancelled reminders as `FAILED` in the database?*
- **Technical Answer:** *Domain semantic purity and observability. In operational message queuing, `FAILED` indicates a technical delivery failure (such as an invalid phone number, gateway timeout, or SMS network rejection) after exhausting retry attempts. If cancelled appointments marked their scheduled reminders as `FAILED`, operational dashboards and dead-letter queue monitors would show false spikes in messaging errors, misleading engineering and support teams. Deleting `PENDING` reminder jobs completely cleans the dispatch pipeline, while leaving historical `SENT` reminders intact for auditability.*
- **Key Engineering Trade-off:** Deleting `PENDING` reminders vs. Adding a `CANCELLED` status to `ReminderStatus`. Adding `CANCELLED` requires altering the PostgreSQL enum via a database migration. In an MVP architecture where `ReminderJob` acts as an ephemeral execution queue with foreign key cascade to `SiteVisit`, deleting pending jobs achieves the identical operational outcome with zero database downtime or schema migrations.

---

## Unverified Historical Information Register

In accordance with strict verification rules, the following details cannot be independently verified from the repository git log and are explicitly recorded as unverified assumptions:
1. **Developer Interactive Work Duration:** Exact hours and minutes spent during interactive design discussions for Milestones 1 and 2 were not tracked by an automated time-tracking utility. Timestamps recorded represent Git commit times (`%cd`).
2. **Initial Repository Creation:** Git commit `e7ffd4b` on 2026-11-03 13:43:55 IST is the root commit (`Create Next App`). Pre-scaffold brainstorming or local setup prior to that commit is not recorded in version control.
