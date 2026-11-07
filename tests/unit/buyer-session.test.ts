import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  BuyerSessionService,
  BuyerSessionInvalidError,
  BuyerSessionExpiredError,
  DEFAULT_SESSION_DURATION_MS,
  BUYER_SESSION_COOKIE,
} from "@/services/session/buyer-session.service";

describe("BuyerSessionService Unit Tests", () => {
  const testSecret = "test-secret-key-for-session-service-32-chars";
  // We can pass a mock PrismaClient for unit tests that test cryptographic functions
  const sessionService = new BuyerSessionService({} as unknown as PrismaClient, testSecret);

  describe("Token Generation and Hashing", () => {
    it("generates a high-entropy base64url random session token and matching SHA-256 hash", () => {
      const { rawToken, tokenHash } = sessionService.generateSessionToken();

      expect(typeof rawToken).toBe("string");
      expect(rawToken.length).toBeGreaterThanOrEqual(40); // 32 bytes in base64url is ~43 chars
      expect(typeof tokenHash).toBe("string");
      expect(tokenHash).toHaveLength(64); // SHA-256 hex digest is 64 hex characters
      expect(/^[0-9a-f]{64}$/.test(tokenHash)).toBe(true);

      // Verify that hashToken on the rawToken matches tokenHash deterministically
      const recomputedHash = sessionService.hashToken(rawToken);
      expect(recomputedHash).toBe(tokenHash);
    });

    it("generates distinct random tokens on successive calls", () => {
      const token1 = sessionService.generateSessionToken();
      const token2 = sessionService.generateSessionToken();

      expect(token1.rawToken).not.toBe(token2.rawToken);
      expect(token1.tokenHash).not.toBe(token2.tokenHash);
    });

    it("produces deterministic SHA-256 hashes for identical inputs", () => {
      const input = "sample-token-abc-123";
      const hash1 = sessionService.hashToken(input);
      const hash2 = sessionService.hashToken(input);

      expect(hash1).toBe(hash2);
    });
  });

  describe("Token Signing and Verification", () => {
    it("signs a session and returns a valid two-part token string", () => {
      const tokenString = sessionService.signSession({
        conversationId: "conv_test_123",
        leadId: "lead_test_456",
      });

      expect(typeof tokenString).toBe("string");
      const parts = tokenString.split(".");
      expect(parts).toHaveLength(2);

      const verified = sessionService.verifySessionToken(tokenString);
      expect(verified.conversationId).toBe("conv_test_123");
      expect(verified.leadId).toBe("lead_test_456");
      expect(typeof verified.tokenHash).toBe("string");
      expect(verified.expiresAt).toBeGreaterThan(Date.now());
    });

    it("rejects tampered token payloads", () => {
      const validToken = sessionService.signSession({
        conversationId: "conv_legit",
        leadId: "lead_legit",
      });

      const [payload, signature] = validToken.split(".");

      // Tamper with payload to change conversation ID to a victim's
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
      decoded.conversationId = "conv_victim";
      const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");
      const tamperedToken = `${tamperedPayload}.${signature}`;

      expect(() => sessionService.verifySessionToken(tamperedToken)).toThrow(
        BuyerSessionInvalidError
      );
    });

    it("rejects forged or modified signatures", () => {
      const validToken = sessionService.signSession({
        conversationId: "conv_legit",
        leadId: "lead_legit",
      });

      const [payload] = validToken.split(".");
      const forgedToken = `${payload}.invalidsignature1234567890`;

      expect(() => sessionService.verifySessionToken(forgedToken)).toThrow(
        BuyerSessionInvalidError
      );
    });

    it("rejects malformed token strings", () => {
      expect(() => sessionService.verifySessionToken("")).toThrow(BuyerSessionInvalidError);
      expect(() => sessionService.verifySessionToken("no-dots-here")).toThrow(
        BuyerSessionInvalidError
      );
      expect(() => sessionService.verifySessionToken("too.many.dots.in.token")).toThrow(
        BuyerSessionInvalidError
      );
    });

    it("rejects expired session tokens", () => {
      // Create a token that expired 1 second ago
      const expiredToken = sessionService.signSession({
        conversationId: "conv_exp",
        leadId: "lead_exp",
        expiresInMs: -1000,
      });

      expect(() => sessionService.verifySessionToken(expiredToken)).toThrow(
        BuyerSessionExpiredError
      );
    });
  });

  describe("Cookie Security Options", () => {
    it("enforces HttpOnly, SameSite=Lax, and Path=/ with appropriate Max-Age", () => {
      const cookieOptions = sessionService.getCookieOptions();

      expect(cookieOptions.httpOnly).toBe(true);
      expect(cookieOptions.sameSite).toBe("lax");
      expect(cookieOptions.path).toBe("/");
      expect(cookieOptions.maxAge).toBe(Math.floor(DEFAULT_SESSION_DURATION_MS / 1000));
      expect(BUYER_SESSION_COOKIE).toBe("eq_buyer_session");
    });
  });
});
