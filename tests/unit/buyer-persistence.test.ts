import { describe, it, expect, vi } from "vitest";
import {
  BuyerSessionService,
  BuyerSessionInvalidError,
  BuyerSessionExpiredError,
  BuyerSessionRevokedError,
  BuyerSessionOptedOutError,
  BUYER_SESSION_COOKIE,
} from "@/services/session/buyer-session.service";
import { PrismaClient, ConversationLanguage, LeadSource } from "@prisma/client";

describe("Buyer Identity & Conversation Persistence (Unit Tests)", () => {
  const testSecret = "enquivo-secure-test-secret-key-32-chars-long";

  function createMockDb(options: {
    conversationExists?: boolean;
    leadIdMismatch?: boolean;
    isEnded?: boolean;
    isOptedOut?: boolean;
  } = {}) {
    const {
      conversationExists = true,
      leadIdMismatch = false,
      isEnded = false,
      isOptedOut = false,
    } = options;

    return {
      conversation: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (!conversationExists) return Promise.resolve(null);
          return Promise.resolve({
            id: where.id,
            leadId: leadIdMismatch ? "lead-different-owner" : "lead-owner-101",
            language: ConversationLanguage.EN,
            endedAt: isEnded ? new Date() : null,
            lead: {
              id: leadIdMismatch ? "lead-different-owner" : "lead-owner-101",
              name: "Nidhi Shah",
              phone: "+919876543210",
              source: LeadSource.SOCIAL_MEDIA_AD,
              consentRecord: {
                id: "consent-101",
                consentedAt: new Date("2026-11-01T10:00:00Z"),
                optedOut: isOptedOut,
                optedOutAt: isOptedOut ? new Date() : null,
              },
            },
          });
        }),
      },
    };
  }

  it("1. first visit without cookie results in unauthenticated state requiring intake", () => {
    const sessionService = new BuyerSessionService({} as unknown as PrismaClient, testSecret);

    expect(() => sessionService.verifySessionToken(undefined)).toThrow(
      BuyerSessionInvalidError
    );
    expect(() => sessionService.verifySessionToken("")).toThrow(
      BuyerSessionInvalidError
    );
  });

  it("2. intake creates signed HTTP-only cookie with strict 24-hour expiry and root path", () => {
    const sessionService = new BuyerSessionService({} as unknown as PrismaClient, testSecret);

    const token = sessionService.signSession({
      conversationId: "conv-live-001",
      leadId: "lead-live-001",
    });

    expect(typeof token).toBe("string");
    expect(token).toContain(".");

    const cookieOptions = sessionService.getCookieOptions();
    expect(cookieOptions.httpOnly).toBe(true);
    expect(cookieOptions.sameSite).toBe("lax");
    expect(cookieOptions.path).toBe("/");
    expect(cookieOptions.maxAge).toBe(86400); // 24 hours in seconds
    expect(BUYER_SESSION_COOKIE).toBe("eq_buyer_session");
  });

  it("3. returning visit with valid cookie restores buyer identity, lead context, and active conversation", async () => {
    const mockDb = createMockDb();
    const sessionService = new BuyerSessionService(mockDb as unknown as PrismaClient, testSecret);

    const validToken = sessionService.signSession({
      conversationId: "conv-valid-789",
      leadId: "lead-owner-101",
    });

    const session = await sessionService.validateSession(validToken);

    expect(session.conversation.id).toBe("conv-valid-789");
    expect(session.lead.name).toBe("Nidhi Shah");
    expect(session.lead.phone).toBe("+919876543210");
    expect(session.lead.consentRecord?.optedOut).toBe(false);
  });

  it("4. rejects session if conversation has ended (e.g. buyer completed or session closed)", async () => {
    const mockDb = createMockDb({ isEnded: true });
    const sessionService = new BuyerSessionService(mockDb as unknown as PrismaClient, testSecret);

    const token = sessionService.signSession({
      conversationId: "conv-ended-999",
      leadId: "lead-owner-101",
    });

    await expect(sessionService.validateSession(token)).rejects.toThrow(
      BuyerSessionRevokedError
    );
  });

  it("5. rejects session if buyer has exercised DPDP Act 2023 right to opt out", async () => {
    const mockDb = createMockDb({ isOptedOut: true });
    const sessionService = new BuyerSessionService(mockDb as unknown as PrismaClient, testSecret);

    const token = sessionService.signSession({
      conversationId: "conv-opted-out",
      leadId: "lead-owner-101",
    });

    await expect(sessionService.validateSession(token)).rejects.toThrow(
      BuyerSessionOptedOutError
    );
  });

  it("6. rejects expired session tokens exceeding 24 hours duration", () => {
    const sessionService = new BuyerSessionService({} as unknown as PrismaClient, testSecret);

    const expiredToken = sessionService.signSession({
      conversationId: "conv-expired",
      leadId: "lead-owner-101",
      expiresInMs: -5000, // 5 seconds in the past
    });

    expect(() => sessionService.verifySessionToken(expiredToken)).toThrow(
      BuyerSessionExpiredError
    );
  });

  it("7. prevents cross-lead session hijacking if payload leadId is tampered", async () => {
    const mockDb = createMockDb({ leadIdMismatch: true });
    const sessionService = new BuyerSessionService(mockDb as unknown as PrismaClient, testSecret);

    const token = sessionService.signSession({
      conversationId: "conv-mismatch",
      leadId: "lead-attacker",
    });

    await expect(sessionService.validateSession(token)).rejects.toThrow(
      "Session binding mismatch"
    );
  });
});
