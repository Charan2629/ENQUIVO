/**
 * src/types/index.ts
 *
 * Shared TypeScript types and enums for ENQUIVO.
 * Re-exports enums directly from @prisma/client to ensure 100% type synchronisation.
 */

export {
  UserRole,
  FactSheetScope,
  FactSheetStatus,
  LeadSource,
  BookingStatus,
  AttendanceOutcome,
  VisitSlotStatus,
  ReminderType,
  ReminderStatus,
  HandoffStatus,
  EscalationReason,
  ConversationLanguage,
  ChatMessageRole,
} from "@prisma/client";

export type {
  User,
  Project,
  FactSheet,
  Lead,
  LeadSourceEvent,
  ConsentRecord,
  Conversation,
  ChatMessage,
  Handoff,
  VisitSlot,
  SiteVisit,
  ReminderJob,
  SourceSpend,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Analytics Domain Types
// ---------------------------------------------------------------------------

import type { LeadSource } from "@prisma/client";

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
