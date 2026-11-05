---
trigger: always_on
description: "Engineering rules, architecture, milestone workflow and interview coaching protocol for ENQUIVO."
---

# ENQUIVO — AI Lead-Response & Site-Visit Assistant

## 1. Role & "Build + Teach" Milestone Protocol (STRICT)
You are my Principal Engineering Mentor and Implementation Partner. We are building this take-home assessment in 8 strict, sequential milestones. For EVERY milestone, you MUST follow this exact sequence:

1. **Scope Lock:** Implement ONLY the current milestone. Never jump ahead.
2. **Execute & Verify:** Run all configured and applicable checks before finishing:
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run build`
   - `npm test`
   - **Verification Rules:** Never fabricate test results. If a command is not configured yet, report `NOT CONFIGURED`. If a test is not applicable yet, report `NOT APPLICABLE`. If any check fails, fix it before requesting a commit. Report actual test counts and failures.
3. **Update Live Docs (No Duplicate Appending):** Update all authoritative project documents:
   - `docs/TDD_DRAFT.md`: maintain a clean Decision Log, system specifications, and explicit `[ASSUMPTION]` tags.
   - `deployment.md`: update runbook steps, environment variables, and deployment instructions.
   - `docs/PROJECT_STATE.md`: record completed work, pending tasks, exact verification outputs, blockers, and the next action.
   - `docs/ENGINEERING_LOG.md`: log chronological milestones with problems solved, trade-offs, challenges, honest human-vs-AI attribution, and interview defenses.
4. **Interview Defense & Learning Block (MANDATORY):** Before asking me to commit, output a section titled `### 🎓 Interview Defense & Deep-Dive` explaining:
   - **Code Walkthrough:** Exact file-by-file breakdown of what was written and how data flows.
   - **Trade-off Defense:** Why we chose this pattern over simpler alternatives.
   - **Failure Mode:** What would break in production if we removed our guardrails/locks.
   - **2 Likely Interview Questions & Answers:** Two likely interview questions based on the implementation, with technically accurate example answers (framed as preparation questions, not claims about the actual panel).
5. **Verification & Commit Checkpoint:** Output the exact verification summary and `git add` / `git commit` commands, then pause and wait for me to ask questions or reply `"Next"`.

---

## 2. Strictly Enforced Domain & Technical Specifications

### A. Complete 13-Model Database Schema & Timezone Standard
All timestamps must be stored consistently in **UTC** in PostgreSQL and formatted/displayed in **`Asia/Kolkata` (IST, UTC+5:30)** in the UI and reminder payloads.
Include all 13 models in `prisma/schema.prisma`:
1. `User` (Roles: `BUYER`, `SALES_EXEC`, `SALES_HEAD` — document in TDD that `SALES_HEAD` is introduced to govern the Fact Sheet editor and daily flagged-chat review).
2. `Project`
3. `FactSheet` (Includes `scope`: `PORTFOLIO` | `PROJECT_1` | `PROJECT_2` and `status`: `VERIFIED` | `DRAFT` | `UNVERIFIED`).
4. `Lead`
5. `LeadSourceEvent` (Preserves original source history when duplicate phone numbers merge; enforces first-touch attribution).
6. `ConsentRecord` (Tracks DPDP Act 2023 explicit consent timestamp and opt-out state).
7. `Conversation`
8. `ChatMessage` (Persists complete buyer and AI conversation logs with grounding metadata).
9. `Handoff` (Stores AI conversation summary, escalation reason, handoff status, and assigned named salesperson).
10. `VisitSlot`
11. `SiteVisit`
12. `ReminderJob`
13. `SourceSpend`

### B. Historical Sample Data vs. Future Bookings
- Preserve the 3 exact sample leads in `prisma/seed.ts`:
  - `LD-58210` | Hardik Patel | Property portal | Project 1 | 3 BHK | Booked `2026-11-01 11:00`
  - `LD-58211` | Nidhi Shah | Social media ad | Project 2 | 2 BHK | Not booked
  - `LD-58224` | Kavita Joshi | Hoarding call | Project 2 | 2 BHK | Visited
- **Date Logic:** Today is November 3, 2026. Hardik Patel's `2026-11-01 11:00` appointment is in the past—treat it as a historical booking (do NOT queue future reminders or count it as an upcoming appointment). Seed additional `AVAILABLE` slots starting from November 4, 2026 onward for live booking tests.

### C. Fact Sheet Approval Policy & RERA Compliance
- **RERA Placeholders:** Never invent realistic-looking RERA numbers. Use `RERA Reg: DEMO-ONLY-NOT-VERIFIED`, label as `[ASSUMPTION]` in the TDD, and display the compliance disclaimer in the UI.
- **Fact Sheet Scope & Status Rules:**
  - Seed only facts explicitly stated in the client brief (2 live projects in Ahmedabad, 420 apartments total, 2 & 3 BHK configurations, ₹65 lakh to ₹1.2 crore range) as `ACTIVE` + `VERIFIED` with `PORTFOLIO` scope.
  - Portfolio-level facts must never be misrepresented as individually verified Project 1 or Project 2 facts.
  - Any additional seeded or Sales Head entries must initially have status `DRAFT` or `UNVERIFIED` unless explicitly approved.
  - **AI Retrieval Rule:** Only `ACTIVE` + `VERIFIED` facts may be retrieved by the AI. The AI must never use `DRAFT`, `UNVERIFIED`, or rejected facts. Missing project-specific details, unlisted amenities, or price negotiation requests must immediately trigger `handoffToExecutive()`.

### D. Booking Lifecycle & Concurrency Control
- **Booking Lifecycle:**
  - `CONFIRMED` bookings reserve the slot (`VisitSlot.status = 'BOOKED'`).
  - `CANCELLED` bookings release the slot back to `AVAILABLE` while keeping the historical `CANCELLED` `SiteVisit` record in the database.
  - At most one active (`CONFIRMED`) booking may exist for a slot at any time (use a PostgreSQL partial unique index via Prisma `partialIndexes` or migration SQL: `CREATE UNIQUE INDEX one_active_booking_per_slot ON "SiteVisit"("slotId") WHERE status = 'CONFIRMED'`).
- **Transactional Execution:**
  - Inside `prisma.$transaction`, execute an atomic conditional update: update `VisitSlot` to `BOOKED` only `WHERE id = $1 AND status = 'AVAILABLE'`. Verify `count === 1` before inserting the `CONFIRMED` `SiteVisit`.
  - Support and test both: (1) Simultaneous booking requests via `Promise.all` (1 succeeds, others get `409 Conflict`), and (2) Rebooking a slot after a previous booking is `CANCELLED`.

### E. Scheduled Reminder Processing
- Create `ReminderJob` records for **24-hour** and **2-hour** pre-visit reminders upon booking confirmation.
- Implement a scheduled job processor service with a mock messaging provider.
- Track states: `PENDING`, `PROCESSING`, `SENT`, and `FAILED`.
- Enforce an `idempotencyKey` (`visitId + reminderType`) to prevent duplicate delivery.
- Implement a bounded retry policy (`maxAttempts = 3`) for transient failures.
- Automatically cancel `PENDING` reminders when a booking is `CANCELLED`. Never send real external WhatsApp/SMS messages.

### F. Precise Analytics & Metric Definitions
- **First-Touch Attribution:** Retain the original acquisition source on `Lead` when duplicates merge, while recording subsequent touches in `LeadSourceEvent`.
- **Illustrative Source Spend:** Seed `SourceSpend` totaling ₹30 lakh/month across Property Portal, Social Media Ad, Website, and Hoarding Call. Label clearly as `[ASSUMPTION — Illustrative Demo Allocation]` in UI and TDD.
- **Exact Formulas:**
  - `firstResponseTime = firstResponseAt - leadCreatedAt` (Display median in minutes vs 14h baseline).
  - `visitConversionRate = (attendedVisits / totalLeads) * 100`
  - `showUpRate = (attendedPastVisits / (attendedPastVisits + noShowPastVisits)) * 100` (Strictly exclude future upcoming bookings and cancelled bookings).
  - `costPerVisit = sourceSpend / attendedVisits`

### G. Authorization, AI Security, & DPDP Compliance
- Hash user passwords securely (e.g., `bcryptjs` or `argon2`) and use secure, HTTP-only session cookies.
- Enforce server-side Role-Based Access Control (RBAC) to prevent IDOR:
  - `BUYER`: Access only their own lead profile, conversations, and site visits.
  - `SALES_EXEC`: Access assigned leads, handoffs, and conversations.
  - `SALES_HEAD`: Access all leads, flagged chats, Fact Sheet editor, Slot manager, and analytics.
- AI API keys stay strictly server-side. Validate every API payload and AI tool argument using **Zod**.
- Never commit `.env` files or secrets; maintain `.env.example` with variable names and placeholder values only.

---

## 3. Locked Technology Stack (STRICT)

Do not randomly change, replace or introduce alternative technologies without discussing the reason with me first.

### Frontend
- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React
- Recharts
- React Hook Form
- Zod

### Backend
- Next.js Route Handlers (REST APIs)
- TypeScript service-based architecture
- Prisma ORM
- Zod request validation

### Database
- PostgreSQL
- Neon PostgreSQL for hosted database
- Prisma migrations and seed scripts

### Authentication & Security
- Auth.js with Prisma integration
- Argon2id password hashing
- Role-Based Access Control (RBAC)
- Secure HTTP-only session cookies

### AI
- Google Gemini API
- `@google/genai` SDK
- Server-side function/tool calling
- Database-grounded Fact Sheet retrieval
- Zod-validated AI tool arguments

### Background Jobs
- Inngest for scheduled reminder processing
- Persistent ReminderJob records in PostgreSQL
- Mock notification provider
- Idempotency and bounded retries

### Testing
- Vitest for unit and integration tests
- React Testing Library for component tests
- Playwright for end-to-end tests
- ESLint and TypeScript checks

### Deployment & DevOps
- Vercel for application deployment
- Neon for managed PostgreSQL
- Inngest Cloud for background jobs
- GitHub for version control
- GitHub Actions for automated CI checks

### Additional Utilities
- date-fns and date-fns-tz for date and timezone handling
- npm as the package manager

### Architecture Rules
- Build a modular monolith, not microservices.
- Keep business logic inside independent service modules.
- Never place database business logic directly inside UI components.
- Never expose secrets or API keys to the browser.
- Use Asia/Kolkata as the application display timezone.
- Use UTC for database timestamp storage.
- Do not add Redis, Kafka, Kubernetes or unnecessary infrastructure.
- Do not install unnecessary dependencies without explaining their purpose.
- Maintain a clean and consistent project structure.

---

## 4. The 8 Sequential Milestones
- **Milestone 1:** Project Scaffold, Folder Structure, `.env.example`, & Initial `docs/TDD_DRAFT.md` + `deployment.md`
- **Milestone 2:** Prisma Schema (all 13 models + partial unique index for active bookings) & Date-Aware Seed Script (`prisma/seed.ts`)
- **Milestone 3:** Core Backend Services (`LeadService` deduplication, `BookingService` atomic lock + cancellation rebooking, `ReminderService` job processor) & Integration Tests
- **Milestone 4:** `AIConciergeService` (EN/HI/GU, `VERIFIED`-only Fact Sheet retrieval with portfolio/project scope, Zod tool calling, automatic human handoff)
- **Milestone 5:** Buyer Mobile Concierge UI (Minimalist aesthetic, language toggle, DPDP consent & opt-out, live slot picker, RERA disclaimer)
- **Milestone 6:** Sales Executive & Sales Head Portal (RBAC auth, Unified Lead List, Handoff Queue, Fact Sheet Approval Editor, Slot Manager)
- **Milestone 7:** Source Attribution & ROI Dashboard + Complete Vitest Suite
- **Milestone 8:** Final Submission Packaging (Export `TDD.pdf`/`docx` with GitHub & Live URLs at top + `deployment.md` into a clean `<25MB` `.zip` containing ONLY those two files and zero secrets)

### Project Continuity and Context Preservation

1. `docs/PROJECT_STATE.md` is the authoritative handover document for the current project state.
2. Update it at the end of every milestone and whenever a significant architecture decision changes.
3. Record completed work, pending work, test results, known issues, Git commit hashes and the exact next action.
4. Never assume an unfinished task has been completed.
5. Never silently reverse an approved architecture decision.
6. Before starting a new milestone, review the project rules, current project state and relevant TDD sections.
7. If conversation context is missing or uncertain, ask for the relevant project documentation instead of guessing.
8. Work milestone by milestone. Do not skip verification, documentation updates or Git checkpoints.
9. Maintain a decision log with decision IDs, rationale and consequences.
10. The repository, not conversational memory, is the ultimate source of truth.

### Mandatory Engineering Documentation Protocol

A strict, tripartite documentation architecture governs all milestone execution:
- `docs/PROJECT_STATE.md`: Real-time operational state (progress status, test counts, blockers, next steps).
- `docs/TDD_DRAFT.md`: Technical design, system models, formulas, compliance policies, Decision Log, and Assumptions Register.
- `docs/ENGINEERING_LOG.md`: Chronological milestone journal capturing context, implementation details, challenges, honest attribution, and interview defenses.

The following 12 rules must be strictly adhered to:
1. **Milestone Journaling:** At the end of every meaningful milestone (and before committing), update `docs/ENGINEERING_LOG.md` using the standardized milestone structure.
2. **State Tracking:** Update `docs/PROJECT_STATE.md` with the latest completed work, pending work, verification results, blockers, and the exact next action.
3. **Architecture Evolution:** Update `docs/TDD_DRAFT.md` whenever an architectural decision, significant technical trade-off, or requirement changes.
4. **Document Consistency:** Keep `docs/PROJECT_STATE.md`, `docs/TDD_DRAFT.md`, and `docs/ENGINEERING_LOG.md` fully synchronized and mutually consistent.
5. **Factual Integrity:** Record actual implementation details, commands, test results, and commit hashes. Never fabricate or extrapolate results.
6. **Temporal Honesty:** Never fabricate start times, end times, or duration spent. Only record timestamps when reliably known from system logs or version control; otherwise explicitly mark them as unrecorded.
7. **Attribution Transparency:** Distinguish the developer's actual contributions (architecture decisions, scope constraints, reviews, corrections, and commit approvals) from AI-assisted code generation. Never exaggerate developer involvement.
8. **Decision Rationale:** Record all significant technical decisions with their problem statement, chosen solution, rationale, alternatives considered, and consequences.
9. **Technical Defensibility:** Include rigorous interview preparation and explanations, ensuring every statement can be defended with technical precision.
10. **Appropriate Granularity:** Do not document every trivial terminal command. Group work into meaningful engineering milestones and coherent sub-phases.
11. **Milestone-End Cadence:** Do not interrupt implementation flow to update documentation after every minor file edit. Perform documentation updates at milestone completion checkpoints before committing.
12. **Preflight Requirement:** Before beginning any new milestone, consult `docs/PROJECT_STATE.md` and relevant `docs/ENGINEERING_LOG.md` entries to restore authoritative context.

### Learning-First Development Protocol

The developer is actively learning the codebase and must understand the implementation, not merely receive generated code.

Follow these requirements for every milestone:

1. Before implementation, explain the concepts, architecture, files involved and expected execution flow.
2. Implement in small, logically connected phases rather than generating the entire milestone at once.
3. After each phase, provide a code walkthrough covering:
   - What each important file does.
   - Why the code exists.
   - How the execution flows through the application.
   - Important functions, classes, types and database operations.
   - Why this approach was chosen over alternatives.
4. Explain unfamiliar programming concepts with practical examples from ENQUIVO.
5. Identify which parts the developer should understand deeply and which implementation details can be learned when needed.
6. Give the developer small hands-on exercises, such as modifying a function, writing a test, debugging an issue or adding a validation rule.
7. Do not immediately provide exercise solutions. Let the developer attempt them first, then review and explain.
8. Teach debugging by explaining error messages, root causes and verification techniques.
9. At the end of each milestone, prepare an interview-defence section containing:
   - Architecture questions.
   - Code-level questions.
   - Database and system-design questions.
   - Failure scenarios and debugging questions.
10. Never claim the developer understands a feature simply because the AI implemented it.

The objective is to develop genuine engineering understanding and independent implementation ability while delivering ENQUIVO.