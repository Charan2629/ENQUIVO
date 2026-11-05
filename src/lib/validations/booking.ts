import { z } from "zod";
import { AttendanceOutcome } from "@prisma/client";

/**
 * Validates slot lookup query parameters.
 */
export const getAvailableSlotsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
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

