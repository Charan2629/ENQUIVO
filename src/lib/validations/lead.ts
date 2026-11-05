import { z } from "zod";
import { LeadSource } from "@prisma/client";
import { randomUUID } from "node:crypto";

/**
 * Normalizes varied phone inputs into standard E.164 format.
 * Supports:
 * - 10-digit Indian local: 9876543210 -> +919876543210
 * - 11-digit with leading zero trunk: 09876543210 -> +919876543210
 * - 12-digit with 91 country code: 919876543210 -> +919876543210
 * - Formatted Indian: +91 (98765) 43210, +91-9876543210 -> +919876543210
 * - International E.164: +14155552671 -> +14155552671
 * Rejects invalid strings, non-numeric characters, short numbers, and all zeros.
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw || typeof raw !== "string") {
    throw new Error("Phone number must be a non-empty string");
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("Phone number must be a non-empty string");
  }

  // Reject misplaced '+' characters (only permitted as the very first character)
  if (trimmed.indexOf("+", 1) !== -1) {
    throw new Error("Invalid phone number format: plus sign is only permitted at the beginning");
  }

  // Allow only digits, formatting characters (spaces, hyphens, parentheses), and an optional leading plus sign.
  // Reject letters, punctuation, symbols, and malformed characters.
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) {
    throw new Error(`Invalid phone number: contains disallowed characters`);
  }

  const startsWithPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 0) {
    throw new Error("Phone number contains no digits");
  }

  // Reject numbers consisting entirely of zeros
  if (/^0+$/.test(digits)) {
    throw new Error("Phone number cannot consist entirely of zeros");
  }

  // Case 1: Started with explicit '+'
  if (startsWithPlus) {
    if (digits.length < 10 || digits.length > 15) {
      throw new Error(`Invalid E.164 phone number length (+${digits.length} digits)`);
    }
    // If it's an Indian number (+91), validate standard 10-digit mobile subscriber format [6-9]
    if (digits.startsWith("91")) {
      if (digits.length !== 12) {
        throw new Error("Indian phone numbers with +91 country code must have 10 digits after +91");
      }
      const subscriberNumber = digits.slice(2);
      if (!/^[6-9]/.test(subscriberNumber)) {
        throw new Error("Indian mobile numbers must start with 6, 7, 8, or 9");
      }
    }
    return `+${digits}`;
  }

  // Case 2: 10-digit Indian local starting with 6-9
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }

  // Case 3: 11-digit starting with '0' followed by 6-9 (trunk prefix)
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits[1])) {
    return `+91${digits.slice(1)}`;
  }

  // Case 4: 12-digit starting with '91' followed by 6-9 (Indian without leading plus)
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits[2])) {
    return `+${digits}`;
  }

  throw new Error(`Invalid phone number format: "${raw}"`);
}

/**
 * Normalizes email address to trimmed lowercase, or null if empty or omitted.
 */
export function normalizeEmail(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Generates a collision-resistant, human-readable lead code using Node's crypto.randomUUID().
 * Format: LD-<timestamp-base36>-<uuid-hex-8> (e.g. LD-M3K7F-8F9E2A1B)
 */
export function generateLeadCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-5);
  const randomSuffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `LD-${timestamp}-${randomSuffix}`;
}

/**
 * DPDP Consent Input Schema.
 * Requires explicit affirmative consent flag and non-empty disclosure text.
 */
export const consentInputSchema = z.object({
  consentText: z.string().trim().min(1, "Consent text must not be empty"),
  affirmed: z.literal(true, {
    message: "Consent must be explicitly affirmed (affirmed: true)",
  }),
});

export type ConsentInput = z.infer<typeof consentInputSchema>;

/**
 * Lead Ingestion Schema.
 * Validates and transforms input fields across all lead acquisition channels.
 */
export const ingestLeadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name cannot exceed 100 characters"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .transform((val, ctx) => {
      try {
        return normalizePhoneNumber(val);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : "Invalid phone number format",
        });
        return z.NEVER;
      }
    }),
  email: z
    .string()
    .trim()
    .email("Invalid email format")
    .optional()
    .nullable()
    .transform((val) => normalizeEmail(val)),
  source: z.nativeEnum(LeadSource, {
    message: "Invalid lead source",
  }),
  campaign: z
    .string()
    .trim()
    .max(200, "Campaign cannot exceed 200 characters")
    .optional()
    .nullable(),
  projectId: z.string().trim().min(1, "Project ID cannot be empty").optional().nullable(),
  configuration: z
    .string()
    .trim()
    .max(50, "Configuration cannot exceed 50 characters")
    .optional()
    .nullable(),
  consent: consentInputSchema.optional().nullable(),
});

export type IngestLeadInput = z.input<typeof ingestLeadSchema>;
export type ValidatedLeadInput = z.output<typeof ingestLeadSchema>;
