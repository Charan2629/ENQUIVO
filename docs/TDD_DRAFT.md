# ENQUIVO — Technical Design Document (DRAFT)

> **Status:** DRAFT — Updated incrementally per milestone.
> **GitHub URL:** *(to be added at Milestone 8)*
> **Live URL:** *(to be added at Milestone 8)*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema — 13 Models](#4-database-schema--13-models)
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
| Icons | Lucide React | (Milestone 5) |
| Charts | Recharts | (Milestone 7) |
| Forms | React Hook Form + Zod | (Milestone 5) |
| ORM | Prisma | (Milestone 2) |
| Database | Neon PostgreSQL | hosted |
| Auth | Auth.js v5 + Prisma adapter | (Milestone 6) |
| Password Hashing | Argon2id (`@node-rs/argon2`) | (Milestone 6) |
| AI | Google Gemini API (`@google/genai`) | (Milestone 4) |
| Background Jobs | Inngest | (Milestone 3) |
| Date Handling | date-fns + date-fns-tz | (Milestone 2) |
| Unit Tests | Vitest + React Testing Library | (Milestone 3) |
| E2E Tests | Playwright | (Milestone 7) |
| Deployment | Vercel | (Milestone 8) |
| CI | GitHub Actions | (Milestone 8) |
| Package Manager | npm | — |

---

## 4. Database Schema — 13 Models

> **Detail:** Full Prisma schema defined in Milestone 2.

| # | Model | Key Purpose |
|---|---|---|
| 1 | `User` | Roles: `BUYER`, `SALES_EXEC`, `SALES_HEAD`. `SALES_HEAD` governs Fact Sheet editor and daily flagged-chat review. |
| 2 | `Project` | Represents a single real estate project (Project 1 or Project 2, both in Ahmedabad). |
| 3 | `FactSheet` | Stores verified product facts. Fields: `scope` (`PORTFOLIO`\|`PROJECT_1`\|`PROJECT_2`), `status` (`VERIFIED`\|`DRAFT`\|`UNVERIFIED`). |
| 4 | `Lead` | Core lead record. Stores first-touch source (immutable after deduplication merge). |
| 5 | `LeadSourceEvent` | Preserves full source history when duplicate phone numbers merge; enforces first-touch attribution integrity. |
| 6 | `ConsentRecord` | Tracks DPDP Act 2023 explicit consent timestamp and opt-out state. One record per Lead. |
| 7 | `Conversation` | Groups a series of chat messages with a Lead. Tracks language (`EN`\|`HI`\|`GU`). |
| 8 | `ChatMessage` | Persists individual buyer and AI turns with role and grounding metadata. |
| 9 | `Handoff` | Stores AI conversation summary, escalation reason, handoff status, assigned salesperson. |
| 10 | `VisitSlot` | Represents a bookable time slot. Status: `AVAILABLE` \| `BOOKED`. |
| 11 | `SiteVisit` | A booking record. Status: `CONFIRMED` \| `CANCELLED` \| `ATTENDED` \| `NO_SHOW`. Partial unique index enforces at-most-one active (`CONFIRMED`) booking per slot. |
| 12 | `ReminderJob` | Tracks 24h and 2h pre-visit reminder jobs. Includes `idempotencyKey`, `maxAttempts = 3`, state machine: `PENDING → PROCESSING → SENT/FAILED`. |
| 13 | `SourceSpend` | Monthly ad spend per source channel, used for `costPerVisit` ROI calculation. |

### Partial Unique Index (concurrency safety)

```sql
-- Enforces: at most one CONFIRMED booking per slot
CREATE UNIQUE INDEX one_active_booking_per_slot
  ON "SiteVisit"("slotId")
  WHERE status = 'CONFIRMED';
```

This is implemented via Prisma's `@@index` with `map` + raw migration SQL. Cancelled bookings (`status = 'CANCELLED'`) are excluded from the index, allowing re-booking after cancellation.

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
- Auth.js v5 with Prisma adapter manages sessions
- Passwords hashed with **Argon2id** (memory-hard; resistant to GPU brute-force)
- Sessions stored as secure, HTTP-only cookies — never accessible to client-side JavaScript

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

## 9. Booking Lifecycle & Concurrency Control

```
VisitSlot.status:   AVAILABLE ──► BOOKED ──► AVAILABLE (on cancellation)

SiteVisit.status:   CONFIRMED ──► CANCELLED
                    CONFIRMED ──► ATTENDED
                    CONFIRMED ──► NO_SHOW
```

### Atomic Booking Transaction

```typescript
// Pseudocode — implemented in BookingService (Milestone 3)
await prisma.$transaction(async (tx) => {
  // Conditional update: slot must be AVAILABLE
  const result = await tx.$executeRaw`
    UPDATE "VisitSlot" SET status = 'BOOKED'
    WHERE id = ${slotId} AND status = 'AVAILABLE'
  `;
  if (result !== 1) throw new ConflictError('Slot no longer available');

  // Insert CONFIRMED SiteVisit
  const visit = await tx.siteVisit.create({ data: { slotId, leadId, status: 'CONFIRMED' } });

  // Queue ReminderJobs (24h + 2h)
  await queueReminders(tx, visit.id, slot.startsAt);
  return visit;
});
```

### Concurrency Tests (Milestone 3)
1. `Promise.all([book(slotId), book(slotId)])` → exactly 1 succeeds, 1 gets `409 Conflict`
2. Cancel → rebook same slot → succeeds

---

## 10. Scheduled Reminder Processing

| Field | Value |
|---|---|
| Provider | Inngest (hosted) |
| Reminder types | `REMINDER_24H`, `REMINDER_2H` |
| States | `PENDING → PROCESSING → SENT / FAILED` |
| Idempotency key | `${visitId}:${reminderType}` |
| Max attempts | 3 (bounded retry) |
| Delivery | Mock provider only — no real WhatsApp/SMS |
| Cancellation | All `PENDING` reminders for a visit are cancelled atomically when booking is cancelled |

---

## 11. AI Concierge Design

### Languages
Supports EN (English), HI (Hindi), GU (Gujarati). Language detected from buyer preference at conversation start.

### Grounding
- AI retrieves only `status: VERIFIED, isActive: true` FactSheet records
- Tool calls validated with Zod before execution
- Conversation turns persisted in `ChatMessage` with `role` and grounding metadata

### Handoff Triggers (automatic)
- Missing project-specific detail not in FactSheet
- Unlisted amenity question
- Price negotiation request
- Buyer explicitly requests a human
- Three consecutive unclear AI responses

### Tool Functions (Milestone 4)
- `getVerifiedFacts(scope)` — retrieves VERIFIED FactSheet entries
- `checkSlotAvailability(date?)` — returns available visit slots
- `bookVisitSlot(slotId, leadId)` — delegates to BookingService
- `handoffToExecutive(reason, summary)` — creates Handoff record, notifies Sales Exec

---

## 12. Analytics & Metric Definitions

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

## 13. Decision Log

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

---

## 14. Assumptions Register

| ID | Assumption | Label | Impact if Wrong |
|---|---|---|---|
| A-001 | RERA registration numbers are placeholders (`DEMO-ONLY-NOT-VERIFIED`) | `[ASSUMPTION]` | Must be replaced with real RERA numbers before production launch |
| A-002 | Today's reference date is November 3, 2026 | `[ASSUMPTION]` | Hardik Patel's historical booking logic changes; seed date offsets change |
| A-003 | Hardik Patel's `2026-11-01 11:00` booking is in the past — no future reminders | `[ASSUMPTION]` | If reference date changes, seed logic must be re-evaluated |
| A-004 | Source spend of ₹30 lakh/month is illustrative only | `[ASSUMPTION — Illustrative Demo Allocation]` | Actual spend figures must be provided by client for real analytics |
| A-005 | The 420 apartments and price range (₹65L–₹1.2Cr) are taken directly from the client brief verbatim | `[ASSUMPTION]` | If figures are incorrect, FactSheet seed must be updated |
| A-006 | `SALES_HEAD` role is introduced to govern Fact Sheet editor and daily flagged-chat review (not in original scope) | `[ASSUMPTION]` | Role design may need adjustment based on actual org structure |
| A-007 | "Website" as a lead source channel exists alongside the 3 briefed channels | `[ASSUMPTION]` | Drop if client confirms only 3 channels (portal, social, hoarding) |

---

## 15. Milestone Completion Tracker

| Milestone | Description | Status | Commit |
|---|---|---|---|
| M1 | Project Scaffold, Folder Structure, `.env.example`, `docs/TDD_DRAFT.md`, `deployment.md` | ✅ Complete | *(pending)* |
| M2 | Prisma Schema (13 models + partial unique index) & Date-Aware Seed Script | ⬜ Pending | — |
| M3 | Core Backend Services (LeadService, BookingService, ReminderService) & Integration Tests | ⬜ Pending | — |
| M4 | AIConciergeService (EN/HI/GU, VERIFIED-only facts, Zod tool calling, handoff) | ⬜ Pending | — |
| M5 | Buyer Mobile Concierge UI (language toggle, DPDP consent, slot picker, RERA disclaimer) | ⬜ Pending | — |
| M6 | Sales Executive & Sales Head Portal (RBAC auth, Lead List, Handoff Queue, Fact Sheet Editor, Slot Manager) | ⬜ Pending | — |
| M7 | Source Attribution & ROI Dashboard + Complete Vitest Suite | ⬜ Pending | — |
| M8 | Final Submission Packaging (TDD.pdf + deployment.md zip, <25MB, zero secrets) | ⬜ Pending | — |

