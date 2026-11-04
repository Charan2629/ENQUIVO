-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUYER', 'SALES_EXEC', 'SALES_HEAD');

-- CreateEnum
CREATE TYPE "FactSheetScope" AS ENUM ('PORTFOLIO', 'PROJECT_1', 'PROJECT_2');

-- CreateEnum
CREATE TYPE "FactSheetStatus" AS ENUM ('VERIFIED', 'DRAFT', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('PROPERTY_PORTAL', 'SOCIAL_MEDIA_AD', 'WEBSITE', 'HOARDING_CALL', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AttendanceOutcome" AS ENUM ('UNRECORDED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "VisitSlotStatus" AS ENUM ('AVAILABLE', 'BOOKED');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('REMINDER_24H', 'REMINDER_2H');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('PENDING', 'ASSIGNED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "EscalationReason" AS ENUM ('MISSING_PROJECT_INFO', 'UNLISTED_AMENITY', 'PRICE_NEGOTIATION', 'BUYER_REQUESTED', 'OTHER');

-- CreateEnum
CREATE TYPE "ConversationLanguage" AS ENUM ('EN', 'HI', 'GU');

-- CreateEnum
CREATE TYPE "ChatMessageRole" AS ENUM ('USER', 'AI');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BUYER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "rera_number" TEXT NOT NULL DEFAULT 'DEMO-ONLY-NOT-VERIFIED',
    "total_units" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_sheets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "scope" "FactSheetScope" NOT NULL DEFAULT 'PORTFOLIO',
    "status" "FactSheetStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "project_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "verified_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fact_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "lead_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "source" "LeadSource" NOT NULL,
    "project_id" TEXT,
    "configuration" TEXT,
    "first_response_at" TIMESTAMP(3),
    "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_source_events" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "campaign" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_source_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "consent_text" TEXT NOT NULL,
    "consented_at" TIMESTAMP(3) NOT NULL,
    "opted_out" BOOLEAN NOT NULL DEFAULT false,
    "opt_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "language" "ConversationLanguage" NOT NULL DEFAULT 'EN',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "ChatMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "grounding_fact_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handoffs" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "escalation_reason" "EscalationReason" NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "HandoffStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_slots" (
    "id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "VisitSlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "location" TEXT NOT NULL DEFAULT 'Enquivo Sales Gallery, Ahmedabad',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_visits" (
    "id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "booking_status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "attendance_outcome" "AttendanceOutcome" NOT NULL DEFAULT 'UNRECORDED',
    "booked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "attended_at" TIMESTAMP(3),

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_jobs" (
    "id" TEXT NOT NULL,
    "site_visit_id" TEXT NOT NULL,
    "reminder_type" "ReminderType" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_attempt_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "simulation_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_spends" (
    "id" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "month_year" TEXT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_spends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "fact_sheets_status_is_active_scope_idx" ON "fact_sheets"("status", "is_active", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "leads_lead_code_key" ON "leads"("lead_code");

-- CreateIndex
CREATE UNIQUE INDEX "leads_phone_key" ON "leads"("phone");

-- CreateIndex
CREATE INDEX "leads_source_idx" ON "leads"("source");

-- CreateIndex
CREATE INDEX "leads_deleted_at_idx" ON "leads"("deleted_at");

-- CreateIndex
CREATE INDEX "lead_source_events_lead_id_idx" ON "lead_source_events"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_lead_id_key" ON "consent_records"("lead_id");

-- CreateIndex
CREATE INDEX "conversations_lead_id_idx" ON "conversations"("lead_id");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "handoffs_conversation_id_key" ON "handoffs"("conversation_id");

-- CreateIndex
CREATE INDEX "handoffs_status_idx" ON "handoffs"("status");

-- CreateIndex
CREATE INDEX "visit_slots_starts_at_status_idx" ON "visit_slots"("starts_at", "status");

-- CreateIndex
CREATE INDEX "site_visits_lead_id_booking_status_idx" ON "site_visits"("lead_id", "booking_status");

-- CreateIndex
CREATE INDEX "site_visits_attendance_outcome_idx" ON "site_visits"("attendance_outcome");

-- CreateIndex
CREATE UNIQUE INDEX "one_active_booking_per_slot" ON "site_visits"("slot_id") WHERE (booking_status = 'CONFIRMED');

-- CreateIndex
CREATE UNIQUE INDEX "reminder_jobs_idempotency_key_key" ON "reminder_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "reminder_jobs_status_scheduled_for_idx" ON "reminder_jobs"("status", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "source_spends_source_month_year_key" ON "source_spends"("source", "month_year");

-- AddForeignKey
ALTER TABLE "fact_sheets" ADD CONSTRAINT "fact_sheets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sheets" ADD CONSTRAINT "fact_sheets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sheets" ADD CONSTRAINT "fact_sheets_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_source_events" ADD CONSTRAINT "lead_source_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "visit_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_jobs" ADD CONSTRAINT "reminder_jobs_site_visit_id_fkey" FOREIGN KEY ("site_visit_id") REFERENCES "site_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
