import { z } from "zod";
import { AttendanceOutcome } from "@prisma/client";

/**
 * Validates slot lookup query parameters.
 */
export const getAvailableSlotsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  project: z.string().trim().optional(),
  location: z.string().trim().optional(),
});

export type GetAvailableSlotsInput = z.infer<typeof getAvailableSlotsSchema>;

/**
 * Validates booking confirmation request payload.
 */
export const bookVisitSchema = z.object({
  slotId: z.string().trim().min(1, "Slot ID is required"),
  leadId: z.string().trim().min(1, "Lead ID is required"),
});

export type BookVisitInput = z.infer<typeof bookVisitSchema>;

/**
 * Validates booking cancellation request payload.
 */
export const cancelBookingSchema = z.object({
  visitId: z.string().trim().min(1, "Visit ID is required"),
});

export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

/**
 * Validates site visit attendance recording payload.
 */
export const recordAttendanceSchema = z.object({
  visitId: z.string().trim().min(1, "Visit ID is required"),
  outcome: z.nativeEnum(AttendanceOutcome, {
    message: "Invalid attendance outcome (must be ATTENDED or NO_SHOW)",
  }),
});

export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;

/**
 * Validates site visit query parameters for staff dashboard listing.
 */
export const visitQuerySchema = z.object({
  timeframe: z
    .enum(["ALL", "UPCOMING", "PAST", "TODAY"])
    .default("ALL"),
  bookingStatus: z
    .enum(["ALL", "CONFIRMED", "CANCELLED", "COMPLETED"])
    .default("ALL"),
  attendanceOutcome: z
    .enum(["ALL", AttendanceOutcome.UNRECORDED, AttendanceOutcome.ATTENDED, AttendanceOutcome.NO_SHOW])
    .default("ALL"),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ValidatedVisitQuery = z.infer<typeof visitQuerySchema>;
