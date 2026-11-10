import { describe, it, expect } from "vitest";
import { LeadSource } from "@prisma/client";
import {
  normalizePhoneNumber,
  normalizeEmail,
  generateLeadCode,
  ingestLeadSchema,
} from "@/lib/validations/lead";

describe("Phone Normalization (normalizePhoneNumber)", () => {
  it("normalizes a standard 10-digit Indian local mobile number starting with 6-9", () => {
    expect(normalizePhoneNumber("9876543210")).toBe("+919876543210");
    expect(normalizePhoneNumber("8765432109")).toBe("+918765432109");
    expect(normalizePhoneNumber("7654321098")).toBe("+917654321098");
    expect(normalizePhoneNumber("6543210987")).toBe("+916543210987");
  });

  it("normalizes 10-digit numbers with whitespace, hyphens, and brackets", () => {
    expect(normalizePhoneNumber("98765 43210")).toBe("+919876543210");
    expect(normalizePhoneNumber("98765-43210")).toBe("+919876543210");
    expect(normalizePhoneNumber("(98765) 43210")).toBe("+919876543210");
    expect(normalizePhoneNumber(" 98765-43210 ")).toBe("+919876543210");
  });

  it("normalizes 11-digit numbers with a leading zero trunk prefix", () => {
    expect(normalizePhoneNumber("09876543210")).toBe("+919876543210");
    expect(normalizePhoneNumber("0 98765 43210")).toBe("+919876543210");
  });

  it("normalizes 12-digit numbers with a 91 country code prefix without a plus sign", () => {
    expect(normalizePhoneNumber("919876543210")).toBe("+919876543210");
    expect(normalizePhoneNumber("91-98765-43210")).toBe("+919876543210");
  });

  it("normalizes formatted numbers that already include +91", () => {
    expect(normalizePhoneNumber("+919876543210")).toBe("+919876543210");
    expect(normalizePhoneNumber("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhoneNumber("+91 (98765) 43210")).toBe("+919876543210");
    expect(normalizePhoneNumber("+91-98765-43210")).toBe("+919876543210");
  });

  it("preserves valid international E.164 phone numbers with other country codes", () => {
    expect(normalizePhoneNumber("+14155552671")).toBe("+14155552671");
    expect(normalizePhoneNumber("+442071838750")).toBe("+442071838750");
    expect(normalizePhoneNumber("+971501234567")).toBe("+971501234567");
  });

  it("throws an error for invalid, empty, or garbage phone numbers", () => {
    expect(() => normalizePhoneNumber("")).toThrow("Phone number must be a non-empty string");
    expect(() => normalizePhoneNumber("   ")).toThrow("Phone number must be a non-empty string");
    expect(() => normalizePhoneNumber("+---")).toThrow("Phone number contains no digits");
    expect(() => normalizePhoneNumber("abcdefghij")).toThrow("contains disallowed characters");
    expect(() => normalizePhoneNumber("98765abc43210")).toThrow("contains disallowed characters");
    expect(() => normalizePhoneNumber("+91 98765 abc 43210")).toThrow("contains disallowed characters");
    expect(() => normalizePhoneNumber("98765@43210")).toThrow("contains disallowed characters");
    expect(() => normalizePhoneNumber("0000000000")).toThrow("cannot consist entirely of zeros");
    expect(() => normalizePhoneNumber("+000000000000")).toThrow("cannot consist entirely of zeros");
    expect(() => normalizePhoneNumber("12345")).toThrow("Invalid phone number format");
    expect(() => normalizePhoneNumber("+123")).toThrow("Invalid E.164 phone number length");
    expect(() => normalizePhoneNumber("+12345678901234567")).toThrow("Invalid E.164 phone number length");
  });

  it("throws an error for misplaced plus signs", () => {
    expect(() => normalizePhoneNumber("98+76543210")).toThrow("plus sign is only permitted at the beginning");
    expect(() => normalizePhoneNumber("+91+9876543210")).toThrow("plus sign is only permitted at the beginning");
    expect(() => normalizePhoneNumber("++919876543210")).toThrow("plus sign is only permitted at the beginning");
  });

  it("throws an error for Indian mobile numbers starting with invalid prefixes (1-5)", () => {
    expect(() => normalizePhoneNumber("1234567890")).toThrow("Invalid phone number format");
    expect(() => normalizePhoneNumber("5876543210")).toThrow("Invalid phone number format");
    expect(() => normalizePhoneNumber("+915876543210")).toThrow("Indian mobile numbers must start with 6, 7, 8, or 9");
    expect(() => normalizePhoneNumber("+91987654321")).toThrow(
      "Indian phone numbers with +91 country code must have 10 digits after +91"
    );
  });
});

describe("Email Normalization (normalizeEmail)", () => {
  it("converts emails to trimmed lowercase", () => {
    expect(normalizeEmail("Hardik.Patel@Example.COM")).toBe("hardik.patel@example.com");
    expect(normalizeEmail("  NIDHI@GMAIL.COM  ")).toBe("nidhi@gmail.com");
  });

  it("returns null for empty, null, undefined, or whitespace-only inputs", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe("Lead Code Generation (generateLeadCode)", () => {
  it("generates a lead code starting with LD- and matching expected pattern", () => {
    const code = generateLeadCode();
    expect(code).toMatch(/^LD-[A-Z0-9]{5}-[A-Z0-9]{8}$/);
    expect(code.startsWith("LD-")).toBe(true);
  });

  it("generates distinct codes on successive invocations", () => {
    // Note: Probabilistic testing does not prove collision freedom.
    // True uniqueness at scale is guaranteed by the PostgreSQL UNIQUE index
    // on leads(lead_code) combined with the service layer's bounded retry loop on P2002.
    const codeA = generateLeadCode();
    const codeB = generateLeadCode();
    expect(codeA).not.toBe(codeB);
  });
});

describe("Lead Ingestion Schema (ingestLeadSchema)", () => {
  it("validates and transforms a complete valid payload", () => {
    const rawInput = {
      name: "  Hardik Patel  ",
      phone: "98765 43210",
      email: "  HARDIK.PATEL@EXAMPLE.COM  ",
      source: LeadSource.PROPERTY_PORTAL,
      campaign: "Housing.com Oct Campaign",
      projectId: "proj_123",
      configuration: "3 BHK",
      consent: {
        consentText: "I agree to receive project updates via WhatsApp and phone call.",
        affirmed: true,
      },
    };

    const parsed = ingestLeadSchema.parse(rawInput);
    expect(parsed.name).toBe("Hardik Patel");
    expect(parsed.phone).toBe("+919876543210");
    expect(parsed.email).toBe("hardik.patel@example.com");
    expect(parsed.source).toBe(LeadSource.PROPERTY_PORTAL);
    expect(parsed.campaign).toBe("Housing.com Oct Campaign");
    expect(parsed.projectId).toBe("proj_123");
    expect(parsed.configuration).toBe("3 BHK");
    expect(parsed.consent).toEqual({
      consentText: "I agree to receive project updates via WhatsApp and phone call.",
      affirmed: true,
    });
  });

  it("validates a minimal valid payload", () => {
    const minimalInput = {
      name: "Nidhi Shah",
      phone: "+919876543211",
      source: LeadSource.SOCIAL_MEDIA_AD,
    };

    const parsed = ingestLeadSchema.parse(minimalInput);
    expect(parsed.name).toBe("Nidhi Shah");
    expect(parsed.phone).toBe("+919876543211");
    expect(parsed.source).toBe(LeadSource.SOCIAL_MEDIA_AD);
    expect(parsed.email).toBeNull();
    expect(parsed.campaign).toBeUndefined();
    expect(parsed.projectId).toBeUndefined();
    expect(parsed.configuration).toBeUndefined();
    expect(parsed.consent).toBeUndefined();
  });

  it("rejects an empty name", () => {
    expect(() =>
      ingestLeadSchema.parse({
        name: "   ",
        phone: "9876543210",
        source: LeadSource.WEBSITE,
      })
    ).toThrow();
  });

  it("rejects an invalid phone number", () => {
    expect(() =>
      ingestLeadSchema.parse({
        name: "Test User",
        phone: "12345",
        source: LeadSource.WEBSITE,
      })
    ).toThrow();
  });

  it("rejects an invalid email format", () => {
    expect(() =>
      ingestLeadSchema.parse({
        name: "Test User",
        phone: "9876543210",
        email: "not-an-email",
        source: LeadSource.WEBSITE,
      })
    ).toThrow("Invalid email format");
  });

  it("rejects an invalid lead source enum", () => {
    expect(() =>
      ingestLeadSchema.parse({
        name: "Test User",
        phone: "9876543210",
        source: "INVALID_SOURCE",
      })
    ).toThrow("Invalid lead source");
  });

  it("strictly enforces explicit affirmative consent (affirmed: true)", () => {
    // Missing affirmed flag
    expect(() =>
      ingestLeadSchema.parse({
        name: "Test User",
        phone: "9876543210",
        source: LeadSource.WEBSITE,
        consent: {
          consentText: "I agree.",
          affirmed: false,
        },
      })
    ).toThrow("Consent must be explicitly affirmed (affirmed: true)");

    // Empty consentText
    expect(() =>
      ingestLeadSchema.parse({
        name: "Test User",
        phone: "9876543210",
        source: LeadSource.WEBSITE,
        consent: {
          consentText: "   ",
          affirmed: true,
        },
      })
    ).toThrow();
  });

  it("strictly validates Indian mobile phone formats and rejects incomplete numbers", () => {
    // 5-digit phone number is rejected
    expect(() =>
      ingestLeadSchema.parse({
        name: "Test User",
        phone: "12345",
        source: LeadSource.WEBSITE,
      })
    ).toThrow();

    // Valid 10-digit Indian numbers starting with 6, 7, 8, 9 succeed and normalize to +91
    const validLeads = ["9876543210", "8765432109", "7654321098", "6543210987"];
    for (const phone of validLeads) {
      const parsed = ingestLeadSchema.parse({
        name: "Test User",
        phone,
        source: LeadSource.WEBSITE,
      });
      expect(parsed.phone).toBe(`+91${phone}`);
    }
  });
});
