import { z } from "zod";
import { EscalationReason, HandoffStatus } from "@prisma/client";

/**
 * Filter status values for handoffs.
 * Supports standard HandoffStatus enums plus "ALL" and "UNASSIGNED" (alias for PENDING with no assigned user).
 */
export const handoffStatusFilterValues = [
  "ALL",
  "PENDING",
  "ASSIGNED",
  "RESOLVED",
  "UNASSIGNED",
] as const;

export type HandoffStatusFilter = (typeof handoffStatusFilterValues)[number];

export const escalationReasonFilterValues = [
  "ALL",
  EscalationReason.MISSING_PROJECT_INFO,
  EscalationReason.UNLISTED_AMENITY,
  EscalationReason.PRICE_NEGOTIATION,
  EscalationReason.BUYER_REQUESTED,
  EscalationReason.OTHER,
] as const;

export type EscalationReasonFilter = (typeof escalationReasonFilterValues)[number];

/**
 * Query schema for listing, searching, filtering, and paginating handoffs.
 */
export const handoffQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(100).optional(),
  status: z.enum(handoffStatusFilterValues).default("ALL"),
  reason: z.enum(escalationReasonFilterValues).default("ALL"),
  assignedToId: z.string().trim().optional(),
  sortBy: z.enum(["createdAt", "resolvedAt", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type HandoffQueryInput = z.input<typeof handoffQuerySchema>;
export type ValidatedHandoffQuery = z.output<typeof handoffQuerySchema>;

/**
 * Schema for assigning or reassigning a handoff to an eligible sales executive.
 */
export const assignHandoffSchema = z.object({
  salesExecId: z.string().trim().min(1, "Sales Executive ID is required"),
});

export type AssignHandoffInput = z.infer<typeof assignHandoffSchema>;

/**
 * Schema for updating handoff resolution status.
 */
export const updateHandoffStatusSchema = z.object({
  status: z.nativeEnum(HandoffStatus),
});

export type UpdateHandoffStatusInput = z.infer<typeof updateHandoffStatusSchema>;
