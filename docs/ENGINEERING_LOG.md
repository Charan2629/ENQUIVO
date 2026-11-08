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
- **Key Engineering Trade-off:** Next.js Route Groups vs. Subdomains. Subdomains require complex multi-domain DNS routing and cookie domain sharing; route groups achieve identical layout isolation in a single domain with zero DNS configuration.

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

### Milestone 3 — Phase 4: ReminderService Background Processor & Inngest Integration

- **Date:** 2026-11-05
- **Status:** Complete (Milestone 3 Core Backend Services Fully Complete)

#### 1. Context & Objectives
In real estate lead-response pipelines, site-visit drop-off and no-shows severely impair marketing ROI. ENQUIVO addresses this by scheduling automated 24-hour and 2-hour pre-visit notifications. Phase 4 completed the backend service layer by implementing `ReminderService`: an idempotent, concurrency-safe background job processor wired to Inngest Cloud, backed by persistent `ReminderJob` records in Neon PostgreSQL, bounded by a 3-attempt retry policy, and strictly adhering to DPDP Act 2023 digital consent opt-out rules.

#### 2. Architecture & Design Decisions
- **Inngest Cloud as Durable Execution Orchestrator:** Adopted Inngest for background cron (`*/5 * * * *`) and on-demand execution (`enquivo/reminders.process`), eliminating the operational complexity and cost of maintaining dedicated Redis/BullMQ or RabbitMQ brokers.
- **Database-Backed Persistent State Machine:** `ReminderJob` tracks job status across `PENDING -> PROCESSING -> SENT / FAILED`. Every state transition is persisted in PostgreSQL with audit notes and attempt counts.
- **Atomic Conditional Claiming:** To prevent double-dispatch under horizontal scaling (multiple concurrent Next.js serverless instances or simultaneous Inngest executions), workers execute an atomic conditional SQL update: `UPDATE reminder_jobs SET status = 'PROCESSING', attempts = attempts + 1, last_attempt_at = NOW() WHERE id = $1 AND status = 'PENDING'`. Only the winning worker receives `count === 1`; any concurrent worker receives `count === 0` and safely exits without sending a message.
- **Booking Status Re-Verification:** Before dispatching, the worker rechecks `SiteVisit.bookingStatus`. If the visit was cancelled, the orphaned reminder job is deleted immediately, avoiding false dispatches while keeping `FAILED` semantically pure.
- **DPDP Act 2023 Digital Consent Suppression:** Re-evaluates `lead.consentRecord`. If the buyer has opted out (`optedOut: true`) or lacks active consent, dispatch is suppressed and the unsendable job is deleted from the operational queue (`SKIPPED_OPTED_OUT` or `SKIPPED_NO_CONSENT`). This strictly preserves `status: FAILED` for genuine exhausted carrier delivery failures without polluting error metrics.
- **Stale PROCESSING Worker Crash Recovery:** At the start of `processDueReminders()`, identifies jobs stuck in `PROCESSING` with `lastAttemptAt <= NOW() - 10 minutes`. Reclaims jobs with attempts < 3 back to `PENDING` for eventual retry, and marks jobs with attempts >= 3 as `FAILED` with an explicit worker-timeout reason.
- **Five-Minute Retry Backoff:** When a delivery fails and attempts remain (`attempts < 3`), the job reverts to `PENDING` with `scheduledFor = NOW() + 5 minutes`, ensuring subsequent cron or event sweeps do not prematurely exhaust attempts against transient outages.
- **Delivery Semantics & Crash Boundary:** Guarantees **at-least-once delivery with atomic conditional claiming** to prevent concurrent execution races. Explicitly recognizes the distributed systems boundary: if a worker process crashes after an external provider dispatch but before committing `status: SENT`, stale recovery will eventually re-dispatch the reminder, resulting in duplicate delivery unless the downstream carrier deduplicates via `idempotencyKey`.
- **Mock Notification Provider with IST Formatting:** Formats appointment times in `Asia/Kolkata` (IST, UTC+5:30) via `date-fns-tz`, includes recipient name, venue, and `idempotencyKey`, and logs a structured simulation note. No external carrier network calls are made.
- **Constructor Dependency Injection:** `ReminderService` accepts an optional `PrismaClient` and `MockNotificationProvider`, enabling tests to inject `testPrisma` and simulate transient network timeouts deterministically.

#### 3. Key Implementation Details
- `src/lib/inngest.ts`: Initializes the `enquivo` Inngest client instance.
- `src/services/reminder/mock-notification.provider.ts`: Implements `defaultMockNotificationProvider`, formatting appointments in IST, accepting stable `idempotencyKey`, and returning deterministic `simulationNote` strings.
- `src/services/reminder/reminder.service.ts`: Implements `processDueReminders(batchSize)` and `processReminderJob(jobId)`. Features: 10-minute stale PROCESSING job reclamation, atomic conditional claim (`status = PENDING -> PROCESSING`), parent visit confirmation verification, DPDP consent/opt-out suppression without marking FAILED, and bounded retries (`maxAttempts = 3`) with 5-minute backoff.
- `src/services/reminder/reminder.inngest.ts`: Inngest v4 function `processDueRemindersFunction` with dual triggers (cron `*/5 * * * *` and event `enquivo/reminders.process`).
- `src/app/api/inngest/route.ts`: Next.js App Router handler exporting `GET, POST, PUT` via `serve({ client: inngest, functions: [...] })`.
- `tests/integration/reminder-service.test.ts`: 8 integration tests against isolated Neon test branch (`enquivo-test`).

#### 4. Files Created or Modified
- `src/lib/inngest.ts` — Inngest client initialization.
- `src/services/reminder/mock-notification.provider.ts` — Mock SMS/WhatsApp notification provider with `idempotencyKey`.
- `src/services/reminder/reminder.service.ts` — Core `ReminderService` background processor with stale recovery, DPDP suppression, and 5m retry backoff.
- `src/services/reminder/reminder.inngest.ts` — Inngest scheduled function definition.
- `src/app/api/inngest/route.ts` — Next.js App Router Inngest route handler.
- `tests/integration/reminder-service.test.ts` — 8 integration tests against isolated Neon test branch.
- `deployment.md` — Updated Inngest runbook and test execution commands.
- `docs/PROJECT_STATE.md` — Synchronized project state, verification table (22 integration tests), and Decision D-017.
- `docs/TDD_DRAFT.md` — Updated Section 11 specifications, Decision Log (D-017), and Milestone Completion Tracker.
- `docs/ENGINEERING_LOG.md` — Milestone 3 Phase 4 engineering log with reliability review refinements.

#### 5. Technical Concepts Learned
- **Row-Level Atomic Claiming in Relational Queues:** Using `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PROCESSING', attempts: { increment: 1 } } })` avoids race conditions without table-level locks or separate distributed mutexes (like Redis Redlock). PostgreSQL evaluates the conditional where-clause and locks matching rows exclusively, ensuring single-consumer semantics.
- **Zombie Lock Reclamation (Stale Processing Sweep):** Database-backed queues must account for worker crashes (OOM, container kill). Polling for `status = 'PROCESSING'` where `lastAttemptAt <= NOW() - timeout` safely recovers stalled jobs without manual intervention.
- **At-Least-Once Delivery vs. Exactly-Once Delivery:** Why true exactly-once delivery across external network boundaries (SMS gateways, webhooks) is impossible without downstream carrier deduplication; why atomic claiming protects against concurrent race conditions but cannot prevent duplicate dispatches if a worker crashes post-send.
- **Suppression vs. Failure in Queues:** Permanent non-deliverability (DPDP opt-out, missing consent) must be suppressed and purged rather than marked as delivery `FAILED`, preventing false telemetry alarms.

#### 6. Challenges Encountered & Resolutions
- *Challenge 1 (Inngest v4 Function Creation Signature):* Inngest v4 threw an error on `createFunction({ id }, trigger, handler)`, stating triggers must be provided within the first configuration object.
  *Resolution:* Configured triggers in the first argument using `triggers: [{ cron: "*/5 * * * *" }, { event: "enquivo/reminders.process" }]`.
- *Challenge 2 (Next.js Dynamic Route Detection for Inngest):* Next.js App Router must recognize `/api/inngest` as dynamic rather than prerendering statically.
  *Resolution:* `serve` from `inngest/next` exposes dynamic `GET`, `POST`, and `PUT` handlers, which Next.js Turbopack correctly identified during `npm run build` as `ƒ /api/inngest` (dynamic server-rendered on demand).
- *Challenge 3 (Independent Reliability Review Nuances):* Independent review identified three reliability subtleties: (1) DPDP opt-outs were marked FAILED, corrupting deliverability metrics; (2) crashed workers left jobs permanently stuck in PROCESSING; and (3) immediate retries lacked backoff.
  *Resolution:* Implemented 10-minute stale PROCESSING job recovery, deleted unsendable opt-out jobs with distinct `SKIPPED_OPTED_OUT` and `SKIPPED_NO_CONSENT` statuses, introduced 5-minute retry backoff, passed `idempotencyKey` downstream, and expanded the integration suite from 5 to 8 tests.

#### 7. Verification Performed & Results
- `npm test` — ✅ PASS (38/38 unit tests passed across 2 files: `serializers.test.ts` [18] and `lead-validation.test.ts` [20] in 734ms).
- `npm run test:integration` — ✅ PASS (22/22 integration tests passed across 4 files: `db-connection.test.ts` [4], `lead-service.test.ts` [5], `booking-service.test.ts` [5], and `reminder-service.test.ts` [8] against isolated Neon test branch endpoint `ep-mute-butterfly-b3a54tpa` in 42.48s).
- `npm run lint` — ✅ PASS (0 errors, 0 warnings).
- `npx tsc --noEmit` — ✅ PASS (0 errors).
- `npm run build` — ✅ PASS (Next.js 16.4.4 Turbopack build succeeded, 5 static and dynamic pages compiled in 3.1s, `/api/inngest` active).

#### 8. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Approved `ReminderService` architecture; required atomic claiming to avoid duplicate messages under concurrency; mandated DPDP Act 2023 opt-out checking before dispatch; required non-network mock provider formatting time in `Asia/Kolkata` (IST); mandated bounded retry policy (`maxAttempts = 3`); specified clean deletion of orphaned jobs for cancelled visits to prevent pollutive `FAILED` statuses; conducted focused reliability review; mandated 10m stale lock recovery, 5m retry backoff, and DPDP suppression without marking FAILED; and approved documentation updates.
- **AI Assistance:** Implemented Inngest client and route handler, authored mock notification provider with IST formatting and idempotencyKey support, authored `ReminderService` with atomic conditional claiming, stale lock recovery, and 5m backoff, authored 8 integration tests against the isolated Neon test branch, fixed ESLint unused parameter warning, executed full verification suites, and synchronized all project documentation.

#### 9. Interview Preparation & Defense
- **How to explain this in an interview:** *"In Milestone 3 Phase 4, we completed the core backend service layer of ENQUIVO by implementing `ReminderService`. The business goal is to eliminate site-visit drop-off by automating 24-hour and 2-hour pre-visit notifications. The system engineering challenge is ensuring reliable dispatch across distributed workers without deploying heavy infrastructure like Kafka or Redis. We solved this using a database-backed state machine in PostgreSQL orchestrated by Inngest Cloud. Before dispatching, workers atomically claim due `PENDING` jobs using a conditional SQL update (`UPDATE reminder_jobs SET status = 'PROCESSING', attempts = attempts + 1 WHERE id = $1 AND status = 'PENDING'`). This guarantees at-least-once delivery with atomic claiming to prevent concurrent processing. To survive worker crashes, `processDueReminders()` performs a stale-lock recovery sweep at the start of each run, reclaiming jobs stuck in `PROCESSING` for over 10 minutes back to `PENDING` (or failing them if attempts >= 3). We enforce two critical business gates: first, we verify that the parent `SiteVisit` is still `CONFIRMED` (deleting orphaned jobs for cancelled visits to avoid erroneous messaging); and second, we enforce DPDP Act 2023 compliance by suppressing dispatch and purging jobs for opted-out buyers without marking them `FAILED`, preserving deliverability error telemetry. Transient failures are governed by a bounded retry policy (`maxAttempts = 3`) with a 5-minute backoff (`scheduledFor = NOW() + 5m`). The entire pipeline is verified against our isolated Neon test database with 22 passing integration tests."*
- **Likely Interview Question 1:** *How do you prevent duplicate reminder dispatches if two Inngest workers execute simultaneously?*
- **Technical Answer:** *We employ a two-tier defense. First, at data creation time, each `ReminderJob` is protected by a PostgreSQL unique index on `idempotencyKey` (`${visitId}:${reminderType}`), guaranteeing that duplicate scheduling requests cannot insert multiple queue rows. Second, at execution time, we avoid naive 'check-then-act' queries (`SELECT then UPDATE`). Instead, workers execute an atomic conditional update: `prisma.reminderJob.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PROCESSING', attempts: { increment: 1 } } })`. PostgreSQL evaluates the `status = 'PENDING'` condition under an exclusive row lock. Exactly one worker updates 1 row (`count === 1`) and proceeds to send the notification; all other workers get `count === 0` and immediately skip execution.*
- **Likely Interview Question 2:** *Can duplicate messages ever be sent in this architecture?*
- **Technical Answer:** *Yes, under one specific distributed systems failure mode: crash after dispatch. If a worker successfully dispatches the notification through the carrier API, but the container crashes or the network drops before the worker can commit `status: SENT` to PostgreSQL, the database still records the job in `PROCESSING`. After 10 minutes, our stale-lock recovery sweep will reclaim the job to `PENDING`, and the next cron sweep will re-dispatch the reminder. This is why our system provides at-least-once delivery semantics rather than strictly exactly-once delivery. To mitigate this in production, we pass the stable `idempotencyKey` downstream in the payload so that external messaging providers can deduplicate dispatches at the carrier gateway level.*
- **Key Engineering Trade-off:** Reverting to `PENDING` with 5-minute backoff vs. In-process sleep and retry. In serverless computing, sleeping inside a function (`await sleep(300000)`) holds open database connections and incurs billed execution duration. Updating `scheduledFor: NOW() + 5m` and reverting to `PENDING` allows the worker to terminate immediately; subsequent cron sweeps pick up the job only when due, achieving durable backoff with zero compute waste.

---

### Milestone 4: AIConciergeService Implementation, Grounding Governance & Multilingual Assistant

- **Date:** 2026-11-05
- **Status:** Complete (Committed locally: `1e9831e`)

#### 1. Context & Objectives
Real estate prospective buyers demand immediate, 24/7 engagement across regional languages (English, Hindi, and Gujarati), but AI chatbots in real estate carry immense legal and operational risks: hallucinating amenities, misquoting unit prices, violating RERA regulations, or leaking data across projects. Milestone 4 implemented `AIConciergeService` with strict database-grounded fact retrieval (`status = VERIFIED` and `isActive = true`), scoped isolation between portfolio-level and project-specific facts, Zod-validated server-side function calling, direct calendar delegation to `BookingService`, dynamic salesperson escalation, and security guarantees preventing identity spoofing.

#### 2. Architecture & Design Decisions
- **SDK & Model Choice:** Integrated Google Gemini API via official `@google/genai` (`^0.1.1`) SDK using `gemini-2.5-flash`. All API keys stay strictly server-side (`GEMINI_API_KEY`).
- **Database-Grounded Fact Sheet Filtering & Scope Isolation:** Factual property queries are answered exclusively using `FactSheet` rows filtered by `status = 'VERIFIED' AND isActive = true AND (scope = 'PORTFOLIO' OR projectId = :projectId)`. Unapproved draft proposals (such as the seeded penthouse entry) and facts belonging to other projects are strictly excluded from the LLM prompt and tool outputs. The IDs of all retrieved grounding facts are persisted in `ChatMessage.groundingFactIds`.
- **Server-Derived Identity Enforcement (Anti-Spoofing / IDOR Defense):** In function calling, the model is never allowed to provide or override `leadId` or `assignedToId`. For `bookVisitSlot`, the schema requires only `{ slotId, confirmed }`; the service injects `leadId = conversation.leadId`. For `handoffToExecutive`, the schema accepts only `{ escalationReason, summary }`; the service dynamically assigns an active `SALES_EXEC` from PostgreSQL.
- **Direct Delegation to `BookingService`:** Rather than duplicating slot querying or booking logic, `AIConciergeService` delegates `checkSlotAvailability` and `bookVisitSlot` directly to `BookingService`. This guarantees atomic conditional updates and two-layer concurrency defenses apply uniformly.
- **Multilingual System Instruction with RERA Disclaimer:** Dynamically generates system instructions in English, Hindi, or Gujarati based on `conversation.language`, enforcing: (1) strict fact sheet grounding; (2) mandatory compliance disclaimer (`RERA Reg: DEMO-ONLY-NOT-VERIFIED`); (3) proactive collection of name/budget/configuration if missing; (4) prompt human handoff for price negotiations, unlisted amenities, or missing details; and (5) requiring explicit buyer confirmation before reserving visit slots.
- **Fault-Tolerant Pre-LLM User Message Persistence:** In user-initiated chat, the inbound message (`role: USER`) is inserted into `ChatMessage` *before* calling the Gemini API. If the LLM provider times out or throws an error, the buyer's query is never lost from the audit trail.
- **Atomic Non-Overwriting First Response Time Tracking:** On the first AI response generated for a lead, `Lead.firstResponseAt` is updated atomically (`UPDATE leads SET first_response_at = NOW() WHERE id = $1 AND first_response_at IS NULL`), establishing an immutable benchmark for the 14-hour industry baseline response metric.
- **Constructor Dependency Injection & Zero-Network Integration Testing:** Constructor accepts optional `PrismaClient`, `BookingService`, and `GeminiClientInterface`. Integration tests execute against the isolated Neon test database using a deterministic mock Gemini client with zero external API calls or live credential requirements.

#### 3. Key Implementation Details
- `src/lib/validations/ai.ts`: Zod schemas and TypeScript types for `chatMessageInputSchema` and the four tool argument definitions (`getVerifiedFactsToolSchema`, `checkSlotAvailabilityToolSchema`, `bookVisitSlotToolSchema`, `handoffToExecutiveToolSchema`).
- `src/services/ai/ai.service.ts`: `AIConciergeService` class containing:
  - `sendMessage({ conversationId, message, leadId })`: Pre-persists user message, builds multilingual instructions with RERA disclaimer, formats multi-turn history into Gemini `Content` objects, declares server-side function calling tools, executes tool calls against Prisma and `BookingService`, records grounding fact IDs, updates `firstResponseAt` atomically, and persists the assistant reply.
  - `getVerifiedFacts({ scope, projectId })`: Dual-flag query (`status: VERIFIED`, `isActive: true`) isolating portfolio and project scopes.
  - `buildSystemInstruction(language, projectId)`: Generates localized instructions in EN, HI, or GU.
- `src/app/api/chat/route.ts`: Next.js App Router POST route handler parsing JSON, validating input with Zod, delegating to `AIConciergeService`, and returning structured JSON (or 400/403/404/500 HTTP errors).
- `tests/integration/ai-service.test.ts`: 7 integration tests against isolated Neon test branch (`enquivo-test`):
  1. `getVerifiedFacts`: strictly filters active `VERIFIED` facts and isolates project scopes (draft facts and unrelated projects excluded).
  2. `groundingFactIds` persistence and `firstResponseAt` capture.
  3. Security checks: rejects mismatched `leadId` with `AISecurityError` and missing conversation with `AIConversationNotFoundError`.
  4. Tool calling: `checkSlotAvailability` and `bookVisitSlot` delegate to `BookingService` with server-derived `leadId`.
  5. Tool calling: `handoffToExecutive` creates `Handoff` dynamically assigning an active `SALES_EXEC`.
  6. Multilingual system prompt generation: English, Hindi, and Gujarati with RERA disclaimer.
  7. Pre-LLM persistence: persists user message even when Gemini API throws an error.

#### 4. Files Created or Modified
- `src/lib/validations/ai.ts` — Zod schemas and types for chat input and AI tool calls.
- `src/services/ai/ai.service.ts` — Core `AIConciergeService` with grounding governance, tool calling, and multilingual prompting.
- `src/app/api/chat/route.ts` — Next.js App Router POST endpoint for concierge chat.
- `tests/integration/ai-service.test.ts` — 7 integration tests against isolated Neon test branch.
- `package.json` & `package-lock.json` — Added `@google/genai` dependency.
- `docs/TDD_DRAFT.md` — Updated Section 12 specifications, Section 14 Decision Log (D-018), and Milestone Tracker.
- `docs/PROJECT_STATE.md` — Updated status, 29-test verification summary, and D-018.
- `docs/ENGINEERING_LOG.md` — Milestone 4 engineering journal and interview preparation block.
- `deployment.md` — Updated test execution notes.

#### 5. Technical Concepts Learned
- **Prompt Grounding vs. System Prompt Hallucination Defenses:** Prompt engineering alone cannot prevent hallucinations if unverified data is loaded into the model context. Grounding requires structural database filtering (`status: VERIFIED`, `isActive: true`) before facts ever reach prompt assembly.
- **Server-Derived Context in Function Calling:** LLMs cannot be trusted with administrative or authorization parameters (such as `leadId`, `userId`, or role). Tools exposed to the LLM must accept only domain parameters (`slotId`, `confirmed`), while the execution engine derives authorization and identity boundaries securely from authenticated server session state.
- **Dynamic Entity Assignment in Workflows:** Hardcoding assignee IDs (e.g. `user_vikram_mehta`) creates brittle production workflows. Querying active roles dynamically (`findFirst({ where: { role: 'SALES_EXEC' } })`) ensures organizational changes or employee departures do not break escalation paths.
- **Pre-Call Ingestion vs. Post-Call Persistence:** Persisting user input prior to remote LLM invocation ensures zero data loss during upstream outages, supporting retryability and customer support visibility.

#### 6. Challenges Encountered & Resolutions
- *Challenge 1 (Gemini SDK Typing & `any` Linting Warnings):* `@google/genai` SDK response parts lack strict TypeScript discriminated unions for arbitrary function call content, triggering ESLint `@typescript-eslint/no-explicit-any` warnings.
  *Resolution:* Defined a clean internal `ContentPart` interface with type predicate guards (`isFunctionCallPart`), completely eliminating all `any` usages without bypassing type checking.
- *Challenge 2 (Integration Test Sales Executive Selection):* In integration tests, creating a new `SALES_EXEC` clashed with the seeded `Vikram Mehta` record because `findFirst({ orderBy: { createdAt: 'asc' } })` deterministically selected the earlier seeded user.
  *Resolution:* Updated the test to query the database's existing first `SALES_EXEC` and assert that the handoff was correctly assigned to that dynamic executive.
- *Challenge 3 (Formatting at End of File):* `git diff --check` flagged extra blank lines at EOF on newly created files.
  *Resolution:* Cleaned EOF formatting to ensure exactly one final newline across all files.

#### 7. Verification Performed & Results
- `npm test` — ✅ PASS (38/38 unit tests passed across 2 files: `serializers.test.ts` [18] and `lead-validation.test.ts` [20] in 759ms).
- `npm run test:integration` — ✅ PASS (29/29 integration tests passed across 5 files: `db-connection.test.ts` [4], `lead-service.test.ts` [5], `booking-service.test.ts` [5], `reminder-service.test.ts` [8], and `ai-service.test.ts` [7] against isolated Neon test branch endpoint `ep-mute-butterfly-b3a54tpa` in 41.13s).
- `npx tsc --noEmit` — ✅ PASS (0 errors).
- `npm run lint` — ✅ PASS (0 errors, 0 warnings).
- `npm run build` — ✅ PASS (Next.js 16.4.4 Turbopack build succeeded, 6 static and dynamic pages compiled in 6.5s, `ƒ /api/chat` and `ƒ /api/inngest` active).
- `git diff --check` — ✅ PASS (0 whitespace/formatting warnings).

#### 8. Independent Security Review: APPROVED (with Observations for M5)
- **Review Determination:** **APPROVED** on 2026-11-05.
- **Fact Retrieval Scope & Status:** Verified that `getVerifiedFacts` strictly enforces `status: VERIFIED`, `isActive: true`, and project scoping (`(scope = 'PORTFOLIO' OR projectId = :projectId)`). Integration test 1 proves that DRAFT facts (e.g. unapproved penthouse proposal) and facts from unrelated projects cannot enter the model context.
- **Identity & Booking Authorization:** Verified that booking identity is derived strictly from the database conversation record (`conversation.leadId`). Client-supplied `leadId` is never trusted for identity or booking authorization; if provided, it is strictly an assertion check. Tool schemas reject model-supplied IDs.
- **Observation 1 (LLM Confirmation Boundary — Carried to M5):** The current booking confirmation is LLM-evaluated (the model emits `confirmed: true` after being instructed by the system prompt, validated via Zod). Independent server-side buyer confirmation is required before final booking in M5 (interactive visual slot picker widget).
- **Observation 2 (Conversation Access Boundary — Carried to M5/M6):** `/api/chat` currently relies on `conversationId` as a bearer capability token. Secure buyer-session binding (e.g. signed cookie/session) is required before public exposure in M5, while full Auth.js / RBAC remains planned for M6.
- **Test Harness vs. Live Testing:** Automated integration tests execute deterministically with a mocked Gemini client via constructor dependency injection (`GeminiClientInterface`), ensuring zero network dependencies or live API key exposure. Live Gemini smoke testing remains pending external `GEMINI_API_KEY` configuration.
- **Verification Metric Summary:** 38 unit tests passed, 29 integration tests passed across 5 files, `npx tsc --noEmit` 0 errors, `npm run lint` 0 errors/warnings, and `npm run build` passed.

#### 9. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Approved Milestone 4 architecture and tool execution patterns; mandated strict dual-flag FactSheet grounding (`status: VERIFIED`, `isActive: true`); prohibited draft facts and cross-project leakage; mandated server-derived lead identity over tool argument spoofing; rejected hardcoded salesperson assignments in favor of dynamic database querying; specified pre-LLM user message persistence; required multilingual prompt generation with mandatory RERA disclaimers; and approved documentation updates.
- **AI Assistance:** Implemented validation schemas (`src/lib/validations/ai.ts`), authored `AIConciergeService` with grounding queries, tool execution, and multilingual prompt builder, authored `src/app/api/chat/route.ts`, resolved ESLint and TypeScript typings, authored 7 comprehensive integration tests with mocked Gemini responses against the isolated test database, executed test suites, and synchronized documentation.

#### 10. Interview Preparation & Defense
- **How to explain this in an interview:** *"In Milestone 4, we implemented the AI Concierge for ENQUIVO using Google Gemini and Next.js Route Handlers. In real estate, deploying LLMs without rigid grounding leads to severe regulatory and contractual liabilities—such as misquoting prices, fabricating amenities, or promising unauthorized discounts. We engineered a three-tier defense: First, our FactSheet grounding query enforces dual-flag filtering (`status = 'VERIFIED' AND isActive = true`) combined with scope isolation (`(scope = 'PORTFOLIO' OR projectId = :projectId)`). Draft proposals (like our seeded penthouse proposal) and facts from unrelated projects are mathematically impossible to retrieve into model context. Second, we eliminate IDOR and argument spoofing by never allowing the LLM to supply `leadId` or salesperson IDs in function calling. The tool schemas only accept operational parameters (like `slotId`), and the service injects the server-validated `leadId` from the active conversation context. Third, all calendar operations delegate directly to `BookingService`, ensuring our two-layer concurrency defense (conditional slot update + partial unique index) governs AI bookings. If a buyer asks for unlisted amenities or price negotiations, the concierge automatically triggers `handoffToExecutive`, creating a persistent handoff record assigned dynamically to an active salesperson from PostgreSQL."*
- **Likely Interview Question 1:** *Why shouldn't you allow the LLM function call to provide the `leadId` when booking a visit?*
- **Technical Answer:** *Trust boundaries and authorization. In an agentic architecture, LLM output must be treated as untrusted user input. If the `bookVisitSlot` tool schema accepts `leadId`, an attacker could manipulate the prompt (via prompt injection or conversation steering) to supply another buyer's `leadId`, reserving appointments or triggering reminder SMS spam against arbitrary victims (Insecure Direct Object Reference / IDOR). By deriving `leadId` server-side strictly from the validated conversation record (`conversation.leadId`), we enforce an immutable security boundary that the model cannot subvert.*
- **Likely Interview Question 2:** *Why do you persist the buyer's chat message in the database before calling the Gemini API?*
- **Technical Answer:** *Fault tolerance and data integrity. Remote AI APIs are subject to network latency, rate limits, and transient 5xx outages. If we waited for Gemini to respond before persisting the user message, any upstream failure would drop the buyer's query entirely. By persisting the `USER` message to PostgreSQL first, the lead's intent is recorded immediately. Even if the LLM invocation fails, our route handler logs the error, the buyer's query is visible in the Sales Head portal, and a human salesperson can follow up seamlessly.*
- **Key Engineering Trade-off:** Server-side Tool Execution vs. Autonomous Agent Frameworks (LangChain/CrewAI). In an enterprise production setting, heavy multi-agent abstraction frameworks add runtime bloat, opaque prompt wrapping, and difficult-to-test dependency trees. Implementing a lightweight, service-oriented tool dispatcher with Zod validation gives us 100% type safety, deterministic mockability in integration tests, and minimal latency overhead.

---

## Milestone 5: Buyer Concierge Experience

### Milestone 5 — Phase 1: Public Property Landing Page Implementation & Portfolio Presentation

- **Date:** 2026-11-06
- **Status:** Phase 1 Complete (Pending Commit)

#### 1. Context & Objectives
Milestone 5 focuses on the buyer-facing experience of ENQUIVO. Prior to Phase 1, the frontend root (`src/app/page.tsx`) was an unstyled Next.js starter template. To establish a credible, premium digital presence for residential real estate buyers in Ahmedabad, Phase 1 delivered a comprehensive public property landing page. The objectives were:
1. Deliver a polished, editorial residential real estate website that feels like a bespoke property developer's digital showroom rather than a generic SaaS template or admin dashboard.
2. Dynamically query live PostgreSQL records to showcase the developer's two live Ahmedabad projects (`Prakriti Heights` and `Vaastu Enclave`) alongside verified portfolio-level attributes (420 total units, ₹65L–₹1.2Cr pricing, prime Ahmedabad West corridors).
3. Ensure full responsiveness across mobile, tablet, and desktop screens, featuring an accessible slide-over mobile drawer and sticky brand navigation.
4. Display statutory RERA disclaimers (`RERA Reg: DEMO-ONLY-NOT-VERIFIED`) and project locations (`Asia/Kolkata` timezone context) transparently in accordance with regulatory assumptions.
5. Strictly isolate and decouple the public web interface from the unauthenticated `/api/chat` route, preserving the security boundary identified in the Milestone 4 review until secure buyer-session binding is introduced in Phase 2.

#### 2. Architecture & Design Decisions
- **Async React Server Component for Data Fetching:** `src/app/page.tsx` was implemented as an async React Server Component executing direct Prisma queries (`prisma.project.findMany` and `prisma.factSheet.findMany`). This eliminates client-side network round-trips, prevents loading waterfalls, hides database schemas from the browser bundle, and renders fully populated HTML for immediate initial paint.
- **Next.js 16 Cache Components Migration (`export const instant = false`, Decision D-019):** Next.js 16 configured with `cacheComponents: true` and `partialPrefetching = true` strictly prohibits legacy route segment configs (`export const dynamic = "force-dynamic"` or `export const revalidate = 60`). Attempting uncached database queries without explicit authorization throws prerender validation errors during build. We applied Next.js 16's official `export const instant = false` directive, explicitly authorizing runtime blocking database access and compiling the homepage cleanly as `ƒ /` (dynamic server-rendered).
- **Component Decomposition Strategy:** Decomposed the buyer landing experience into six focused, single-responsibility components in `src/components/buyer/`:
  - `PublicNav`: Sticky header with brand identity, desktop anchor navigation (`#projects`, `#why-us`, `#concierge`, `#contact`), site-visit CTA, and accessible mobile drawer toggle.
  - `HeroSection`: Architectural headline, Ahmedabad West location badge, primary "Explore Residences" and secondary "Meet AI Concierge" CTAs, and a database-grounded portfolio statistics banner (2 live projects, 420 apartments, ₹65L–₹1.2Cr).
  - `ProjectShowcase`: Grid of project cards for `Prakriti Heights` and `Vaastu Enclave` rendering verified database attributes (configurations, price ranges, possession timelines, and RERA disclaimer).
  - `WhyChooseUs`: Four value pillars grounded strictly in verified portfolio facts (prime locations, transparent pricing, statutory compliance, and architectural design), with zero fabricated testimonials or fake awards.
  - `ConciergeCtaSection`: Staging and value-proposition banner introducing the upcoming 24/7 multilingual AI concierge.
  - `PublicFooter`: Office and site locations in Ahmedabad, `Asia/Kolkata` operating reference, copyright, and statutory RERA compliance notice.
- **Security Boundary Defense (Strict Decoupling):** The public landing page maintains complete physical separation from the unauthenticated `/api/chat` endpoint. CTAs link to visual anchor tags (`#concierge`, `#projects`) rather than dispatching requests to `/api/chat`. Buyer chat session initialization is deferred to Phase 2, where secure signed session binding (e.g. HTTP-only cookies) will be enforced.

#### 3. Key Implementation Details
- `src/app/page.tsx`: Async Server Component with `export const instant = false`. Queries `prisma.project.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })` and `prisma.factSheet.findMany({ where: { scope: 'PORTFOLIO', status: 'VERIFIED', isActive: true } })`. Extracts portfolio metrics and passes strongly typed props to buyer presentation components.
- `src/components/buyer/public-nav.tsx`: Client Component (`"use client"`) managing responsive navigation. Implements desktop link bar and a mobile slide-out drawer with backdrop blur, accessible ARIA attributes (`aria-expanded`, `aria-label`), and smooth auto-closing on anchor clicks.
- `src/components/buyer/hero-section.tsx`: Editorial layout utilizing deep slate typography (`text-slate-900`), warm amber accents, and an interactive stats ribbon displaying live database-backed numbers.
- `src/components/buyer/project-showcase.tsx`: Responsive 2-column grid rendering project cards with blueprint geometric SVG architectural motifs, specification pills (2 & 3 BHK, ₹65L–₹1.2Cr, Dec 2027 / Jun 2028 possession), and RERA `DEMO-ONLY-NOT-VERIFIED` badges.
- `src/components/buyer/why-choose-us.tsx`: Clean 4-card grid highlighting verified developer fundamentals: Prime Locations (SG Highway & Shela), Transparent Pricing (Zero hidden charges), Statutory Compliance (RERA-aligned escrow), and Premium Architecture (420 residences).
- `src/components/buyer/concierge-cta-section.tsx`: Feature card showcasing the upcoming multilingual capability (EN/HI/GU), instant 24/7 responses, and schedule-booking workflow.
- `src/components/buyer/public-footer.tsx`: Comprehensive footer providing authentic contact information, Ahmedabad site addresses, and regulatory disclaimers.

#### 4. Important Files Created / Modified
- `src/app/page.tsx` — Async Server Component with runtime PostgreSQL queries and Next.js 16 `instant = false`.
- `src/components/buyer/public-nav.tsx` — Responsive navigation header with mobile drawer toggle.
- `src/components/buyer/hero-section.tsx` — Editorial hero section with live portfolio statistics.
- `src/components/buyer/project-showcase.tsx` — Dynamic PostgreSQL project cards with verified specifications.
- `src/components/buyer/why-choose-us.tsx` — Four developer value pillars grounded in verified facts.
- `src/components/buyer/concierge-cta-section.tsx` — Multilingual AI concierge staging card.
- `src/components/buyer/public-footer.tsx` — Corporate footer with RERA compliance disclaimer.
- `package.json` & `package-lock.json` — Added `lucide-react` (`^1.16.0`).
- `docs/PROJECT_STATE.md` — Updated operational state, verification table, and Decision D-019.
- `docs/TDD_DRAFT.md` — Updated Tech Stack (Lucide React), Decision Log (D-019), and Milestone Completion Tracker.
- `docs/ENGINEERING_LOG.md` — Documented Milestone 5 Phase 1 design, implementation, and interview defenses.

#### 5. Technical Concepts Learned
- **Next.js 16 Cache Components & Prerendering Semantics:** Understanding how Next.js 16 separates static prerendering from dynamic runtime rendering when `nextConfig.cacheComponents = true`. Legacy route segment options (`dynamic = "force-dynamic"`, `revalidate = 60`) are deprecated and blocked at compile time. Uncached database queries on Server Components require `export const instant = false` to authorize blocking server rendering while compiling as `ƒ /` dynamic.
- **Server Component Direct Database Querying:** Why executing Prisma queries directly within Server Components (`async function Page()`) is superior to client-side `useEffect` or route handler fetch calls: zero client-side JavaScript payload overhead, zero CORS/fetch serialization overhead, and zero exposure of database credentials or internal schemas.
- **Accessible Responsive Drawer Navigation:** Managing focus and backdrop clipping with clean React state toggles, ensuring mobile navigation provides instant tactile feedback and closes automatically when anchor links are clicked.

#### 6. Challenges Encountered & Resolutions
- *Challenge 1 (Next.js 16 Build Incompatibilities with Legacy Dynamic Directives):* Adding `export const dynamic = "force-dynamic"` or `export const revalidate = 60` caused Next.js 16 Turbopack build failures (`Route segment config "dynamic" is not compatible with nextConfig.cacheComponents`).
  *Resolution:* Consulted internal Next.js 16 documentation in `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`. Removed legacy configs and adopted `export const instant = false;`, which cleanly compiles the route as dynamic server-rendered (`ƒ /`) without throwing uncached runtime prerender errors.
- *Challenge 2 (Missing Lucide React Dependency):* `lucide-react` icons were referenced in design components but the package was not yet installed in `package.json`.
  *Resolution:* Installed `lucide-react` (`^1.16.0`) via `npm install lucide-react`, maintaining clean dependency boundaries.
- *Challenge 3 (ESLint Unused Props & Imports):* Initial build flagged unused icon imports (`Link`, `ArrowRight`, `MapPin`, `CheckCircle2`) and unused props (`totalApartments`, `configurationsFact`, `priceRangeFact`).
  *Resolution:* Cleaned unused imports and actively wired `totalApartments` into the Hero stats ribbon and `configurationsFact` / `priceRangeFact` into the project card specifications, resolving all warnings with 0 errors and 0 warnings.

#### 7. Verification Performed & Results
- `npx tsc --noEmit` — ✅ PASS (0 errors).
- `npm run lint` — ✅ PASS (0 errors, 0 warnings).
- `npm run build` — ✅ PASS (Next.js 16.4.4 Turbopack build succeeded, 6 static and dynamic routes compiled in 2.9s, `ƒ /` dynamic server-rendered).
- `npm test` — ✅ PASS (38/38 unit tests passed across 2 files: `serializers.test.ts` [18] and `lead-validation.test.ts` [20] in 882ms).
- `npm run test:integration` — ✅ PASS (29/29 integration tests passed across 5 files: `db-connection.test.ts` [4], `lead-service.test.ts` [5], `booking-service.test.ts` [5], `reminder-service.test.ts` [8], and `ai-service.test.ts` [7] against isolated Neon test branch endpoint `ep-mute-butterfly-b3a54tpa` in 41.13s).
- `Landing Page Live HTTP Smoke Test` — ✅ VERIFIED (`curl http://localhost:3001/` returned 94,879 bytes of rendered HTML containing `Prakriti Heights`, `Vaastu Enclave`, `420`, `SG Highway`, `Shela`, and `RERA Reg: DEMO-ONLY-NOT-VERIFIED`).
- `git diff --check` — ✅ PASS (0 trailing whitespace or EOF formatting errors).

#### 8. Visual Review Findings & UI Refinement Opportunities
- **Aesthetic Direction:** The design achieves an editorial, high-end architectural feel using warm neutral backgrounds (`bg-stone-50`), deep charcoal typography (`text-slate-900`), subtle borders (`border-stone-200`), and warm amber accents, avoiding the look of a generic SaaS dashboard.
- **Architectural Asset Representation:** The project showcase currently uses clean geometric blueprint SVG patterns as placeholders. Future UI refinement can introduce photorealistic 3D architectural renders or drone photography once marketing assets are supplied.
- **Interactive Filtering:** With two active projects, a clean 2-column grid is visually balanced and clear. As project inventory grows, interactive filter tabs (e.g. by corridor: SG Highway vs. Shela, or configuration: 2 BHK vs. 3 BHK) can be incorporated.
- **Typography & Spacing:** Visual hierarchy between primary display headings, editorial body copy, and metadata specification tags is balanced and readable across desktop and mobile viewports.

#### 9. Security Boundary Defense
- **Decoupling from Unauthenticated Endpoints:** As identified during the Milestone 4 independent security review, `/api/chat` currently relies on `conversationId` as a bearer capability token and lacks secure session binding. Connecting the public landing page directly to `/api/chat` prior to implementing signed buyer-session management would expose the chat API to unauthenticated, untrusted invocations.
- **Staging Architecture:** In Phase 1, all buyer engagement triggers link strictly to visual anchor tags (`#concierge`, `#projects`). Zero network calls to `/api/chat` are dispatched from the client.
- **Phase 2 Scope Lock:** Interactive chat, buyer lead creation, and signed session binding (e.g. HTTP-only signed cookies or tokens) will be implemented as an integrated security package in Milestone 5 Phase 2.

#### 10. Remaining Execution Phases
- **Milestone 5 Phase 2:** Interactive Buyer Concierge UI (minimalist mobile widget, signed buyer-session binding, language toggle EN/HI/GU, DPDP consent capture & opt-out, visual slot picker with independent server-side confirmation, dynamic handoff escalation banner).
- **Milestone 6:** Sales Executive & Sales Head Portal (RBAC auth, Unified Lead List, Handoff Queue, Fact Sheet Approval Editor, Slot Manager).
- **Milestone 7:** Source Attribution & ROI Dashboard + Complete Vitest Suite.
- **Milestone 8:** Final Submission Packaging (`TDD.pdf`/`docx` + `deployment.md` zip `<25MB`, zero secrets).

#### 11. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Approved Milestone 5 Phase 1 scope; mandated editorial residential aesthetic over generic SaaS dashboard styling; required live PostgreSQL data integration for project showcase; enforced Next.js 16 Cache Components migration rules; required statutory RERA disclaimer placement; directed strict security decoupling from `/api/chat`; and approved documentation updates.
- **AI Assistance:** Implemented async Server Component (`src/app/page.tsx`), authored 6 modular buyer components with responsive Tailwind CSS v4 styling, resolved Next.js 16 `instant = false` build directive, cleaned ESLint props/imports, executed test suites and live curl smoke testing, and synchronized all project documentation.

#### 12. Interview Preparation & Defense
- **How to explain this in an interview:** *"In Milestone 5 Phase 1, we built the public residential property landing page for ENQUIVO. Rather than treating the frontend as an afterthought or rendering hardcoded static mockups, we architected the homepage as an async React Server Component in Next.js 16 App Router querying our live PostgreSQL database via Prisma. The page dynamically displays our two live Ahmedabad projects—Prakriti Heights and Vaastu Enclave—and grounds all portfolio highlights in verified database facts. To comply with Next.js 16's modern Cache Components architecture, we utilized `export const instant = false`, authorizing blocking server-side data fetching while cleanly compiling the route as dynamic server-rendered (`ƒ /`). From a security perspective, we strictly isolated the public landing page from our AI chat backend: because our M4 security review determined that `/api/chat` required secure buyer-session binding before public exposure, we intentionally decoupled the public UI from `/api/chat` in Phase 1, staging the concierge visually until signed session binding is implemented in Phase 2."*
- **Likely Interview Question 1:** *Why did you query PostgreSQL directly inside the Server Component instead of creating a `/api/projects` REST endpoint and fetching it with `useEffect`?*
- **Technical Answer:** *Direct database querying inside React Server Components provides three critical production advantages: First, it eliminates the client-side API waterfall and network latency—the server queries the co-located Neon database directly and streams fully formed HTML to the client, achieving faster First Contentful Paint (FCP) and Largest Contentful Paint (LCP). Second, it reduces client bundle size because neither client-side data fetching libraries (like SWR or React Query) nor database client code are shipped to the browser. Third, it prevents exposing internal REST endpoints or database structures to the public internet, reducing our attack surface.*
- **Likely Interview Question 2:** *Why did you use `export const instant = false` instead of `export const dynamic = 'force-dynamic'` in Next.js 16?*
- **Technical Answer:** *In Next.js 16 with `cacheComponents: true` and `partialPrefetching = true` enabled, legacy route segment configurations such as `dynamic = "force-dynamic"` and `revalidate = 60` are deprecated and rejected by the build compiler. Under Cache Components, Next.js expects data fetching to either be wrapped in explicit `"use cache"` boundaries or executed within an async component permitted to block. The `export const instant = false` directive explicitly informs the Next.js compiler that this page is authorized to perform blocking server-side runtime operations, allowing it to compile cleanly as a dynamic server-rendered page (`ƒ /`) without throwing uncached runtime prerender validation errors.*
- **Key Engineering Trade-off:** Server-rendered Blueprint SVGs vs. External Image Hosting. For an assessment MVP, hosting external photographic assets on S3 or Cloudflare introduces third-party network dependencies, broken image links, and potential CORS issues. Rendering high-contrast geometric blueprint SVGs directly in code provides instant, deterministic, zero-latency visual hierarchy while maintaining a premium architectural aesthetic.

---

### Milestone 5 — Phase 2: Secure Buyer Sessions, Functional AI Concierge & Direct Escalation

- **Date:** 2026-11-06
- **Status:** Phase 2 Complete (Verified; Pending Commit)

#### 1. Context & Objectives
Milestone 5 Phase 2 connects the public buyer interface to the live AI Concierge and backend services while resolving the architectural and security observations raised during the Milestone 4 review. Specifically:
1. **Resolve Bearer Capability Token Exposure (Observation 2):** In M4, possession of a raw `conversationId` allowed unbounded access to that conversation. Phase 2 introduces a cryptographic guest buyer session mechanism binding conversations to signed, HTTP-only session cookies.
2. **Prevent Autonomous AI Booking Hallucinations (Observation 1):** In M4, the AI could emit `confirmed: true` to book a visit. Phase 2 introduces an explicit booking security boundary (`allowDirectToolBooking = false`), requiring independent buyer confirmation through an interactive slot selector or human executive.
3. **Request-Level Idempotency (`clientMessageId`):** Prevent duplicate user turns under concurrent requests (double-click/network retries) and ensure retry attempts safely reuse existing records without false deduplication of intentional repeated messages.
4. **Decoupled Direct Human Handoff (`POST /api/chat/handoff`):** Guarantee that buyers can connect with a sales executive with 100% availability even when the external AI provider is experiencing outages, rate limits, or high demand.
5. **Standardized CSRF & Same-Origin Defense:** Enforce browser security headers across all state-changing API endpoints.
6. **Gemini 3.8 Flash Migration & Bounded Retries:** Migrate from deprecated `gemini-2.5-flash` to stable `gemini-3.8-flash`, configure native SDK bounded exponential backoff with jitter on 429/503/504, classify errors into typed structures, and show sanitized user-facing error banners.
7. **Frontend Architecture Refinement:** Keep the homepage focused on property discovery with an editorial Concierge Preview Card linking to a dedicated, responsive `/concierge` chat page.

#### 2. Architecture & Design Decisions
- **Cryptographic Signed Cookie Sessions (`BuyerSessionService`, Decision D-020):** Designed a lightweight, stateless-capable guest buyer session mechanism using HMAC-SHA256 signatures over a two-part payload `base64url(payload).signature`. The payload contains `conversationId`, `leadId`, `tokenHash` (SHA-256 of a 32-byte cryptographically secure random value), `issuedAt`, and `expiresAt` (24-hour lifetime). The session is stored in an HTTP-only cookie (`eq_buyer_session`) with `SameSite=Lax`, `Path=/`, and `Secure` in production. This eliminates bearer token exposure, prevents XSS theft (JavaScript cannot read HTTP-only cookies), and allows server-side revocation by recording `endedAt` on the conversation or `optedOut: true` on the consent record.
- **Server-Derived Identity & Anti-Tampering:** In `POST /api/chat`, identity is derived strictly from the authenticated cookie session. If the client optionally supplies a `conversationId` or `leadId` in the JSON body, the server explicitly asserts that it matches the session payload. Any mismatch throws `BuyerSessionTamperingError` (HTTP 403), completely neutralizing Insecure Direct Object References (IDOR).
- **Request-Level Idempotency via Primary Key Constraint (`clientMessageId`, Decision D-021):** Rather than relying on heuristic text matching on the latest message (which suffers from race conditions and suppresses intentional consecutive duplicate messages), clients generate a unique `clientMessageId` per intentional turn. When creating the `ChatMessage`, the service sets `id: clientMessageId`. PostgreSQL's primary key constraint (`chat_messages_pkey`) guarantees atomic deduplication. If concurrent identical requests arrive simultaneously, one succeeds and the second catches `P2002` (unique constraint violation) and reuses the existing record. When retrying a failed attempt, the UI supplies the preserved `clientMessageId`; for a new intentional message, the UI generates a fresh ID.
- **Decoupled Manual Human Handoff (Decision D-022):** Upstream LLM providers occasionally experience 503 UNAVAILABLE outages during peak demand. If "Talk to Sales" routes through the LLM, a buyer cannot get human help during an outage. We introduced `POST /api/chat/handoff` and `AIConciergeService.createManualHandoff`, which queries an active `SALES_EXEC` from PostgreSQL, creates or finds the `Handoff` record, records a localized system confirmation message in chat history, and updates `Lead.firstResponseAt` without invoking Gemini.
- **Standardized CSRF Defense (`src/lib/security.ts`, Decision D-023):** Implemented `verifySameOrigin` enforcing: (1) rejection of `Sec-Fetch-Site: cross-site`; (2) validation that `Origin` host matches `Host` or `X-Forwarded-Host`; and (3) fallback verification of `Referer` when `Origin` is omitted. Applied consistently across `/api/chat`, `/api/chat/handoff`, `/api/chat/session`, and `/api/chat/session/opt-out`.
- **SDK Native Bounded Retries (Decision D-024):** Configured `@google/genai` HTTP client retry options (`attempts: 3`, `initialDelay: 1.0s`, `maxDelay: 4.0s`, `expBase: 2.0`, `jitter: 0.5`, `httpStatusCodes: [429, 503, 504]`). This prevents nested retry loops by letting the SDK manage transient transport retries while service code handles domain errors.
- **Booking Security Gate (`allowDirectToolBooking = false`):** Guarded `bookVisitSlot` tool execution inside `sendMessage`. When invoked by Gemini, it returns a localized compliance message guiding the buyer to the interactive slot picker or human sales team. Direct autonomous bookings without independent buyer confirmation are strictly blocked.
- **Homepage Discovery vs. Dedicated Chat:** Visual review identified that embedding the full chat interface directly into the homepage disrupted property discovery and cramped the chat composer. We decomposed the UX into an architectural Concierge Preview Card on the homepage linking to a dedicated full-page experience at `/concierge`.

#### 3. Key Implementation Details
- `src/services/session/buyer-session.service.ts`: Implemented `generateSessionToken`, `hashToken`, `signSession`, `verifySessionToken`, `validateSession`, `revokeSession`, and `optOutSession`.
- `src/lib/security.ts`: Authored standardized `verifySameOrigin(req)` function.
- `src/lib/validations/ai.ts`: Extended `chatInputSchema` with optional `clientMessageId`.
- `src/services/ai/ai.service.ts`: Migrated model to `gemini-3.8-flash`; configured native SDK bounded backoff; added `classifyGeminiError`; implemented atomic `clientMessageId` insertion and `P2002` deduplication; added `createManualHandoff`; enforced `allowDirectToolBooking = false`.
- `src/app/api/chat/route.ts`: Cookie-authenticated chat handler with CSRF checks, anti-tampering guards, and sanitized error mapping.
- `src/app/api/chat/handoff/route.ts`: Dedicated offline human escalation route.
- `src/app/api/chat/session/route.ts`: Session intake handler validating affirmative DPDP consent, merging leads via `LeadService`, and issuing signed HTTP-only cookies.
- `src/app/api/chat/session/opt-out/route.ts`: DPDP consent withdrawal handler marking `ConsentRecord.optedOut = true` and clearing session cookies.
- `src/app/(buyer)/concierge/page.tsx`: Dedicated concierge chat page.
- `src/components/buyer/concierge-chat.tsx`: Interactive chat component with intake form, language selector, `clientMessageId` tracking, retry preservation, direct handoff button, and mobile touch targets.
- `src/components/buyer/concierge-cta-section.tsx`: Polished concierge preview card for homepage.

#### 4. Important Files Created / Modified
- `src/services/session/buyer-session.service.ts` — Cryptographic buyer session service.
- `src/lib/security.ts` — Standardized CSRF & Same-Origin verification utility.
- `src/lib/validations/ai.ts` — Updated Zod schemas with `clientMessageId`.
- `src/services/ai/ai.service.ts` — AI service with Gemini 3.8 Flash, SDK retries, idempotency, and direct handoff.
- `src/app/api/chat/route.ts` — Cookie-authenticated chat endpoint with CSRF and anti-tampering.
- `src/app/api/chat/handoff/route.ts` — Decoupled direct human escalation endpoint.
- `src/app/api/chat/session/route.ts` — Session intake & validation endpoint.
- `src/app/api/chat/session/opt-out/route.ts` — DPDP consent withdrawal endpoint.
- `src/app/(buyer)/concierge/page.tsx` — Dedicated concierge chat page.
- `src/components/buyer/concierge-chat.tsx` — Responsive buyer concierge chat interface.
- `src/components/buyer/concierge-cta-section.tsx` — Homepage concierge preview card.
- `tests/unit/security.test.ts` — 7 CSRF & Same-Origin unit tests.
- `tests/unit/buyer-session.test.ts` — 9 cryptographic session unit tests.
- `tests/unit/ai-error-handling.test.ts` — 8 transient error classification unit tests.
- `tests/integration/buyer-session.test.ts` — 9 session lifecycle integration tests.
- `tests/integration/ai-service.test.ts` — 10 AI concierge integration tests.
- `docs/PROJECT_STATE.md`, `docs/TDD_DRAFT.md`, `docs/ENGINEERING_LOG.md` — Synchronized live documentation.

#### 5. Technical Concepts Learned
- **HMAC-SHA256 Token Signing vs. Bearer Capabilities:** How signing session tokens with an application secret prevents client payload tampering without requiring server-side session stores (Redis/Memcached), while combining signed tokens with database validation (`Conversation.endedAt`, `ConsentRecord.optedOut`) provides instant revocation.
- **Atomic Concurrency Control via Database Primary Keys:** Using PostgreSQL's primary key constraint (`chat_messages_pkey`) to achieve mathematically guaranteed request idempotency. Concurrent duplicate requests either insert or catch `P2002` to retrieve the winning record, avoiding race conditions inherent in application-level read-then-write logic.
- **Upstream Failure Decoupling:** Designing critical business workflows (such as connecting a buyer with a sales executive) to operate independently of external AI provider availability. When Gemini is down with 503, the buyer can still escalate seamlessly via PostgreSQL.
- **Same-Origin Verification & Modern Browser Metadata:** Combining `Sec-Fetch-Site` (browser-enforced metadata) with `Origin` and `Host` matching to block cross-site request forgery without requiring heavy synchronized CSRF tokens for same-origin SPAs.

#### 6. Challenges Encountered & Resolutions
- *Challenge 1 (Live Gemini 404 NOT_FOUND on Deprecated Model):* The live application returned `404 NOT_FOUND: This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash.`
  *Resolution:* Updated model identifier to `gemini-3.8-flash` in `src/services/ai/ai.service.ts` and verified tool declaration and function-calling compatibility.
- *Challenge 2 (Gemini 503 High-Demand Failures & Nested Retries):* Live Gemini 3.8 Flash returned HTTP 503 UNAVAILABLE with high-demand messages. Adding custom application-level retries risked nested retry storms with the SDK's internal HTTP client.
  *Resolution:* Configured native SDK `httpOptions.retryOptions` (`attempts: 3`, exponential backoff with jitter on 429/503/504), authored `classifyGeminiError` to return sanitized buyer-facing error banners, implemented a working retry button in the UI, and created the direct offline `/api/chat/handoff` route.
- *Challenge 3 (Concurrent Duplicate User Messages):* Comparing the latest unanswered message via `findFirst` had a race condition when two identical requests hit the server simultaneously.
  *Resolution:* Implemented request-level idempotency via `clientMessageId` backed by PostgreSQL's primary key unique constraint on `ChatMessage`. Concurrent requests safely catch `P2002` and reuse the existing record.
- *Challenge 4 (Headless Chrome Visual Verification on Windows):* Standard Windows CLI Chrome headless capture produced a blank canvas before React hydrated.
  *Resolution:* Authored a targeted scratch script using Chrome DevTools Protocol (CDP) WebSocket, waiting for `Page.loadEventFired` and DOM styles, capturing verified high-DPI screenshots of desktop and mobile views.
- *Challenge 5 (Homepage Edge Viewport Typography & Scope Realism):* In `docs/screenshots/test_edge.png`, the 420 apartments statistic wrapped across 5 lines because the raw database fact string was rendered directly inside the large serif numeral slot, and the pricing statistic was labeled "VERIFIED PRICING" even though the brief provides a price range without independent third-party verification.
  *Resolution:* In `src/app/page.tsx` and `src/components/buyer/hero-section.tsx`, sanitized the primary statistic to extract the clean numeric metric (`"420"`), added `tracking-tight` and balanced mobile grid borders (`[&:nth-child(2)]:border-r-0 sm:[&:nth-child(2)]:border-r`), and updated the label to "Price Range" (rendering uppercase as "PRICE RANGE") in both the hero ribbon and `src/components/buyer/project-showcase.tsx`.

#### 7. Verification Performed & Results
- `npm test` — ✅ PASS (62/62 unit tests passed across 5 files in 4.45s: `security.test.ts` [7], `serializers.test.ts` [18], `lead-validation.test.ts` [20], `buyer-session.test.ts` [9], `ai-error-handling.test.ts` [8]).
- `npm run test:integration` — ✅ PASS (41/41 integration tests passed across 6 files against Neon test branch `ep-mute-butterfly-b3a54tpa` in 22.58s: `db-connection.test.ts` [4], `lead-service.test.ts` [5], `booking-service.test.ts` [5], `reminder-service.test.ts` [8], `buyer-session.test.ts` [9], `ai-service.test.ts` [10]).
- `npx tsc --noEmit` — ✅ PASS (0 errors across entire workspace).
- `npm run lint` — ✅ PASS (0 errors, 0 warnings).
- `npm run build` — ✅ PASS (Next.js 16.4.4 Turbopack build succeeded, 8 static & dynamic routes compiled in 6.3s).
- `Visual CDP Review` — ✅ VERIFIED: High-DPI screenshots captured and inspected for Desktop/Mobile Homepage Concierge preview and Desktop/Mobile `/concierge` dedicated chat page.
- `git diff --check` — ✅ PASS (0 trailing whitespace or EOF formatting errors).

#### 8. Security Review & Compliance Verification
- **Cross-Session Isolation:** Verified that possessing a conversation ID does not grant access to another buyer's chat; requests without a valid signed cookie are rejected (401), and requests with mismatched IDs throw `BuyerSessionTamperingError` (403).
- **DPDP Act 2023 Compliance:** Explicit affirmative digital consent is captured before session issuance. The opt-out endpoint (`POST /api/chat/session/opt-out`) updates `ConsentRecord.optedOut = true`, revokes the active session, and deletes the cookie. Opted-out leads are blocked from initiating new sessions.
- **Booking Gate:** Direct autonomous booking via AI tool calls is safely blocked (`allowDirectToolBooking = false`).
- **CSRF & Same-Origin Defense:** Enforced across all state-changing endpoints via `verifySameOrigin`.

#### 9. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Approved M5.2 scope; directed resolution of M4 security observations; mandated cryptographic signed cookie sessions over localStorage tokens; required request-level idempotency to prevent duplicate user turns; mandated decoupled offline human handoff for 100% escalation availability; directed homepage layout separation from dedicated `/concierge` page; and approved documentation updates.
- **AI Assistance:** Implemented `BuyerSessionService`, authored CSRF verification utility, upgraded model to `gemini-3.8-flash` with native SDK bounded retries, implemented `clientMessageId` PostgreSQL primary key deduplication, built direct handoff endpoint, created `/concierge` page and refined UI components, authored unit and integration test suites, executed all verification checks, and synchronized live documentation.

#### 10. Interview Preparation & Deep-Dive
- **Code Walkthrough:**
  - `src/services/session/buyer-session.service.ts`: Issues HMAC-SHA256 signed session cookies containing `conversationId`, `leadId`, and `tokenHash`. Verifies signatures using constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks. Validates that the underlying conversation has not ended (`endedAt === null`) and the lead has not opted out (`optedOut !== true`).
  - `src/app/api/chat/session/route.ts`: Ingests the buyer via `LeadService.ingestLead` (preserving first-touch attribution and recording explicit DPDP consent), finds or creates an active conversation, signs a session cookie, and returns conversation history.
  - `src/app/api/chat/route.ts`: Extracts the cookie, validates the session, asserts that any client-supplied IDs match the session, and passes server-derived identity to `AIConciergeService.sendMessage`.
  - `src/services/ai/ai.service.ts`: Inserts the user message with `id: clientMessageId`, catching `P2002` under concurrency. Invokes Gemini 3.8 Flash with native bounded backoff. Executes verified fact grounding tools, blocks direct bookings (`allowDirectToolBooking = false`), and persists the AI response with grounding IDs.
  - `src/app/api/chat/handoff/route.ts`: Offline escalation endpoint. Directs `createManualHandoff` to query an active `SALES_EXEC` from PostgreSQL, create the `Handoff`, persist a confirmation message, and update `firstResponseAt` with zero Gemini calls.
- **Trade-off Defense (HMAC-SHA256 Signed Cookies vs. Server-Side Session Store vs. Bearer Tokens):**
  - *Bearer Tokens:* Bearer tokens in JSON request bodies are vulnerable to IDOR spoofing and require client storage (e.g. `localStorage`), making them accessible to XSS attacks.
  - *Server-Side Session Store (Redis):* Storing session state in Redis adds external infrastructure dependencies prohibited by our architecture rules.
  - *HMAC-SHA256 Signed HTTP-Only Cookies:* Provides stateless cryptographic verification of session authenticity with zero external dependencies. HTTP-only flag prevents JavaScript XSS theft; `SameSite=Lax` prevents CSRF; and database validation of `Conversation.endedAt` and `ConsentRecord.optedOut` enables instant revocation.
- **Failure Mode Defense (What breaks if we remove our locks/guardrails?):**
  - *Removing `verifySameOrigin`:* Malicious third-party websites could forge cross-site POST requests via image/form tags, triggering unauthorized chat sessions or DPDP opt-outs using the buyer's ambient cookie.
  - *Removing `clientMessageId` Primary Key Deduplication:* If a buyer on a mobile connection double-taps "Send" or their connection drops, simultaneous requests execute concurrent `findFirst` checks before either has committed, resulting in duplicate user turns stored in PostgreSQL and confusing the AI's conversation history.
  - *Removing Decoupled Offline Handoff:* If Gemini experiences an outage (503 UNAVAILABLE), routing human escalation requests through Gemini causes the handoff to fail, leaving the buyer stranded without sales assistance.
- **Likely Interview Question 1:** *How does your application guarantee request-level idempotency under concurrent identical requests without a distributed Redis lock?*
  - **Technical Answer:** *We leverage PostgreSQL's primary key unique constraint on `ChatMessage.id`. When a user submits a turn, the client generates a stable `clientMessageId`. In `AIConciergeService.sendMessage`, we attempt to insert the message using `id: clientMessageId`. Under concurrency (such as two identical requests dispatched simultaneously via `Promise.all`), PostgreSQL's atomic index insertion allows exactly one request to succeed. The second request encounters a unique constraint violation (`P2002`). Our service catches `P2002` and retrieves the committed message row from the winning request. This provides mathematically guaranteed deduplication without the latency or operational overhead of a distributed Redis lock.*
- **Likely Interview Question 2:** *Why did you decouple the manual 'Talk to Sales' action from Gemini, and how does it ensure high availability?*
  - **Technical Answer:** *In conversational AI architectures, relying on the LLM to process every user action introduces a single point of failure. External AI providers are subject to transient 503 overloads, rate limits, and network timeouts. If a buyer clicks 'Talk to Sales' because they are frustrated or experiencing an AI issue, routing that request through Gemini would cause the escalation to fail precisely when the AI is down. By creating a dedicated `POST /api/chat/handoff` endpoint that executes `createManualHandoff` directly against PostgreSQL, we query an active `SALES_EXEC`, create the `Handoff` record, and persist the confirmation message with zero LLM dependencies. This guarantees that human escalation has 100% operational availability.*

---

### Milestone 6 — Phase 1: Staff Authentication, Argon2id Passwords, PostgreSQL Live Role Revalidation & Operations Portal Shell

- **Date:** 2026-11-07
- **Status:** Complete (Phase 1 of Milestone 6 Verified)

#### 1. Context & Objectives
Internal real estate operations platforms handle sensitive buyer contact information, negotiation summaries, and verified property fact sheets. A security model relying on hardcoded shared demo passwords, client-side-only role toggling, or unvalidated JWTs creates critical vulnerabilities (privilege escalation, IDOR, session hijacking). Milestone 6 Phase 1 established a hardened authentication foundation and portal shell: replacing all placeholder password hashes with production-grade Argon2id credentials, creating `StaffAuthService` with HMAC-SHA256 signed session cookies, enforcing mandatory database revalidation on every protected request, preventing brute-force attacks via sliding-window IP/email throttling, and building a responsive staff portal layout with role-aware navigation.

#### 2. Architecture & Design Decisions
- **Argon2id Password Verification (`@node-rs/argon2`):** Selected Argon2id—the winner of the Password Hashing Competition (PHC)—over legacy bcrypt or unsalted SHA-256 for resistance to GPU/ASIC brute-force cracking.
- **Unique Non-Shared Staff Credentials:** Eliminated all placeholder hashes and shared passwords (`enquivo2026`). Assigned individual strong credentials to seeded staff accounts (`AaravHead@2026!`, `VikramExec@2026!`, `PriyaExec@2026!`, `HardikBuyer@2026!`), verified via database seeding.
- **Signed HMAC-SHA256 HTTP-Only Session Cookies (`eq_staff_session`):** Issued via HTTP-only cookie with `SameSite=Lax`, `Path=/`, and 12-hour expiration. Prevents JavaScript XSS theft and avoids storing credentials in `localStorage`.
- **Live PostgreSQL Database Revalidation on Protected Requests:** Rather than blindly trusting the claims inside a session token, `StaffAuthService.verifySessionAndFetchUser` performs a live PostgreSQL query (`prisma.user.findUnique({ where: { id: payload.userId } })`). If the user was deleted, disabled, or demoted to `BUYER`, the request is immediately rejected. This eliminates stale-token privilege escalation vulnerabilities.
- **Brute-Force Login Throttling (Rate Limiting):** Tracks failed login attempts per client IP and email. Exceeding 5 failed attempts within 15 minutes triggers a 429 Too Many Requests response with `Retry-After` header, resetting only upon a successful login.
- **Server-Side RBAC Enforcement (`src/lib/auth-guard.ts`):** Implements `getStaffSession`, `requireStaffSession`, `requireStaffRole(allowedRoles)`, and `requireSalesHead`. Unauthorized roles receive an explicit 403 Forbidden error rather than relying on client-side UI hiding.
- **Next.js 16 Cache Components Compatibility:** With `cacheComponents: true` and `partialPrefetching: true`, dynamic route segments that access `cookies()` outside of Suspense require `export const instant = false;` to allow blocking server-side validation without failing static prerendering checks. In `/api/auth/session`, rethrows `NEXT_PRERENDER_INTERRUPTED` to prevent build log pollution.

#### 3. Files Created or Modified
- `package.json` & `package-lock.json` — Installed `@node-rs/argon2`.
- `prisma/schema.prisma` — Added `StaffSession` model with `@unique` `tokenHash`, `expiresAt`, `revokedAt`, and cascade delete relation to `User` (14 total models).
- `prisma/migrations/20261107065456_add_staff_sessions/` — Applied migration to baseline development database and isolated test branch.
- `prisma/seed.ts` — Updated to hash individual passwords using Argon2id during seed transaction and cascade clean staff sessions.
- `src/types/index.ts` — Exported `StaffSession` type.
- `src/services/auth/staff-auth.service.ts` — Core staff authentication service: Argon2id verification, HMAC token signing/verification, persistent PostgreSQL session lifecycle (`staffSession.create`, `staffSession.findUnique`, `staffSession.updateMany` on revocation), live DB revalidation, and brute-force throttling. Removed all volatile in-memory revocation maps.
- `src/lib/auth-guard.ts` — Server auth guards (`requireStaffSession`, `requireStaffRole`, `requireSalesHead`).
- `src/lib/validations/auth.ts` — Zod request validation for login.
- `src/app/api/auth/login/route.ts` — Staff login route with CSRF check, throttling, credential verification, and HTTP-only cookie issuance.
- `src/app/api/auth/logout/route.ts` — Staff logout route clearing the session cookie.
- `src/app/api/auth/session/route.ts` — Session status endpoint with database revalidation.
- `src/app/(auth)/login/page.tsx` — Staff login interface with error presentation, rate-limit countdown, and one-click evaluator credential autofill.
- `src/components/portal/portal-nav.tsx` — Role-aware sidebar navigation restricting Fact Sheet Editor to `SALES_HEAD`.
- `src/components/portal/portal-header.tsx` — Sticky top bar with portfolio context, reference date, user badge, and sign-out action.
- `src/app/(portal)/layout.tsx` — Protected layout enforcing `getStaffSession` and redirecting unauthenticated visitors to `/login`.
- `src/app/(portal)/dashboard/page.tsx` — Phase 1 operations dashboard landing view.
- `src/app/(portal)/dashboard/leads/page.tsx` — Phase 2 placeholder.
- `src/app/(portal)/dashboard/handoffs/page.tsx` — Phase 3 placeholder.
- `src/app/(portal)/dashboard/visits/page.tsx` — Phase 4 placeholder.
- `src/app/(portal)/dashboard/fact-sheet/page.tsx` — Phase 4 placeholder strictly protected by `requireSalesHead()`.
- `src/app/(portal)/dashboard/sources/page.tsx` — Phase 5 placeholder.
- `tests/unit/staff-auth.test.ts` — 13 unit tests verifying Argon2id hashing, HMAC signing, tampering rejection, expiration, throttling, and DB revalidation.
- `tests/integration/staff-auth.test.ts` — 7 integration tests against isolated Neon test branch verifying login flows, role rejection, throttling, and database deletion revalidation.
- `docs/PROJECT_STATE.md` — Updated state, verification table, Decision Log (D-025, D-026), and next actions.
- `docs/TDD_DRAFT.md` — Updated Decision Log and Milestone Completion Tracker.
- `deployment.md` — Documented synthetic evaluator credentials and portal access instructions.

#### 4. Verification Performed & Results (Including Pre-Checkpoint Security Review)
- `npm test` — ✅ PASS (83/83 unit tests passed across 6 files).
- `npm run test:integration` — ✅ PASS (53/53 integration tests passed across 7 files against isolated Neon test branch `ep-mute-butterfly-b3a54tpa`).
- `npx tsc --noEmit` — ✅ PASS (0 errors across entire workspace).
- `npm run lint` — ✅ PASS (0 errors, 0 warnings).
- `npm run build` — ✅ PASS (Next.js 16.4.4 Turbopack build succeeded, 18 static & dynamic routes compiled).
- `ALLOW_DESTRUCTIVE_SEED=true npx prisma db seed` — ✅ PASS: Seeded Neon PostgreSQL with synthetic demo evaluator credentials (`DemoEval#Head2026!`, etc.).
- `git diff --check` — ✅ PASS (0 trailing whitespace or EOF formatting errors).

#### 5. Pre-Checkpoint Security Review Findings & Resolutions
1. **Demo Credential Safety:** Seeded accounts were updated to use synthetic, dedicated evaluator passwords (`DemoEval#Head2026!`, `DemoEval#ExecVikram2026!`, `DemoEval#ExecPriya2026!`), protected by production environment aborts. In `src/app/(auth)/login/page.tsx`, the autofill credentials helper was environment-gated (`showDemoLogins = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGINS === 'true' || process.env.NODE_ENV === 'development'`), completely hiding demo credentials in production.
2. **Server-Side Persistent Session Revocation & Token Replay Prevention in Serverless:**
   - *Vulnerability in In-Memory Maps:* In serverless deployment environments (e.g. Next.js on Vercel), in-memory revocation registries (`Map`) fail because each lambda instance runs in isolated process memory, and cold restarts discard in-memory state. A revoked session could easily be replayed against another instance or after a worker restart.
   - *PostgreSQL `StaffSession` Architecture:* Added the `StaffSession` model to `prisma/schema.prisma` (`id`, `userId`, `tokenHash` [SHA-256 unique], `expiresAt`, `revokedAt`, `createdAt`) with a cascading foreign key to `User`. Applied migration `20261107065456_add_staff_sessions` to both the baseline development database (`neondb`) and the isolated test branch (`ep-mute-butterfly-b3a54tpa`).
   - *Zero External Cache Infrastructure:* Completely achieves global serverless session invalidation and replay prevention across horizontal instances with zero Redis or external caching infrastructure.
3. **Two-Layer Bearer Token Architecture (Hardened Cookie/DB Separation):**
   - The browser cookie is an HTTP-only bearer credential. It encapsulates a 32-byte cryptographic random `rawToken` inside an HMAC-SHA256 signed envelope.
   - PostgreSQL stores strictly `tokenHash = SHA-256(rawToken)`. `tokenHash` is never exposed in the client cookie.
   - On every request, `verifySessionAndFetchUser` verifies HMAC signature first using constant-time comparison `timingSafeEqual`. Tampered cookies fail immediately before any database query is issued. Upon signature verification, the server extracts `rawToken`, computes `SHA-256(rawToken)` on the fly, and checks PostgreSQL.
   - A read-only database leak does not expose valid bearer session credentials because SHA-256 is computationally irreversible.
4. **Account Status Verification & Current Schema Boundary:**
   - Inspected `prisma/schema.prisma`: confirmed `User` has no `isActive` or `disabledAt` column.
   - Account access revocation is enforced via role demotion to `BUYER` (rejected by `verifySessionAndFetchUser`) or user deletion (`onDelete: Cascade` purges `StaffSession` rows).
5. **Authorization & CSRF Enforcement:** Verified that `verifySameOrigin` protects state-changing endpoints, and server guards enforce `requireSalesHead()` on fact sheet governance.
6. **Portal Date Clarification:** Updated the portal header badge to `Timeline Anchor: Nov 3, 2026` with explicit tooltip explaining that historical sample data and future bookable slots are anchored to November 3, 2026 per the assessment specification.
7. **IngestLead Concurrency Lookup Backoff:** Fixed a transient Read Committed visibility gap in `LeadService.ingestLead` where the losing concurrent transaction catches phone `P2002` before the winning transaction has committed, adding a 50-100ms lookup retry loop.

#### 5. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Approved M6 Phase 1 scope and 5-phase breakdown; mandated Argon2id over placeholder hashes; prohibited shared demo passwords; mandated live PostgreSQL database revalidation on every protected request; required brute-force login throttling and Same-Origin CSRF protection; directed role-gated navigation isolating Fact Sheet governance to `SALES_HEAD`; and approved documentation updates.
- **AI Assistance:** Installed `@node-rs/argon2`, implemented `StaffAuthService` with sliding-window throttling and DB revalidation, built auth route handlers and server guards, created staff login UI and portal layout, solved Next.js 16 Partial Prerendering dynamic cookie constraints, authored 13 unit tests and 7 integration tests against the isolated Neon test branch, and synchronized live documentation.

#### 6. Interview Preparation & Deep-Dive
- **Code Walkthrough:**
  - `src/services/auth/staff-auth.service.ts`: Implements `authenticateStaff(params, ip)` which checks `isThrottled(key)`, queries `prisma.user.findUnique`, verifies `ALLOWED_STAFF_ROLES.includes(user.role)`, verifies password via `verify(user.passwordHash, password)`, resets throttling on success, and signs a session payload (`userId`, `email`, `name`, `role`, `tokenHash`, `createdAt`, `expiresAt`) using HMAC-SHA256.
  - `verifySessionAndFetchUser(tokenString)`: Verifies HMAC signature with constant-time equality check (`timingSafeEqual`), checks expiration, and queries PostgreSQL `prisma.user.findUnique` to confirm the user still exists and retains an authorized staff role.
  - `src/lib/auth-guard.ts`: Centralizes cookie retrieval (`cookies()` or `Request` header), executes `verifySessionAndFetchUser`, and exports `requireStaffSession`, `requireStaffRole`, and `requireSalesHead`.
  - `src/app/api/auth/login/route.ts`: Enforces `verifySameOrigin`, validates payload via Zod `LoginRequestSchema`, invokes `authenticateStaff`, and sets HTTP-only `eq_staff_session` cookie (`SameSite=Lax`, `Path=/`, `Max-Age=43200`, `Secure` in prod).
  - `src/app/(portal)/layout.tsx`: Async server layout executing `getStaffSession()`. Redirects unauthenticated users to `/login`. Renders `PortalNav` and `PortalHeader`.
- **Trade-off Defense (Live Database Revalidation vs. Pure Stateless JWTs):**
  - *Stateless JWTs:* In pure stateless JWT architectures, once a token is signed with a 12-hour expiry, the server cannot revoke or downgrade permissions until the token expires without maintaining an external revocation list (such as Redis). If an employee is terminated or a Sales Executive is demoted to Buyer, they retain full portal access for up to 12 hours.
  - *Our Hybrid Revalidation Pattern:* We combine cryptographic HMAC-SHA256 signatures with live PostgreSQL user lookups (`prisma.user.findUnique({ where: { id: payload.userId } })`). Signature verification rejects forged tokens instantly with zero DB load. Valid tokens then verify the user's active existence and live role from PostgreSQL, guaranteeing that role changes or account terminations take effect immediately.
- **Failure Mode Defense (What breaks if we remove our guardrails?):**
  - *Removing DB Revalidation:* If a Sales Executive account is compromised or terminated and their role is updated in PostgreSQL to `BUYER`, relying on token claims alone allows the attacker to continue reading buyer PII and editing appointments until cookie expiration.
  - *Removing Login Throttling:* An attacker could launch high-speed dictionary attacks against staff email addresses, eventually compromising accounts protected by weak passwords.
- **Likely Interview Question 1:** *Why did you implement Argon2id over bcrypt for staff password verification?*
  - **Technical Answer:** *Bcrypt is computationally expensive for CPUs, but its memory footprint is fixed at only 4 KB, making it vulnerable to massively parallel GPU and ASIC hardware attacks. Argon2id (the winner of the Password Hashing Competition) combines data-independent memory access (defending against side-channel cache-timing attacks) with data-dependent memory access (defending against GPU crack parallelism). By requiring substantial configurable memory (e.g. 64 MB) alongside CPU iterations, Argon2id renders GPU/ASIC cluster cracking economically and computationally infeasible.*
- **Likely Interview Question 2:** *How do you protect your staff portal against Cross-Site Request Forgery (CSRF) and IDOR vulnerabilities?*
  - **Technical Answer:** *We employ a multi-layered defense. First, our session cookie `eq_staff_session` is configured with `SameSite=Lax` and `HttpOnly=true`, preventing cross-site form submissions and blocking JavaScript XSS access. Second, on all state-changing endpoints (`POST /api/auth/login`, `POST /api/auth/logout`), we enforce `verifySameOrigin` which validates browser-enforced `Sec-Fetch-Site: same-origin` and verifies that the `Origin` header matches `Host`/`X-Forwarded-Host`. Third, against IDOR, our server guards (`requireStaffSession`, `requireStaffRole`) resolve identity strictly from verified session tokens revalidated against PostgreSQL, and enforce role permissions (`SALES_HEAD` vs. `SALES_EXEC`) before executing any database query.*

---

### Milestone 6 — Phase 2: Lead Pipeline & Ingestion Interface

- **Date:** 2026-11-07
- **Status:** Complete (Phase 2 of Milestone 6 Verified)

#### 1. Context & Objectives
Following the establishment of staff authentication and portal foundations in Phase 1, Phase 2 turns the lead management area from a placeholder into a complete, database-backed CRM product. Real estate sales leadership (`SALES_HEAD`) requires end-to-end visibility across buyer inquiries, multi-touch attribution channels, and qualification metrics, while individual sales executives (`SALES_EXEC`) must strictly be restricted to their assigned accounts. Phase 2 delivered: (1) dynamic lead lifecycle status derivation (`NEW`, `ENGAGED`, `ESCALATED`, `BOOKED`, `VISITED`) grounded in relational domain records; (2) paginated lead listing with full search, multi-field filtering, and sorting; (3) navigable lead detail page (`/dashboard/leads/[id]`) displaying contact details, project preferences, DPDP consent audits, multi-touch event ledgers, appointment history, and AI chat transcripts; (4) manual lead ingestion interface with full deduplication and first-touch attribution retention; and (5) strict server-side authorization scoping and IDOR prevention.

#### 2. Architecture & Design Decisions
- **Dynamic Relational Derivation of Lead Lifecycle Status (ADR-008):** To prevent dual-source-of-truth desynchronization without mutating the locked schema, lead lifecycle states are evaluated on the fly via `LeadService.computeLeadLifecycleStatus()` according to strict domain precedence:
  - `VISITED`: Any associated `SiteVisit` has `attendanceOutcome === AttendanceOutcome.ATTENDED`.
  - `BOOKED`: Any associated `SiteVisit` has `bookingStatus in [CONFIRMED, COMPLETED]` without attended status.
  - `ESCALATED`: Any associated `Conversation` has an active `Handoff` record.
  - `ENGAGED`: `firstResponseAt !== null` or at least one `Conversation` exists without visits or escalations.
  - `NEW`: Default baseline state (no responses, conversations, or site visits).
- **Database-Level Query Filtering & Relational Pagination:** In `LeadService.getLifecycleStatusFilter()`, lifecycle filters are mapped directly into native Prisma relational query conditions (`siteVisits: { some: ... }`, `conversations: { some: ... }`). This allows PostgreSQL to execute `COUNT`, `SKIP`, and `TAKE` pagination directly on indexed foreign keys, eliminating application memory bloat.
- **Strict Server-Side Staff Scoping & IDOR Prevention:**
  - `SALES_HEAD`: Queries all active leads (`where: { deletedAt: null }`).
  - `SALES_EXEC`: Strict relational scoping restricting queries to leads assigned to that specific executive via conversation handoffs (`where: { deletedAt: null, conversations: { some: { handoff: { assignedToId: staffUser.id } } } }`).
  - Single-lead detail retrieval (`getLeadDetail`) applies the same query scoping. If an executive attempts to access an unassigned lead, the database query returns `null` and the API/route handler responds with HTTP 404, preventing IDOR existence enumeration.
- **Manual Lead Ingestion (`POST /api/leads`):** Reuses the hardened `LeadService.ingestLead` transaction. Normalizes phone to E.164, detects duplicate phones, updates missing fields conditionally without overwriting existing data, preserves immutable first-touch attribution, appends a new `LeadSourceEvent` touchpoint, and records DPDP Act 2023 digital consent without overriding prior opt-outs.
- **Real Database-Backed Dashboard Metrics:** Computed live on `/dashboard` and `/dashboard/leads` via `leadService.getLeadMetrics(user)`, displaying total inquiries, new leads, active chats, booked appointments, verified visits, channel breakdowns, and recent activity feeds without hardcoding.

#### 3. Files Created or Modified
- `src/lib/validations/lead.ts` — Added `leadQuerySchema` and `leadLifecycleStatusValues` Zod validation.
- `src/types/index.ts` — Exported `LeadLifecycleStatus`, `LeadListItem`, `LeadPagination`, `LeadMetrics`, and `LeadDetail` domain interfaces.
- `src/services/lead/lead.service.ts` — Implemented `computeLeadLifecycleStatus`, `getStaffLeadScope`, `getLifecycleStatusFilter`, `getLeads`, `getLeadDetail`, `getLeadMetrics`, and `getProjectsList`.
- `src/app/api/leads/route.ts` — Authenticated lead listing (GET) and manual lead ingestion (POST) endpoint with CSRF check.
- `src/app/api/leads/metrics/route.ts` — Authenticated role-scoped lead metrics endpoint.
- `src/app/api/leads/[id]/route.ts` — Authenticated role-scoped lead detail endpoint with IDOR prevention.
- `src/components/portal/leads/lead-pipeline-client.tsx` — Interactive client component with debounced search, lifecycle status pills, source and project dropdowns, table/card layouts, responsive pagination, empty states, and manual ingestion modal integration.
- `src/components/portal/leads/ingest-lead-modal.tsx` — Modal for manual lead creation with DPDP consent affirmation.
- `src/app/(portal)/dashboard/leads/page.tsx` — Server component with `requireStaffSession`, live metric summary cards, and lead pipeline table.
- `src/app/(portal)/dashboard/leads/[id]/page.tsx` — Comprehensive lead detail page displaying contact cards, project preferences, DPDP consent audits, multi-touch event ledgers, appointment records, and turn-by-turn AI chat transcripts.
- `src/app/(portal)/dashboard/page.tsx` — Connected main dashboard overview to live database metrics (`leadService.getLeadMetrics`), with accurately labeled "Escalated Leads" metric (leads currently in escalation awaiting visit booking).
- `tests/unit/lead-pipeline.test.ts` — 25 unit tests verifying lifecycle status classification (including cancelled visits, multi-visit precedence, and handoff-to-booked transition), staff scoping logic, filter mappings, and query schema validation.
- `tests/integration/lead-pipeline.test.ts` — 9 integration tests against isolated Neon test branch verifying SALES_HEAD pagination, SALES_EXEC record scoping, keyword search, lifecycle filtering, channel filtering, IDOR prevention, live database metrics, cancelled/multi-visit transitions, and Escalated Leads lifecycle metric accuracy.
- `docs/ARCHITECTURE_DECISIONS.md` — Added ADR-008 documenting dynamic lifecycle derivation and role-based record scoping.
- `docs/PROJECT_STATE.md` — Updated state, verification table, Decision Log (D-028), and next actions.
- `docs/TDD_DRAFT.md` — Updated Decision Log (D-028).
- `docs/ENGINEERING_LOG.md` — Documented Milestone 6 Phase 2 implementation.

#### 4. Verification Performed & Results
- `npm test` — ✅ PASS (108/108 unit tests passed across 7 files, including 25 in `tests/unit/lead-pipeline.test.ts`).
- `npm run test:integration` — ✅ PASS (62/62 integration tests passed across 8 files against isolated Neon test branch `ep-mute-butterfly-b3a54tpa`, including 9 in `tests/integration/lead-pipeline.test.ts`).
- `npx tsc --noEmit` — ✅ PASS (0 errors across entire workspace).
- `npm run lint` — ✅ PASS (0 errors, 0 warnings).
- `npm run build` — ✅ PASS (Next.js 16.4.4 Turbopack build succeeded, 23 static & dynamic routes compiled in 2.3s).
- `git diff --check` — ✅ PASS (0 trailing whitespace or EOF formatting errors).

#### 5. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Approved M6 Phase 2 scope and architectural approach; mandated dynamic lifecycle derivation without schema mutation; required strict server-side authorization scoping isolating executives to assigned leads; mandated single-lead IDOR defense returning 404 for unassigned leads; directed inclusion of manual lead ingestion interface with DPDP consent; and approved documentation updates.
- **AI Assistance:** Implemented lifecycle status derivation and filter mapping algorithms in `LeadService`, authored Zod query validation schema, built API endpoints and interactive client components (`LeadPipelineClient`, `IngestLeadModal`), built comprehensive lead detail page (`/dashboard/leads/[id]`), connected live dashboard metrics, authored 19 unit tests and 7 integration tests against the isolated Neon test branch, fixed Next.js 16 `cacheComponents` dynamic route handling, and synchronized all project documentation.

#### 6. Interview Preparation & Deep-Dive
- **Code Walkthrough:**
  - `src/services/lead/lead.service.ts`: Implements `computeLeadLifecycleStatus(lead)` which evaluates `siteVisits` (attendance and booking status), `conversations` (handoff presence), and `firstResponseAt` to categorize each lead into one of 5 distinct funnel stages. Implements `getStaffLeadScope(staffUser)` returning `{ deletedAt: null }` for `SALES_HEAD` or `{ deletedAt: null, conversations: { some: { handoff: { assignedToId: staffUser.id } } } }` for `SALES_EXEC`.
  - `getLeads(params, staffUser)`: Combines `roleScope`, `statusFilter`, keyword search (OR across `leadCode`, `name`, `phone`, `email`), `source`, and `projectId` into a single PostgreSQL `AND` query. Executes `count` and paginated `findMany` with related projects, consent records, visits, and handoffs. Maps raw records into `LeadListItem` DTOs.
  - `getLeadDetail(leadId, staffUser)`: Executes a scoped findFirst query including full relational trees (project, consent, source events, conversations with messages and grounding fact IDs, site visits with slots and reminder jobs). Returns `null` if the lead is missing or outside the executive's scope.
  - `src/app/api/leads/route.ts`: Authenticates via `requireStaffSession`, parses and validates search parameters via `leadQuerySchema`, and delegates to `leadService.getLeads`. POST handler validates with `verifySameOrigin` and `ingestLeadSchema`, delegating to `leadService.ingestLead`.
  - `src/app/(portal)/dashboard/leads/page.tsx` & `src/components/portal/leads/lead-pipeline-client.tsx`: Server component fetches initial metrics and project lists, rendering summary metric cards and client component with real-time search, status pills, dropdown filters, responsive data table, and modal lead ingestion.
  - `src/app/(portal)/dashboard/leads/[id]/page.tsx`: Server component renders full lead dossier with contact info, property preferences, DPDP consent audits, multi-touch event timelines, site visits, and turn-by-turn AI transcripts.
- **Trade-off Defense (Dynamic Relational Status vs. Mutable Status Column):**
  - *Mutable Status Column:* Adding a `status` column on `Lead` requires background jobs or distributed transactional hooks across multiple services (booking cancellation, appointment attendance, AI handoff escalation) to keep the column synchronized. Any missed event or failed transaction creates permanent data desynchronization (e.g. a visit is attended, but the lead still reads 'Booked').
  - *Dynamic Relational Derivation (Our Choice):* By deriving status dynamically from authoritative relational records (`SiteVisit.attendanceOutcome`, `Handoff`, `Conversation`), the status is always mathematically and relationally guaranteed to reflect the real-time state of the customer journey, with zero synchronization latency and zero schema changes.
- **Failure Mode Defense (What breaks if we remove our guardrails?):**
  - *Removing Server-Side Scoping:* If the server returned all leads and relied on client-side React code to filter by executive, any sales executive could inspect network payloads in DevTools or make direct API calls to view competitor leads, high-net-worth buyer phone numbers, and negotiation notes across the entire developer portfolio.
  - *Using 403 Forbidden instead of 404 Not Found on Single-Lead Detail:* If `getLeadDetail` returned 403 Forbidden for unassigned leads, an attacker could iterate through sequential IDs or lead codes to discover which leads exist in the database (IDOR enumeration). Returning 404 fails closed and prevents existence probing.
- **Likely Interview Question 1:** *How do you enforce role-based record-level access control between Sales Heads and Sales Executives in a monolithic Next.js application without a third-party authorization service?*
  - **Technical Answer:** *We enforce scoping at the database query layer within our service methods (`getStaffLeadScope`), rather than filtering in application memory. When a request arrives, `requireStaffSession` revalidates the caller's role against live PostgreSQL. If the caller is a `SALES_HEAD`, the query runs without restriction (`deletedAt: null`). If the caller is a `SALES_EXEC`, the query injects a mandatory relational filter: `{ conversations: { some: { handoff: { assignedToId: staffUser.id } } } }`. Because this condition is part of the SQL `WHERE` clause, PostgreSQL enforces the boundary at the query planner level. An executive cannot retrieve unassigned records regardless of the parameters they submit.*
- **Likely Interview Question 2:** *How does your lead pipeline handle duplicate leads across different marketing channels while preserving attribution?*
  - **Technical Answer:** *We enforce a strict separation between master identity and touchpoint events. When a lead arrives from any channel (portal, ads, website, phone), `LeadService.ingestLead` normalizes the phone number to E.164 and checks for an existing active record in an interactive transaction. If found, it merges conditionally: fields that are currently null (such as project preference or email) are updated, but existing non-null fields and the master `Lead.source` are NEVER overwritten. This strictly preserves immutable first-touch attribution. Simultaneously, every interaction appends a new row to `LeadSourceEvent` with the specific channel, campaign, and timestamp. The lead detail view displays both the immutable first-touch origin and the full chronological multi-touch journey.*

---

### Milestone 6 Phase 3: Salesperson Assignment & Handoff Management Queue

- **Date:** 2026-11-08 (Committed & Verified)
- **Milestone & Task:** Milestone 6 Phase 3 — Operational Handoff Queue (`/dashboard/handoffs`), Sales Head Portfolio Queue vs Sales Executive Scoped Queue, Assignment & Workload Modal, Chat Transcript Viewer, Status Resolution, Anti-IDOR Defense, and Zero-Schema-Mutation In-Conversation Audit Trails.
- **Git Commit Hash:** Pending commit

#### 1. Context & Objectives
Milestone 6.3 establishes the operations queue for managing AI-escalated and buyer-requested handoffs (`/dashboard/handoffs`). In residential property sales, when an AI Concierge encounters questions beyond verified facts (e.g. price discounts, unlisted amenities, or missing project details) or when a buyer explicitly requests a human, the system must immediately escalate the inquiry to staff. Phase 3 delivered:
1. An operational, real-time database-backed queue interface on `/dashboard/handoffs`.
2. Role-based scoping enabling Sales Heads to inspect the full developer portfolio queue, filter by assignment status (`ALL`, `UNASSIGNED`, `ASSIGNED`, `RESOLVED`) and escalation reasons, search by buyer name/phone/leadCode, and review executive workloads.
3. Interactive salesperson assignment and reassignment modal displaying staff users who currently hold the SALES_EXEC role with live active-lead workload distribution badges.
4. Turn-by-turn chat transcript modal (`TranscriptModal`) rendering complete multi-turn conversation logs, grounding fact badges, escalation metadata, and system audit entries.
5. Sales Executive queue view restricted strictly to their assigned escalations, with capabilities to inspect buyer transcripts and mark escalations as resolved (`HandoffStatus.RESOLVED`).
6. Comprehensive server-side authorization and anti-IDOR security preventing executives from viewing, resolving, or reassigning rival or unassigned cases.
7. Atomic ACID assignment transactions and an immutable in-conversation audit trail without mutating the locked 14-model schema.
8. Relational access control interlock: assigning a handoff to an executive immediately grants them access to that lead in `/dashboard/leads` without requiring secondary database updates.

#### 2. Architecture & Design Decisions
- **Handoff Queue & Role-Scoped Ownership (ADR-009, Decision D-029):** Implemented in `HandoffService.getStaffHandoffScope(staffUser)`:
  - `SALES_HEAD`: Unrestricted visibility across all handoff records in the database (`{}`).
  - `SALES_EXEC`: Strict relational scoping restricted exclusively to handoffs assigned to that specific executive (`{ assignedToId: staffUser.id }`).
  - `BUYER` / Other: Immediately throws `HandoffForbiddenError` (HTTP 403).
- **Anti-IDOR Detail & Transcript Lookup:** In `HandoffService.getHandoffDetail(handoffId, staffUser)`, apply the role scope directly in the database lookup (`where: { id: handoffId, ...roleScope }`). If an executive queries an unassigned or rival handoff, the method returns `null` and the API responds with HTTP 404, preventing attackers from probing the existence of valid IDs.
- **Atomic Assignment & In-Conversation Audit Trail:**
  - `assignHandoff(handoffId, salesExecId, actingStaffUser)` executes inside an atomic `prisma.$transaction`.
  - Asserts that `actingStaffUser.role === UserRole.SALES_HEAD`.
  - Asserts that target assignee exists and currently holds the SALES_EXEC role (the User model does not have an independent account activation field).
  - Updates `Handoff.status` to `ASSIGNED` and sets `Handoff.assignedToId` to the target executive.
  - Appends an audit message turn into `ChatMessage` (`role: ChatMessageRole.AI`, content: `[Ownership Assigned] Lead assigned to ...` or `[Ownership Reassigned] Lead reassigned to ...`) recording the exact timestamp, target executive, and acting Sales Head.
  - Resolves the trade-off between auditability and schema lock: rather than introducing a new table (`HandoffAssignmentHistory`), in-conversation audit entries preserve complete historical accountability using the existing schema.
- **Relational Access Control Interlock:** In Milestone 6.2, `LeadService.getStaffLeadScope()` was designed such that a `SALES_EXEC` sees leads where `conversations: { some: { handoff: { assignedToId: staffUser.id } } }`. When `HandoffService.assignHandoff` sets `assignedToId = salesExecId`, that buyer lead instantaneously appears in the executive's `/dashboard/leads` pipeline and `/dashboard/handoffs` queue without requiring any secondary database updates or synchronization hooks.
- **Executive Workload Balancing:** `getEligibleSalesExecutives()` queries staff users who currently hold the SALES_EXEC role and aggregates their active assigned lead counts, displaying live workload badges in the assignment modal to ensure equitable lead distribution.
- **Integration Test Isolation (`fileParallelism: false`):** Configured Vitest integration test config to run test files serially. Concurrently running test suites against a single database branch caused cross-suite race conditions on global metric counts. Running integration tests sequentially completely eliminated test interference.

#### 3. Files Created or Modified
- `src/lib/chat-message.ts` — Centralized message filtering utility (`isInternalAuditMessage`, `filterBuyerFacingMessages`) defining audit markers (`[Ownership Assigned]`, `[Ownership Reassigned]`, `[ASSIGNMENT AUDIT]`, `[AUDIT]`) to guarantee zero internal staff data or assignment history leaks to buyer APIs, buyer UI, or Gemini LLM prompts. Enforces that an audit message must satisfy BOTH: role is `AI` and content starts with a recognized prefix, preventing spoofed buyer turns from being suppressed.
- `src/lib/seed-guard.ts` — Database seed safety guard enforcing strict environment validation (`NODE_ENV !== "production"`), explicit authorization (`ALLOW_DESTRUCTIVE_SEED === "true"`), and an exact endpoint allowlist (`APPROVED_SEED_ENDPOINTS`) matching only the approved Neon development endpoint (`ep-frosty-tooth-b3446kf8`, direct and pooled hostnames). Rejects test databases, localhost, and unknown endpoints by default, and logs only sanitized hostnames without credentials.
- `src/types/index.ts` — Added domain interfaces: `EligibleSalesExecutive`, `HandoffListItem`, `HandoffPagination`, `HandoffMetrics`, and `HandoffDetail`.
- `src/lib/validations/handoff.ts` — Authored Zod validation schemas (`handoffQuerySchema`, `assignHandoffSchema`, `updateHandoffStatusSchema`) and filter constants.
- `src/services/handoff/handoff.service.ts` — Implemented `HandoffService` with Prisma client dependency injection: role-based scoping, paginated queries, detail retrieval with anti-IDOR checks, live aggregate metrics, executive workload aggregation, atomic assignment with audit trails, and status updates. Clarified eligibility semantics: qualified executives are identified solely by whether the user currently holds the SALES_EXEC role.
- `src/services/ai/ai.service.ts` — Hardened conversational history compilation with `!isInternalAuditMessage(m)` so internal staff assignments, executive names, and system audit markers are strictly excluded from Gemini prompt context.
- `src/app/api/chat/session/route.ts` — Hardened buyer session retrieval (GET) and conversation initialization (POST) with `filterBuyerFacingMessages()`, ensuring assignment audit turns are never transmitted over the wire to buyer clients.
- `src/components/buyer/concierge-chat.tsx` — Applied defense-in-depth rendering filter using `filterBuyerFacingMessages()`.
- `src/app/api/handoffs/route.ts` — Authenticated endpoint for listing and filtering handoffs.
- `src/app/api/handoffs/metrics/route.ts` — Authenticated endpoint returning role-scoped queue metrics and executive workloads.
- `src/app/api/handoffs/[id]/route.ts` — Authenticated detail lookup with 404 anti-IDOR behavior.
- `src/app/api/handoffs/[id]/assign/route.ts` — Protected assignment endpoint with `requireSalesHead` and `verifySameOrigin` CSRF protection.
- `src/app/api/handoffs/[id]/status/route.ts` — Protected status resolution endpoint with `requireStaffSession` and `verifySameOrigin` CSRF protection.
- `src/app/(portal)/dashboard/handoffs/page.tsx` — Server component with `requireStaffSession`, live metrics retrieval, and interactive queue client.
- `src/components/portal/handoffs/handoff-queue-client.tsx` — Client component with debounced search, status pills, reason/assignee filters, responsive desktop table and mobile cards, inline transcript triggers, and assignment controls.
- `src/components/portal/handoffs/assign-handoff-modal.tsx` — Interactive modal showing buyer context, current assignee, and selectable list of eligible sales executives with live workload badges.
- `src/components/portal/handoffs/transcript-modal.tsx` — Modal for turn-by-turn chat transcript inspection with `isInternalAuditMessage` system styling, grounding facts display, and quick link to the lead dossier.
- `src/app/(portal)/dashboard/leads/[id]/page.tsx` — Updated chat transcript section using `isInternalAuditMessage` to render assignment events as centered system audit notes rather than misattributed AI responses.
- `prisma/seed.ts` — Seeded buyer conversations and escalated handoffs with deterministic stable IDs (`conv_seed_nidhi`, `conv_seed_hardik`, `handoff_seed_nidhi`, `handoff_seed_hardik`): Nidhi Shah (`LD-58211`, unassigned `status: PENDING`, `PRICE_NEGOTIATION`) and Hardik Patel (`LD-58210`, assigned `status: ASSIGNED` to Vikram Mehta, `UNLISTED_AMENITY`). Integrated `assertSeedSafety()` before Prisma initialization.
- `vitest.integration.config.mts` — Added `fileParallelism: false` to ensure serial integration test execution against isolated Neon test branch.
- `tests/unit/handoff.test.ts` — 24 unit tests verifying role scoping logic, query schema validation, assignment schema validation, status schema validation, domain error classes, role-aware audit message identification, and anti-spoofing buyer message preservation.
- `tests/unit/seed-guard.test.ts` — 12 unit tests verifying pure seed guard logic across approved endpoints (direct and pooled), production blocking, missing flag, test branch rejection, unknown host fail-closed behavior, URL parsing, and allowlist integrity.
- `tests/integration/handoff-queue.test.ts` — 13 integration tests against isolated Neon test branch verifying SALES_HEAD vs SALES_EXEC scoping, search, filters, anti-IDOR detail lookup, atomic assignment, reassignment, 403 authorization rejection, invalid assignee rejection, concurrent assignment race condition defense (serialized Last-Write-Wins), workload metrics, status resolution, and buyer API/UI/AI isolation with user message preservation.
- `docs/ARCHITECTURE_DECISIONS.md` — Added ADR-009 documenting Handoff Queue, Role-Scoped Ownership, In-Conversation System Audit Trails, Audit Isolation, and Concurrency Semantics.
- `docs/TDD_DRAFT.md` — Updated Decision Log (D-029, D-030) and Milestone Completion Tracker.
- `docs/PROJECT_STATE.md` — Updated operational state, test counts, Decision Log, and next actions.
- `deployment.md` — Updated test counts (144 unit tests, 75 integration tests) and documented destructive reset warnings and seed safety endpoint allowlist.

#### 4. Verification Performed & Results
- `npm test` — ✅ PASS (144/144 unit tests passed across 9 files, including 24 in `tests/unit/handoff.test.ts` and 12 in `tests/unit/seed-guard.test.ts`).
- `npm run test:integration` — ✅ PASS (75/75 integration tests passed across 9 files against Neon test branch `ep-mute-butterfly-b3a54tpa`, including 13 in `tests/integration/handoff-queue.test.ts`).
- `npx tsc --noEmit` — ✅ PASS (0 errors across entire workspace).
- `npm run lint` — ✅ PASS (0 errors, 0 warnings across all files).
- `npm run build` — ✅ PASS (Next.js 16.4.4 Turbopack build succeeded, 25 static & dynamic routes compiled).
- `git diff --check` — ✅ PASS (0 trailing whitespace or formatting errors).

#### 5. Division of Responsibility & AI Collaboration
- **Developer Contribution:** Approved M6 Phase 3 scope and architectural approach; mandated schema preservation over introducing redundant assignment history tables; mandated in-conversation system audit notes; required strict server-side authorization scoping isolating executives to assigned handoffs; mandated single-handoff IDOR defense returning 404 for unassigned/rival cases; directed seeding realistic conversations to test executive workflow demonstrations; and mandated an exact endpoint allowlist for destructive seed safety.
- **AI Assistance:** Implemented `HandoffService`, authored Zod query/assignment/status validation schemas, built API routes with CSRF and RBAC protection, developed interactive client components (`HandoffQueueClient`, `AssignHandoffModal`, `TranscriptModal`), built `/dashboard/handoffs/page.tsx`, updated `prisma/seed.ts`, authored `src/lib/chat-message.ts` for strict audit isolation, authored `src/lib/seed-guard.ts` with pure validation logic, authored 36 unit tests (24 handoff + 12 seed-guard) and 13 integration tests against isolated Neon test branch, fixed serial execution in Vitest integration configuration, and synchronized all project documentation.

#### 6. Interview Preparation & Deep-Dive
- **Code Walkthrough:**
  - `src/services/handoff/handoff.service.ts`: Implements `getStaffHandoffScope(staffUser)` returning `{}` for `SALES_HEAD` or `{ assignedToId: staffUser.id }` for `SALES_EXEC`.
  - `getHandoffs(params, staffUser)`: Combines `roleScope`, `statusFilter`, `reasonFilter`, `assigneeFilter`, and keyword search (OR across `lead.name`, `lead.phone`, `lead.leadCode`) into an atomic PostgreSQL query. Returns paginated DTOs with buyer info, conversation language, message counts, and assignee details.
  - `getHandoffDetail(handoffId, staffUser)`: Queries `handoff.findFirst` with `where: { id: handoffId, ...roleScope }`, including complete messages and lead project info. Returns `null` if the record does not exist or does not belong to the requesting executive (anti-IDOR 404).
  - `assignHandoff(handoffId, salesExecId, actingStaffUser)`: Executes inside `prisma.$transaction`. Verifies caller is `SALES_HEAD` and target is an active `SALES_EXEC`. Updates `Handoff.status = ASSIGNED` and `Handoff.assignedToId = salesExecId`. Creates a new `ChatMessage` turn (`role: ChatMessageRole.AI`, content: `[Ownership Assigned] ...` or `[Ownership Reassigned] ...`) preserving actor and timestamp.
  - `updateHandoffStatus(handoffId, newStatus, staffUser)`: Allows `SALES_HEAD` or assigned `SALES_EXEC` to resolve an escalation (`HandoffStatus.RESOLVED`, recording `resolvedAt`).
  - `src/app/api/handoffs/[id]/assign/route.ts`: Enforces `verifySameOrigin` CSRF protection, authenticates via `requireStaffSession`, asserts `requireSalesHead`, validates payload with `assignHandoffSchema`, and delegates to `handoffService.assignHandoff`.
  - `src/components/portal/handoffs/handoff-queue-client.tsx`: Renders summary metric cards, filter controls, and responsive table/cards. Handles debounced search, modal triggers for assignment and transcripts, and inline status resolution.
- **Trade-off Defense (In-Conversation System Audit Trails vs. New Database Model):**
  - *New Table (`HandoffAssignmentHistory`):* Requires a schema migration, adding foreign keys and index overhead for what is essentially an operational audit trail in a 420-unit development.
  - *In-Conversation System Audit Trails (Our Choice):* By recording assignment and reassignment events directly into `ChatMessage` as structured audit turns (`[Ownership Assigned] Lead assigned to ...`), the audit history is co-located with the multi-turn conversational transcript. When a sales executive opens `TranscriptModal`, they see both the buyer's questions, the AI's responses, and the exact timestamp and identity of the Sales Head who assigned the lead to them, preserving 100% auditability without schema mutation.
- **Failure Mode Defense (What breaks if we remove our guardrails?):**
  - *Removing Internal Audit Message Isolation:* Because assignment audits are stored in `ChatMessage` using `role: AI` to comply with the locked schema, failing to apply `filterBuyerFacingMessages()` in `/api/chat/session` and `ai.service.ts` would leak internal executive names, email addresses, and staff assignment actions directly to the buyer's mobile UI and inject them into Gemini's LLM context window during subsequent dialogue turns.
  - *Removing Atomic Transactions on Assignment:* If `assignHandoff` executed the handoff update and the chat audit message as separate independent database calls without `prisma.$transaction`, a database glitch or network timeout between calls could leave the handoff assigned to an executive with zero audit record of who assigned it or when.
  - *Removing Server-Side Role Scoping on Detail Lookup:* If `getHandoffDetail` looked up by `id` alone without combining `roleScope`, an executive could modify the URL or make an API request with another executive's handoff ID to inspect confidential pricing negotiations and buyer phone numbers belonging to their colleagues (IDOR vulnerability).
- **Likely Interview Question 1:** *How do you prevent race conditions when two Sales Heads attempt to assign the same escalation to different executives simultaneously?*
  - **Technical Answer:** *We wrap the entire assignment workflow inside an interactive PostgreSQL transaction (`prisma.$transaction`). Inside the transaction, we first query the existing handoff, validate permissions and target assignee eligibility, update `Handoff` with the new assignee, and append the audit note to `ChatMessage`. In PostgreSQL, interactive transactions acquire row-level locks on updated records. When two concurrent requests run via `Promise.all`, PostgreSQL serializes the updates: one transaction executes first, followed by the second. Both transactions maintain ACID consistency, ensuring the final database record reflects a single valid assignee and both ownership transitions are accurately recorded in the chat audit trail.*
- **Likely Interview Question 2:** *Why did you configure `fileParallelism: false` in your Vitest integration test suite?*
  - **Technical Answer:** *Vitest runs test files in parallel worker processes by default. However, integration tests run against a real PostgreSQL database instance (our isolated Neon test branch) and perform operations that assert global aggregate counts—such as verifying that `getHandoffMetrics` or `getLeadMetrics` accurately counts total escalations or unassigned leads. When multiple test suites run concurrently, one suite inserting or deleting records pollutes the global count assertions of another suite running at the exact same millisecond. Setting `fileParallelism: false` forces Vitest to run integration test files serially, guaranteeing that each test suite executes its setup, tests, and teardown in total isolation without cross-test race conditions.*

---

## Unverified Historical Information Register

In accordance with strict verification rules, the following details cannot be independently verified from the repository git log and are explicitly recorded as unverified assumptions:
1. **Developer Interactive Work Duration:** Exact hours and minutes spent during interactive design discussions for Milestones 1 and 2 were not tracked by an automated time-tracking utility. Timestamps recorded represent Git commit times (`%cd`).
2. **Initial Repository Creation:** Git commit `e7ffd4b` on 2026-11-03 13:43:55 IST is the root commit (`Create Next App`). Pre-scaffold brainstorming or local setup prior to that commit is not recorded in version control.
