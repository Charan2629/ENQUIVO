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
  StaffSession,
} from "@prisma/client";

export type { LeadLifecycleStatus } from "@/lib/validations/lead";
import type { LeadLifecycleStatus } from "@/lib/validations/lead";
import type {
  EscalationReason,
  HandoffStatus,
  ConversationLanguage,
  ChatMessageRole,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Lead Pipeline Domain Types (Milestone 6.2)
// ---------------------------------------------------------------------------

export interface LeadListItem {
  id: string;
  leadCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  projectId: string | null;
  projectName: string | null;
  configuration: string | null;
  status: LeadLifecycleStatus;
  firstResponseAt: Date | null;
  createdAt: Date;
  touchpointCount: number;
  hasConsented: boolean;
  assignedToName: string | null;
}

export interface LeadPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LeadMetrics {
  totalLeads: number;
  newLeads: number;
  byStatus: Record<LeadLifecycleStatus, number>;
  byProject: Array<{
    projectId: string | null;
    projectName: string;
    count: number;
  }>;
  bySource: Record<LeadSource, number>;
  recentActivity: Array<{
    id: string;
    leadId: string;
    leadCode: string;
    leadName: string;
    type: "NEW_LEAD" | "TOUCHPOINT" | "VISIT_BOOKED" | "VISIT_ATTENDED" | "ESCALATED";
    description: string;
    occurredAt: Date;
  }>;
}

export interface LeadDetail {
  id: string;
  leadCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  projectId: string | null;
  project: {
    id: string;
    name: string;
    location: string;
    reraNumber: string;
    totalUnits: number;
  } | null;
  configuration: string | null;
  status: LeadLifecycleStatus;
  firstResponseAt: Date | null;
  isAnonymized: boolean;
  createdAt: Date;
  updatedAt: Date;
  sourceEvents: Array<{
    id: string;
    source: LeadSource;
    campaign: string | null;
    occurredAt: Date;
  }>;
  consentRecord: {
    id: string;
    consentText: string;
    consentedAt: Date;
    optedOut: boolean;
    optOutAt: Date | null;
  } | null;
  conversations: Array<{
    id: string;
    language: string;
    startedAt: Date;
    endedAt: Date | null;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      createdAt: Date;
      groundingFactIds: string[];
    }>;
    handoff: {
      id: string;
      status: string;
      escalationReason: string;
      summary: string;
      assignedToId: string | null;
      assignedTo: {
        id: string;
        name: string;
        email: string;
      } | null;
      createdAt: Date;
      resolvedAt: Date | null;
    } | null;
  }>;
  siteVisits: Array<{
    id: string;
    bookingStatus: string;
    attendanceOutcome: string;
    bookedAt: Date;
    attendedAt: Date | null;
    cancelledAt: Date | null;
    slot: {
      id: string;
      startsAt: Date;
      endsAt: Date;
      location: string;
      status: string;
    };
    reminderJobs: Array<{
      id: string;
      reminderType: string;
      status: string;
      scheduledFor: Date;
      sentAt: Date | null;
      attempts: number;
    }>;
  }>;
}

// ---------------------------------------------------------------------------
// Handoff Queue & Assignment Domain Types (Milestone 6.3)
// ---------------------------------------------------------------------------

export interface EligibleSalesExecutive {
  id: string;
  name: string;
  email: string;
  activeLeadCount: number;
}

export interface HandoffListItem {
  id: string;
  conversationId: string;
  escalationReason: EscalationReason;
  summary: string;
  status: HandoffStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  language: ConversationLanguage;
  assignedTo: {
    id: string;
    name: string;
    email: string;
  } | null;
  lead: {
    id: string;
    leadCode: string;
    name: string;
    phone: string | null;
    email: string | null;
    source: LeadSource;
    projectName: string | null;
    configuration: string | null;
  };
  messageCount: number;
}

export interface HandoffPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface HandoffMetrics {
  totalHandoffs: number;
  unassignedCount: number;
  assignedCount: number;
  resolvedCount: number;
  byReason: Record<EscalationReason, number>;
  eligibleExecutives: EligibleSalesExecutive[];
}

export interface HandoffDetail {
  id: string;
  conversationId: string;
  escalationReason: EscalationReason;
  summary: string;
  status: HandoffStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  assignedTo: {
    id: string;
    name: string;
    email: string;
  } | null;
  conversation: {
    id: string;
    language: ConversationLanguage;
    startedAt: Date;
    endedAt: Date | null;
    messages: Array<{
      id: string;
      role: ChatMessageRole;
      content: string;
      createdAt: Date;
      groundingFactIds: string[];
    }>;
  };
  lead: {
    id: string;
    leadCode: string;
    name: string;
    phone: string | null;
    email: string | null;
    source: LeadSource;
    projectId: string | null;
    projectName: string | null;
    projectLocation: string | null;
    configuration: string | null;
    firstResponseAt: Date | null;
    createdAt: Date;
  };
}

// ---------------------------------------------------------------------------
// Fact Sheet Domain Types (M6.4)
// ---------------------------------------------------------------------------
import type { FactSheetScope, FactSheetStatus } from "@prisma/client";

export interface FactSheetItem {
  id: string;
  key: string;
  value: string;
  scope: FactSheetScope;
  status: FactSheetStatus;
  isActive: boolean;
  projectId: string | null;
  projectName: string | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  verifiedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FactSheetMetrics {
  totalFacts: number;
  verifiedActive: number;
  draftCount: number;
  unverifiedCount: number;
  inactiveCount: number;
}

// ---------------------------------------------------------------------------
// Site Visits & Slot Management Domain Types (M6.4)
// ---------------------------------------------------------------------------
import type { VisitSlotStatus, BookingStatus, AttendanceOutcome } from "@prisma/client";

export interface VisitSlotItem {
  id: string;
  startsAt: Date;
  endsAt: Date;
  startsAtIST: string;
  endsAtIST: string;
  status: VisitSlotStatus;
  location: string;
  hasConfirmedBooking: boolean;
  activeBooking?: {
    visitId: string;
    leadId: string;
    leadName: string;
    leadPhone: string | null;
    leadCode: string;
    bookingStatus: BookingStatus;
  } | null;
  totalVisitsCount: number;
}

export interface SiteVisitItem {
  id: string;
  slotId: string;
  leadId: string;
  bookingStatus: BookingStatus;
  attendanceOutcome: AttendanceOutcome;
  bookedAt: Date;
  cancelledAt: Date | null;
  attendedAt: Date | null;
  startsAt: Date;
  endsAt: Date;
  startsAtIST: string;
  endsAtIST: string;
  location: string;
  isPast: boolean;
  isEligibleForAttendance: boolean;
  lead: {
    id: string;
    leadCode: string;
    name: string;
    phone: string | null;
    email: string | null;
    projectName: string | null;
  };
  assignedTo: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface VisitPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SiteVisitMetrics {
  totalVisits: number;
  confirmedCount: number;
  attendedCount: number;
  noShowCount: number;
  cancelledCount: number;
  pendingAttendanceCount: number;
}

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
