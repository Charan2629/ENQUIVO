import { z } from "zod";
import { VisitSlotStatus } from "@prisma/client";

/**
 * Zod schema for querying appointment slots.
 */
export const slotQuerySchema = z.object({
  status: z
    .enum(["ALL", VisitSlotStatus.AVAILABLE, VisitSlotStatus.BOOKED])
    .default("ALL"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includePast: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type ValidatedSlotQuery = z.infer<typeof slotQuerySchema>;

/**
 * Zod schema for creating a new visit slot (Sales Head only).
 */
export const createSlotSchema = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    location: z
      .string()
      .trim()
      .min(3, "Location must be at least 3 characters")
      .max(200, "Location must not exceed 200 characters")
      .default("Enquivo Sales Gallery, Ahmedabad"),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "End time must be after start time",
    path: ["endsAt"],
  })
  .refine(
    (data) => {
      const durationMs = data.endsAt.getTime() - data.startsAt.getTime();
      return durationMs >= 15 * 60 * 1000; // Minimum 15 minutes
    },
    {
      message: "Slot duration must be at least 15 minutes",
      path: ["endsAt"],
    }
  );

export type CreateSlotInput = z.infer<typeof createSlotSchema>;

/**
 * Zod schema for updating a visit slot.
 */
export const updateSlotSchema = z
  .object({
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    location: z
      .string()
      .trim()
      .min(3, "Location must be at least 3 characters")
      .max(200, "Location must not exceed 200 characters")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return data.endsAt > data.startsAt;
      }
      return true;
    },
    {
      message: "End time must be after start time",
      path: ["endsAt"],
    }
  );

export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
