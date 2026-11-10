# ENQUIVO — AI Lead-Response & Site-Visit Assistant

> 🚀 **Live Working Deployment**: [Open the Latest Working Deployment](https://enquivo-pink.vercel.app/)
> 📦 **GitHub Repository**: [https://github.com/your-username/enquivo](https://github.com/Charan2629/ENQUIVO)

[![Next.js](https://img.shields.io/badge/Next.js-16.4.4-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=flat&logo=postgresql)](https://neon.tech/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![Vitest](https://img.shields.io/badge/Vitest-283_Passed-6E9F18?style=flat&logo=vitest)](https://vitest.dev/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-Function_Calling-4285F4?style=flat&logo=google)](https://ai.google.dev/)
[![Inngest](https://img.shields.io/badge/Inngest-Background_Jobs-FF6B6B?style=flat)](https://www.inngest.com/)

---

## Executive Summary

In luxury real estate, the median industry response time to digital portal leads is **14 hours**, resulting in severe buyer drop-off and low site-visit conversion.

**ENQUIVO** is an enterprise AI concierge and lead-response system engineered specifically for luxury residential developers in Ahmedabad, Gujarat (featuring **Prakriti Heights** on SG Highway and **Vaastu Enclave** in Shela). It achieves **sub-minute first response times**, 100% verified fact grounding, authentic trilingual localization (English, Hindi, and Gujarati), transactional chat-based site visit bookings with zero double-booking, and seamless escalation to human sales executives.

---

## Key Features

### 1. Buyer Conversational Concierge
- **Trilingual Conversational Fluency**: Seamlessly converse in authentic **English**, **Hindi (हिन्दी)**, and **Gujarati (ગુજરાતી)**.
- **DPDP Act 2023 Compliance**: Explicit digital consent captured with timestamp upon intake. Includes one-click self-service data opt-out and audit records.
- **Chat-Based Site Visit Booking**: Natural language booking flow (project choice $\rightarrow$ available slot display in Asia/Kolkata IST $\rightarrow$ direct reservation) without requiring third-party redirect or phone calls.
- **RERA Compliance Guard**: Automated demo compliance disclaimer injection (`RERA Reg: DEMO-ONLY-NOT-VERIFIED`) restricted strictly to factual specifications, preventing disclaimer leakage into conversational clarifications or greetings.

### 2. Zero-Hallucination AI Architecture (Google Gemini)
- **Database Fact Sheet Grounding**: Retrieves only `ACTIVE` + `VERIFIED` facts. The AI model is strictly bounded to developer-approved data with portfolio and project scoping.
- **Automatic Human Handoff**: Immediate escalation to human sales executives (`Vikram Mehta` / `Priya Desai`) with structured summaries upon:
  - Missing project specifications or unverified configurations.
  - Price discount or payment term negotiations.
  - Unlisted luxury amenities (e.g., helipads, private pools).
  - Explicit buyer requests to speak with a human.
- **Contention & Rate-Limit Resilience**: Deterministic fallback engine ensures graceful, informative responses and zero crashes during LLM API latency spikes or 429 quota exhaustion.

### 3. Concurrency-Safe Booking Engine
- **Atomic Slot Reservation**: Database-level concurrency control via conditional update:
  ```sql
  UPDATE visit_slots SET status = 'BOOKED'
  WHERE id = $slotId AND status = 'AVAILABLE' AND startsAt > NOW();
  ```
- **Partial Unique Index Protection**: PostgreSQL partial unique index (`CREATE UNIQUE INDEX one_active_booking_per_slot ON "SiteVisit"("slotId") WHERE status = 'CONFIRMED'`) guarantees zero double-booking even under concurrent race conditions.
- **Contention Recovery**: If a slot is taken milliseconds prior, the assistant catches `SlotUnavailableError`, does *not* claim false confirmation, and instantly offers remaining available slots.

### 4. Automated Pre-Visit Reminders (Inngest)
- Staged upon booking confirmation for **24-hour** and **2-hour** milestones prior to visit time.
- Idempotency keys (`${visitId}:${reminderType}`) prevent duplicate delivery.
- Automatic cancellation of pending reminder jobs if a visit is cancelled.

### 5. Sales & Executive Staff Portal (RBAC)
- **Role-Based Access Control**:
  - `BUYER`: Scoped exclusively to their own lead profile and conversations.
  - `SALES_EXEC`: Scoped to assigned leads, active handoffs, and conversations.
  - `SALES_HEAD`: Complete administrative governance over leads, handoffs, slot inventory, fact sheet approvals, and marketing ROI analytics.
- **Unified Lead List & Pipeline**: Complete attribution history, first-response metrics, and conversation review.
- **Live Handoff Queue**: Sales executive assignment, status tracking, and direct lead communication view.
- **Fact Sheet Governance Editor**: Multi-stage approval workflow (`DRAFT` / `UNVERIFIED` $\rightarrow$ `VERIFIED`).
- **Appointment Slot Manager**: Live capacity metrics, development filtering, and past slot auditing.
- **Source Attribution & ROI Dashboard**: Live breakdown of spend (₹30L illustrative baseline), median response times, conversion rates, and cost-per-visit across Property Portals, Social Ads, Website, and Hoardings.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack, React Server Components), Tailwind CSS, shadcn/ui, Lucide Icons, Recharts |
| **Backend API** | Next.js Route Handlers (REST), Service-Oriented Architecture, Zod validation |
| **Database & ORM** | PostgreSQL (Neon Serverless), Prisma ORM 6.x |
| **Artificial Intelligence** | Google Gemini API (`@google/genai`), Multi-turn Function Calling, Database Fact Grounding |
| **Background Processing** | Inngest Cloud, Event-driven scheduling, Idempotent job execution |
| **Authentication & Security** | Auth.js, Argon2id hashing, HTTP-only secure cookies, Server-side RBAC, CSRF origin verification |
| **Testing** | Vitest, React Testing Library, ESLint, TypeScript |
| **Timezone Standard** | Storage in **UTC**, formatted & displayed in **Asia/Kolkata (IST, UTC+5:30)** |

---

## Database Architecture (13 Models)

The data model is defined in [`prisma/schema.prisma`](prisma/schema.prisma):

1. **`User`**: Staff and buyer user accounts with `UserRole` (`BUYER`, `SALES_EXEC`, `SALES_HEAD`).
2. **`Project`**: Luxury developments (`Prakriti Heights`, `Vaastu Enclave`).
3. **`FactSheet`**: Ground truth specifications with `FactSheetScope` (`PORTFOLIO`, `PROJECT_1`, `PROJECT_2`) and `FactSheetStatus` (`VERIFIED`, `DRAFT`, `UNVERIFIED`).
4. **`Lead`**: Buyer profiles with first-response timestamps and primary source attribution.
5. **`LeadSourceEvent`**: Multi-touch history preserving first-touch attribution across merges.
6. **`ConsentRecord`**: DPDP Act 2023 compliance tracking, explicit consent, and opt-out state.
7. **`Conversation`**: Multi-turn buyer chat threads with language preferences (`EN`, `HI`, `GU`).
8. **`ChatMessage`**: Complete chat history, grounding fact references, and role logging.
9. **`Handoff`**: Human escalation records with `EscalationReason`, status, and assigned executive.
10. **`VisitSlot`**: Capacity-bounded appointment windows in IST with venue location.
11. **`SiteVisit`**: Confirmed, cancelled, and attended visits with attendance outcome tracking.
12. **`ReminderJob`**: Pre-visit 24h and 2h notification tracking with idempotency and retry state.
13. **`SourceSpend`**: Monthly marketing channel spend allocation for ROI calculation.

---

## Demo Credentials

The database comes seeded with demo staff and buyer profiles:

| Role | Name | Email | Password |
|---|---|---|---|
| **Sales Head** | Aarav Sharma | `sales-head@enquivo.in` | `DemoEval#HeadAarav2026!` |
| **Sales Executive** | Vikram Mehta | `vikram.mehta@enquivo.in` | `DemoEval#ExecVikram2026!` |
| **Sales Executive** | Priya Desai | `priya.desai@enquivo.in` | `DemoEval#ExecPriya2026!` |
| **Demo Buyer** | Hardik Patel | `hardik.patel@example.com` | `DemoEval#BuyerHardik2026!` |

---

## Getting Started Locally

### Prerequisites
- **Node.js**: `20.x` LTS or higher
- **npm**: `10.x` or higher
- **PostgreSQL**: Neon account (recommended) or local PostgreSQL 15+

### Installation & Runbook

```bash
# 1. Clone the repository
git clone https://github.com/your-username/enquivo.git
cd enquivo

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Open .env.local and provide your DATABASE_URL, GEMINI_API_KEY, AUTH_SECRET, etc.

# 4. Generate Prisma Client
npx prisma generate

# 5. Push migrations / Sync schema
npx prisma db push

# 6. Seed initial date-aware records & dynamic slots
npx prisma db seed

# 7. Start the local Next.js development server
npm run dev
```

Visit **http://localhost:3000** to explore the buyer concierge, or navigate to **http://localhost:3000/login** to access the staff portal.

### Running Inngest Background Dev Server

In a separate terminal, start the Inngest local development server to test scheduled reminders:
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```
Open **http://localhost:8288** to view the Inngest dashboard.

---

## Verification & Test Suite

The test suite contains **19 test files** with **283 automated tests** covering unit validations, concurrency transactions, AI grounding, multilingual translations, and slot management:

```bash
# Run all unit and service tests
npm test

# Run type check (clean compilation)
npx tsc --noEmit

# Run code linter
npm run lint

# Run production build (Turbopack)
npm run build
```

### Verified Test Breakdown
- `chat-booking-flow.test.ts`: Conversational 3-turn booking, slot parsing, cross-project isolation, contention recovery.
- `slot-dynamic-seeding.test.ts`: Relative IST date generation, non-destructive idempotency, venue mapping.
- `ai-multiturn-grounding.test.ts`: Zero-hallucination fact retrieval, trilingual switching, numbered choice handling.
- `slot-management.test.ts`: Slot Query schema coercion, capacity metrics, Sales Head CRUD authorization.
- `visit-attendance.test.ts`: Site visit attendance recording and show-up rate metrics.
- `handoff.test.ts`: Escalation routing and sales assignment.
- `source-analytics.test.ts`: CAC, conversion rate, first-response time, and ROI formulas.

---

## License

This project was built as part of an Advanced Engineering Assessment. All architectural specifications and demonstration assets are proprietary to ENQUIVO.
