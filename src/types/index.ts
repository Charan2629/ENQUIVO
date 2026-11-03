/**
 * src/types/index.ts
 *
 * Shared TypeScript types and enums for ENQUIVO.
 * Keep this file free of runtime imports — types/interfaces only.
 * These mirror the Prisma enums that will be defined in Milestone 2.
 */

// ---------------------------------------------------------------------------
// User & Auth
// ---------------------------------------------------------------------------

export type UserRole = 'BUYER' | 'SALES_EXEC' | 'SALES_HEAD';

// ---------------------------------------------------------------------------
// Fact Sheet
// ---------------------------------------------------------------------------

/**
 * Scope determines whether a fact applies to the whole portfolio or a
 * specific project. Portfolio-level facts must never be presented as
 * individually verified Project-1 or Project-2 data.
 */
export type FactSheetScope = 'PORTFOLIO' | 'PROJECT_1' | 'PROJECT_2';

/**
 * Only VERIFIED facts may be retrieved by the AI Concierge.
 * DRAFT and UNVERIFIED facts are editable only by SALES_HEAD.
 */
export type FactSheetStatus = 'VERIFIED' | 'DRAFT' | 'UNVERIFIED';

// ---------------------------------------------------------------------------
// Leads & Attribution
// ---------------------------------------------------------------------------

export type LeadSource =
  | 'PROPERTY_PORTAL'
  | 'SOCIAL_MEDIA_AD'
  | 'WEBSITE'
  | 'HOARDING_CALL'
  | 'REFERRAL'
  | 'OTHER';

// ---------------------------------------------------------------------------
// Site Visits & Slots
// ---------------------------------------------------------------------------

export type SiteVisitStatus = 'CONFIRMED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';

export type VisitSlotStatus = 'AVAILABLE' | 'BOOKED';

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

/** Type maps to idempotencyKey suffix: visitId + reminderType */
export type ReminderType = 'REMINDER_24H' | 'REMINDER_2H';

export type ReminderStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

// ---------------------------------------------------------------------------
// Handoffs
// ---------------------------------------------------------------------------

export type HandoffStatus = 'PENDING' | 'ASSIGNED' | 'RESOLVED';

export type EscalationReason =
  | 'MISSING_PROJECT_INFO'
  | 'UNLISTED_AMENITY'
  | 'PRICE_NEGOTIATION'
  | 'BUYER_REQUESTED'
  | 'OTHER';

// ---------------------------------------------------------------------------
// AI Concierge
// ---------------------------------------------------------------------------

/** Supported languages for the Buyer Mobile Concierge (EN / HI / GU) */
export type ConversationLanguage = 'EN' | 'HI' | 'GU';

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/**
 * Metric definitions (formulas enforced in AnalyticsService, Milestone 7):
 *
 * firstResponseTime  = firstResponseAt - leadCreatedAt  (median, in minutes)
 * visitConversionRate = (attendedVisits / totalLeads) * 100
 * showUpRate          = (attendedPastVisits / (attendedPastVisits + noShowPastVisits)) * 100
 *                       — strictly excludes future bookings and CANCELLED visits
 * costPerVisit        = sourceSpend / attendedVisits
 */
export interface AnalyticsMetrics {
  firstResponseTimeMedianMinutes: number;
  visitConversionRate: number;
  showUpRate: number;
  costPerVisitBySource: Record<LeadSource, number>;
}

