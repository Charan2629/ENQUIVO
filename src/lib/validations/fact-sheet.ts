import { z } from "zod";
import { FactSheetScope, FactSheetStatus } from "@prisma/client";

/**
 * Zod schema for querying fact sheet entries with multi-field filtering and search.
 */
export const factSheetQuerySchema = z.object({
  scope: z
    .enum(["ALL", FactSheetScope.PORTFOLIO, FactSheetScope.PROJECT_1, FactSheetScope.PROJECT_2])
    .default("ALL"),
  status: z
    .enum(["ALL", FactSheetStatus.VERIFIED, FactSheetStatus.DRAFT, FactSheetStatus.UNVERIFIED])
    .default("ALL"),
  isActive: z
    .enum(["ALL", "true", "false"])
    .default("ALL"),
  projectId: z.string().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ValidatedFactSheetQuery = z.infer<typeof factSheetQuerySchema>;

/**
 * Zod schema for creating a new fact sheet entry (Sales Head only).
 */
export const createFactSheetSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2, "Key must be at least 2 characters")
    .max(100, "Key must not exceed 100 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Key must only contain letters, numbers, underscores, dots, or dashes"),
  value: z
    .string()
    .trim()
    .min(1, "Value cannot be empty")
    .max(4000, "Value cannot exceed 4000 characters"),
  scope: z.nativeEnum(FactSheetScope).default(FactSheetScope.PORTFOLIO),
  projectId: z.string().trim().min(1).optional().nullable(),
  status: z
    .enum([FactSheetStatus.DRAFT, FactSheetStatus.VERIFIED, FactSheetStatus.UNVERIFIED])
    .default(FactSheetStatus.DRAFT),
  isActive: z.boolean().default(true),
});

export type CreateFactSheetInput = z.infer<typeof createFactSheetSchema>;

/**
 * Zod schema for updating an existing fact sheet entry.
 * Note: Updating content fields on a VERIFIED fact automatically demotes it to UNVERIFIED.
 */
export const updateFactSheetSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2, "Key must be at least 2 characters")
    .max(100, "Key must not exceed 100 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Key must only contain letters, numbers, underscores, dots, or dashes")
    .optional(),
  value: z
    .string()
    .trim()
    .min(1, "Value cannot be empty")
    .max(4000, "Value cannot exceed 4000 characters")
    .optional(),
  scope: z.nativeEnum(FactSheetScope).optional(),
  projectId: z.string().trim().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateFactSheetInput = z.infer<typeof updateFactSheetSchema>;

/**
 * Zod schema for approving or rejecting a fact sheet entry (Sales Head only).
 */
export const verifyFactSheetSchema = z.object({
  action: z.enum(["VERIFY", "REJECT"]),
});

export type VerifyFactSheetInput = z.infer<typeof verifyFactSheetSchema>;
