import { z } from "zod";
import { EscalationReason, FactSheetScope, ConversationLanguage } from "@prisma/client";

/**
 * Validation schema for inbound buyer chat messages.
 */
export const chatInputSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  message: z.string().min(1, "Message cannot be empty").max(2000, "Message exceeds 2000 characters"),
  leadId: z.string().optional(),
  clientMessageId: z.string().trim().min(1).max(100).optional(),
  language: z.nativeEnum(ConversationLanguage).optional(),
});

export type ChatInput = z.infer<typeof chatInputSchema>;

/**
 * Tool 1: getVerifiedFacts parameters.
 * Validates requested scope and optional project ID.
 */
export const getVerifiedFactsToolSchema = z.object({
  scope: z.nativeEnum(FactSheetScope).optional(),
  projectId: z.string().optional(),
});

export type GetVerifiedFactsToolInput = z.infer<typeof getVerifiedFactsToolSchema>;

/**
 * Tool 2: checkSlotAvailability parameters.
 */
export const checkSlotAvailabilityToolSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  project: z.string().optional(),
});

export type CheckSlotAvailabilityToolInput = z.infer<typeof checkSlotAvailabilityToolSchema>;

/**
 * Tool 3: bookVisitSlot parameters.
 * NOTE: leadId is intentionally NOT accepted from AI arguments for security.
 * It is derived strictly from the validated conversation context.
 */
export const bookVisitSlotToolSchema = z.object({
  slotId: z.string().min(1, "slotId is required"),
  confirmed: z.boolean().refine((val) => val === true, {
    message: "Booking requires explicit buyer confirmation",
  }),
});

export type BookVisitSlotToolInput = z.infer<typeof bookVisitSlotToolSchema>;

/**
 * Tool 4: handoffToExecutive parameters.
 * NOTE: salesperson assignment is intentionally NOT accepted from AI arguments.
 * It is derived strictly by querying an active SALES_EXEC from PostgreSQL.
 */
export const handoffToExecutiveToolSchema = z.object({
  escalationReason: z.nativeEnum(EscalationReason),
  summary: z.string().min(5, "Summary must be at least 5 characters"),
});

export type HandoffToExecutiveToolInput = z.infer<typeof handoffToExecutiveToolSchema>;

/**
 * Schema for creating a new conversation.
 */
export const createConversationSchema = z.object({
  leadId: z.string().min(1, "leadId is required"),
  language: z.nativeEnum(ConversationLanguage).default(ConversationLanguage.EN),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
