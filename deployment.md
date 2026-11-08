# ENQUIVO — Deployment Guide

> **GitHub URL:** *(to be added at Milestone 8)*
> **Live URL:** *(to be added at Milestone 8)*

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development Setup](#2-local-development-setup)
3. [Environment Variables Reference](#3-environment-variables-reference)
4. [Database Setup (Neon PostgreSQL)](#4-database-setup-neon-postgresql)
5. [Running the Application](#5-running-the-application)
6. [Running Inngest (Background Jobs) Locally](#6-running-inngest-background-jobs-locally)
7. [Running Tests](#7-running-tests)
8. [Production Deployment (Vercel)](#8-production-deployment-vercel)
9. [CI/CD (GitHub Actions)](#9-cicd-github-actions)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| Node.js | 20.x LTS | https://nodejs.org |
| npm | 10.x | Bundled with Node 20 |
| Git | 2.x | https://git-scm.com |
| PostgreSQL | 15+ (or Neon account) | https://neon.tech |

---

## 2. Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/enquivo.git
cd enquivo

# 2. Install dependencies
npm install

# 3. Copy the environment variable template
cp .env.example .env.local

# 4. Fill in .env.local with your real values
# (See Section 3 for all variables)

# 5. Generate the Prisma client
npx prisma generate

# 6. Run database migrations
npx prisma migrate dev --name init

# 7. Seed the database with sample data
npx prisma db seed

# 8. Start the development server
npm run dev
```

The app will be available at: **http://localhost:3000**

---

## 3. Environment Variables Reference

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string (with `?sslmode=require`) | `postgresql://user:pass@host/db?sslmode=require` |
| `AUTH_SECRET` | ✅ | Secret for Auth.js session signing. Generate: `openssl rand -base64 32` | `abc123...` |
| `AUTH_URL` | ✅ | Full URL of the application (no trailing slash) | `http://localhost:3000` |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key (never expose as `NEXT_PUBLIC_`) | `AIza...` |
| `INNGEST_EVENT_KEY` | ✅ | Inngest event key from the Inngest Cloud dashboard | `event-...` |
| `INNGEST_SIGNING_KEY` | ✅ | Inngest signing key for webhook verification | `signkey-...` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public-facing app URL (safe to expose to browser) | `http://localhost:3000` |
| `APP_TIMEZONE` | Optional | Display timezone (default: `Asia/Kolkata`) | `Asia/Kolkata` |
| `NODE_ENV` | Auto-set | `development` / `production` / `test` | `development` |

> **Security:** Never commit `.env`, `.env.local`, or any file containing real values. The `.gitignore` already excludes `.env*`.

---

## 4. Database Setup (Neon PostgreSQL)

### Option A: Neon (Recommended for production)

1. Create a free account at https://neon.tech
2. Create a new project named `enquivo`
3. Copy the **Connection string** (with `?sslmode=require`) from the dashboard
4. Set it as `DATABASE_URL` in `.env.local`

### Option B: Local PostgreSQL

```bash
# Create a local database
createdb enquivo_dev

# Set DATABASE_URL (no sslmode needed locally)
# DATABASE_URL="postgresql://postgres:password@localhost:5432/enquivo_dev"
```

### Migrations & Seeding

```bash
# Validate schema syntax (offline)
npx prisma validate

# Generate Prisma Client (offline)
npx prisma generate

# Apply pending database migrations to PostgreSQL
npx prisma migrate deploy

# Seed the database with date-aware fixture data (requires explicit authorization)
ALLOW_DESTRUCTIVE_SEED=true npx prisma db seed
# or: ALLOW_DESTRUCTIVE_SEED=true npm run db:seed

# Reset DB and re-seed (cleans and re-applies migrations)
npx prisma migrate reset

# Open Prisma Studio (visual DB browser)
npx prisma studio
```

> [!CAUTION]
> **Destructive Database Reset Notice & Seed Safety Protocol:**
> 1. **Destructive Reset Nature:** `npx prisma db seed` is a **destructive development/demo database reset tool**, NOT an incremental or append-only seeder. It executes table-wide deletion across all 14 schema tables in reverse relational dependency order before inserting the baseline seed dataset.
> 2. **Evaluator Data Deletion:** Executing the seed script permanently deletes any dynamic records created during evaluation sessions (including manually ingested leads, confirmed site visit bookings, new buyer chat conversations, handoff assignments, and staff login sessions).
> 3. **Deterministic ≠ Non-Destructive:** Repeatable, deterministic seeding means the resulting baseline data is identical across runs—it does **NOT** mean non-destructive.
> 4. **Post-Evaluation Constraint:** Do **NOT** run the seed script after interactive evaluation workflows begin unless you deliberately intend to wipe the demo database back to its Day-0 baseline.
> 5. **Strict Endpoint Allowlist (`src/lib/seed-guard.ts`):** The seed script enforces a strict endpoint allowlist. It runs only when `NODE_ENV !== "production"`, `ALLOW_DESTRUCTIVE_SEED === "true"`, and the connection hostname exactly matches an approved development endpoint:
>    - Direct: `ep-frosty-tooth-b3446kf8.c-4.ap-southeast-1.aws.neon.tech`
>    - Pooled: `ep-frosty-tooth-b3446kf8-pooler.c-4.ap-southeast-1.aws.neon.tech`
>    All other endpoints—including production URLs, localhost, and the isolated integration test branch (`ep-mute-butterfly-b3a54tpa`)—are rejected by default and fail closed.

### Seeded Synthetic Evaluator Accounts & Credentials (Demo Environment Only)

The seed script (`npx prisma db seed`) populates synthetic evaluator demonstration accounts with production-grade Argon2id password hashes. **These accounts and passwords are for assessment demonstration only and must never be used in a production environment.**

| Role | Staff Member | Email | Password | Access Level |
|---|---|---|---|---|
| `SALES_HEAD` | Aarav Sharma | `sales-head@enquivo.in` | `DemoEval#Head2026!` | Full Admin: Fact Sheet Governance, Leads, Handoffs, Visits, Source Analytics |
| `SALES_EXEC` | Vikram Mehta | `vikram.mehta@enquivo.in` | `DemoEval#ExecVikram2026!` | Sales Executive: Leads, Handoffs, Visits, Source Analytics |
| `SALES_EXEC` | Priya Desai | `priya.desai@enquivo.in` | `DemoEval#ExecPriya2026!` | Sales Executive: Leads, Handoffs, Visits, Source Analytics |

To access the staff operations portal:
1. Navigate to `/login` in your browser.
2. Sign in with any of the synthetic accounts above (in development mode or with `NEXT_PUBLIC_ENABLE_DEMO_LOGINS=true`, convenient one-click autofill buttons are rendered). In production environments, autofill is completely disabled.
3. Authenticated sessions issue an HTTP-only `eq_staff_session` bearer cookie valid for 12 hours (embedding `rawToken` in an HMAC-signed envelope) with persistent PostgreSQL revocation tracking (`StaffSession` model, migration `20261107065456_add_staff_sessions`, storing only `tokenHash = SHA-256(rawToken)`) upon logout.
4. Database role revalidation ensures that deleted accounts, demoted roles, or revoked tokens are rejected immediately on every request.

### Operational Portal Modules & Access Control (Milestone 6)

| Portal Route | Description | `SALES_HEAD` Access | `SALES_EXEC` Access |
|---|---|---|---|
| `/dashboard/leads` | Unified Lead Pipeline & Dossiers | Portfolio-wide (all leads, multi-touch attribution, AI transcripts) | Assigned leads only (`lead.conversations.some.handoff.assignedToId == user.id`) |
| `/dashboard/handoffs` | Handoff Queue & Workload Distribution | Full portfolio queue, reassign executives, inspect AI transcripts, resolve | Assigned escalations only, inspect AI transcripts, resolve |
| `/dashboard/fact-sheet` | Fact Sheet Approval Governance | Full access (create, edit, verify, reject); edits demote verified facts to `UNVERIFIED` | Forbidden (HTTP 403) |
| `/dashboard/visits` | Site Visits Ledger & Slot Manager | Portfolio visits, mark attendance, cancel visits, create slots, modify/delete unbooked slots | Assigned visits only, mark attendance, cancel visits; read-only slot list |

### PostgreSQL Partial Unique Index Verification

After migration, verify the partial index directly in PostgreSQL:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'site_visits'
  AND indexname = 'one_active_booking_per_slot';
```

**Expected Output (once applied to PostgreSQL):**
```
indexname                   | indexdef
----------------------------+-------------------------------------------------------------------------------------------------------------------
one_active_booking_per_slot | CREATE UNIQUE INDEX one_active_booking_per_slot ON public.site_visits USING btree (slot_id) WHERE (booking_status = 'CONFIRMED'::"BookingStatus")
```

---

## 5. Running the Application

```bash
# Development (with hot reload, Turbopack)
npm run dev

# Production build (verify before deploying)
npm run build

# Start production server (after build)
npm start

# Type-check only (no emit)
npx tsc --noEmit

# Lint
npm run lint
```

---

## 6. Running Inngest (Background Jobs) Locally

Inngest handles the 24-hour and 2-hour pre-visit reminder jobs via background cron and event processing. The `/api/inngest` Route Handler (`src/app/api/inngest/route.ts`) and functions (`src/services/reminder/reminder.inngest.ts`) are fully implemented.

```bash
# In a separate terminal, start the Inngest dev server pointing to the Next.js endpoint:
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest

# The Inngest local development UI will be available at: http://localhost:8288
```

You can trigger a reminder sweep manually from the Inngest Dev Server dashboard by sending the event:
```json
{
  "name": "enquivo/reminders.process"
}
```

---

## 7. Running Tests

The test suite is partitioned into unit tests and isolated database integration tests:

```bash
# 1. Run scoped unit tests (serializers and Zod validation rules)
npm test

# 2. Run isolated PostgreSQL integration tests (against isolated Neon test branch)
npm run test:integration

# 3. Unit test watch mode
npm run test:watch

# 4. Coverage report
npm run test:coverage

# 5. End-to-end tests (Playwright) — configured in Milestone 7
# npm run test:e2e
# npm run test:e2e:ui
```

> **Current state:** `npm test` — ✅ CONFIGURED & PASSING (191/191 unit tests across 12 files). `npm run test:integration` — ✅ CONFIGURED & PASSING (98/98 integration tests across 11 files against isolated Neon test branch). `npm run test:e2e` — NOT CONFIGURED (configured in Milestone 7).

---

## 8. Production Deployment (Vercel)

### One-time Setup

1. Push your repository to GitHub
2. Go to https://vercel.com → **New Project** → Import your GitHub repo
3. Vercel auto-detects Next.js — accept defaults
4. Add all environment variables from Section 3 in the Vercel **Environment Variables** settings panel
5. Click **Deploy**

### Subsequent Deployments

```bash
# Push to main branch triggers automatic Vercel deployment
git push origin main
```

### Vercel Project Settings

| Setting | Value |
|---|---|
| Framework Preset | Next.js |
| Build Command | `npm run build` |
| Install Command | `npm install` |
| Output Directory | `.next` (auto-detected) |
| Node.js Version | 20.x |

### Post-deploy: Run Migrations

After first production deployment, run migrations against the Neon production DB:

```bash
# Set DATABASE_URL to production Neon connection string
DATABASE_URL="<production-url>" npx prisma migrate deploy
DATABASE_URL="<production-url>" npx prisma db seed
```

---

## 9. CI/CD (GitHub Actions)

> **Note:** GitHub Actions workflow is configured in Milestone 8.

Planned CI checks on every pull request:

```yaml
# .github/workflows/ci.yml (Milestone 8)
- npx tsc --noEmit      # TypeScript
- npm run lint          # ESLint
- npm run build         # Production build
- npm test              # Vitest unit + integration
```

---

## 10. Troubleshooting

| Problem | Solution |
|---|---|
| `DATABASE_URL` connection error | Confirm Neon project is active; check `?sslmode=require` is appended |
| `PrismaClientInitializationError` | Run `npx prisma generate` to regenerate the client |
| `AUTH_SECRET` error on login | Ensure `AUTH_SECRET` is set and has sufficient length (32+ chars) |
| Inngest events not appearing | Confirm Inngest dev server is running on port 8288 and `INNGEST_EVENT_KEY` is set |
| TypeScript errors after adding packages | Run `npx prisma generate` if errors are in `@prisma/client`, then `npx tsc --noEmit` |
| Build fails with `GEMINI_API_KEY` | Ensure key is NOT in a `NEXT_PUBLIC_*` variable — it must stay server-side only |

