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

# Create and apply initial migration to PostgreSQL
npx prisma migrate dev --name init

# Seed the database with date-aware fixture data
npx prisma db seed
# or: npm run db:seed

# Reset DB and re-seed (cleans and re-applies migrations)
npx prisma migrate reset

# Open Prisma Studio (visual DB browser)
npx prisma studio
```

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
npm run test:e2e
```

# E2E UI mode (interactive)
npm run test:e2e:ui
```

> **Current state:** `npm test` — NOT CONFIGURED (Vitest is installed in Milestone 3).

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

