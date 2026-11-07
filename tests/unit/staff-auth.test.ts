import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient, UserRole } from "@prisma/client";
import {
  StaffAuthService,
  StaffSessionInvalidError,
  StaffSessionExpiredError,
  StaffSessionRevokedError,
  StaffSessionForbiddenError,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "@/services/auth/staff-auth.service";

describe("StaffAuthService (Unit Tests)", () => {
  let authService: StaffAuthService;
  const mockSecret = "test-staff-secret-at-least-32-characters-long!";

  beforeEach(() => {
    StaffAuthService.clearAllThrottleRecords();
    authService = new StaffAuthService({} as unknown as PrismaClient, mockSecret);
  });

  describe("Password Hashing & Argon2id Verification", () => {
    it("should hash a password and verify it successfully with Argon2id", async () => {
      const password = "SecureStaffPassword2026!";
      const hash = await authService.hashPassword(password);

      expect(hash).toMatch(/^\$argon2id\$/);

      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await authService.verifyPassword("WrongPassword123!", hash);
      expect(isInvalid).toBe(false);
    });

    it("should handle corrupted or invalid hash strings without crashing", async () => {
      const isValid = await authService.verifyPassword("AnyPassword", "not-a-valid-argon2-hash");
      expect(isValid).toBe(false);
    });
  });

  describe("Token Signing & Cryptographic HMAC Verification", () => {
    const mockUser = {
      id: "usr-sales-head-1",
      email: "sales-head@enquivo.in",
      name: "Aarav Sharma",
      role: UserRole.SALES_HEAD,
    };

    it("should sign a staff session and verify its contents accurately", () => {
      const token = authService.signStaffSession(mockUser, 60000); // 1 minute
      expect(token).toContain(".");

      const payload = authService.verifySessionToken(token);
      expect(payload.userId).toBe(mockUser.id);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.name).toBe(mockUser.name);
      expect(payload.role).toBe(UserRole.SALES_HEAD);
      expect(payload.rawToken).toBeDefined();
      expect((payload as unknown as Record<string, unknown>).tokenHash).toBeUndefined();
      expect(payload.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should reject a tampered payload with StaffSessionInvalidError", () => {
      const token = authService.signStaffSession(mockUser);
      const [payloadPart, sigPart] = token.split(".");

      // Tamper payload: change role from SALES_HEAD to BUYER
      const decoded = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf-8"));
      decoded.role = UserRole.BUYER;
      const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");

      const tamperedToken = `${tamperedPayload}.${sigPart}`;
      expect(() => authService.verifySessionToken(tamperedToken)).toThrow(StaffSessionInvalidError);
    });

    it("should reject a tampered signature with StaffSessionInvalidError", () => {
      const token = authService.signStaffSession(mockUser);
      const [payloadPart] = token.split(".");

      const forgedToken = `${payloadPart}.invalidsignature1234567890`;
      expect(() => authService.verifySessionToken(forgedToken)).toThrow(StaffSessionInvalidError);
    });

    it("should reject expired session tokens with StaffSessionExpiredError", () => {
      // Create token that expired 10 seconds ago
      const token = authService.signStaffSession(mockUser, -10000);

      expect(() => authService.verifySessionToken(token)).toThrow(StaffSessionExpiredError);
    });

    it("should reject missing or malformed tokens", () => {
      expect(() => authService.verifySessionToken(undefined)).toThrow(StaffSessionInvalidError);
      expect(() => authService.verifySessionToken("")).toThrow(StaffSessionInvalidError);
      expect(() => authService.verifySessionToken("not-a-token-with-two-parts")).toThrow(
        StaffSessionInvalidError
      );
    });
  });

  describe("Brute-Force Login Throttling", () => {
    const key = StaffAuthService.getThrottleKey("test@enquivo.in", "127.0.0.1");

    it("should allow attempts below the threshold", () => {
      for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS - 1; i++) {
        authService.recordFailedAttempt(key);
      }

      const status = authService.isThrottled(key);
      expect(status.throttled).toBe(false);
    });

    it("should throttle after MAX_FAILED_LOGIN_ATTEMPTS attempts", () => {
      for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
        authService.recordFailedAttempt(key);
      }

      const status = authService.isThrottled(key);
      expect(status.throttled).toBe(true);
      expect(status.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("should reset throttle count on resetFailedAttempts", () => {
      for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
        authService.recordFailedAttempt(key);
      }
      expect(authService.isThrottled(key).throttled).toBe(true);

      authService.resetFailedAttempts(key);
      expect(authService.isThrottled(key).throttled).toBe(false);
    });
  });

  describe("Persistent Database Revalidation & Revocation", () => {
    const mockDbUser = {
      id: "usr-sales-exec-1",
      email: "vikram.mehta@enquivo.in",
      name: "Vikram Mehta",
      role: UserRole.SALES_EXEC,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should verify token and return fresh database user details when session exists and is active", async () => {
      const mockSessionRecord = {
        id: "sess-active",
        userId: mockDbUser.id,
        tokenHash: "mock-token-hash",
        expiresAt: new Date(Date.now() + 60000),
        revokedAt: null,
        createdAt: new Date(),
        user: mockDbUser,
      };

      const mockDb = {
        staffSession: {
          findUnique: async () => mockSessionRecord,
        },
      };

      const service = new StaffAuthService(mockDb as unknown as PrismaClient, mockSecret);
      const token = service.signStaffSession(mockDbUser);

      const result = await service.verifySessionAndFetchUser(token);
      expect(result.user.id).toBe(mockDbUser.id);
      expect(result.user.email).toBe(mockDbUser.email);
      expect(result.user.role).toBe(UserRole.SALES_EXEC);
    });

    it("should reject session if session record is not found in database", async () => {
      const mockDb = {
        staffSession: {
          findUnique: async () => null,
        },
      };

      const service = new StaffAuthService(mockDb as unknown as PrismaClient, mockSecret);
      const token = service.signStaffSession(mockDbUser);

      await expect(service.verifySessionAndFetchUser(token)).rejects.toThrow(
        StaffSessionInvalidError
      );
    });

    it("should reject session if session has been revoked in database (revokedAt is not null)", async () => {
      const mockRevokedSession = {
        id: "sess-revoked",
        userId: mockDbUser.id,
        tokenHash: "mock-token-hash",
        expiresAt: new Date(Date.now() + 60000),
        revokedAt: new Date(), // Revoked!
        createdAt: new Date(),
        user: mockDbUser,
      };

      const mockDb = {
        staffSession: {
          findUnique: async () => mockRevokedSession,
        },
      };

      const service = new StaffAuthService(mockDb as unknown as PrismaClient, mockSecret);
      const token = service.signStaffSession(mockDbUser);

      await expect(service.verifySessionAndFetchUser(token)).rejects.toThrow(
        StaffSessionRevokedError
      );
    });

    it("should reject session if database user has been demoted to BUYER role", async () => {
      const mockDemotedSession = {
        id: "sess-demoted",
        userId: mockDbUser.id,
        tokenHash: "mock-token-hash",
        expiresAt: new Date(Date.now() + 60000),
        revokedAt: null,
        createdAt: new Date(),
        user: { ...mockDbUser, role: UserRole.BUYER }, // Demoted!
      };

      const mockDb = {
        staffSession: {
          findUnique: async () => mockDemotedSession,
        },
      };

      const service = new StaffAuthService(mockDb as unknown as PrismaClient, mockSecret);
      const token = service.signStaffSession(mockDbUser);

      await expect(service.verifySessionAndFetchUser(token)).rejects.toThrow(
        StaffSessionForbiddenError
      );
    });

    it("should reject session if token role claims mismatch the live database role", async () => {
      const mockMismatchSession = {
        id: "sess-mismatch",
        userId: mockDbUser.id,
        tokenHash: "mock-token-hash",
        expiresAt: new Date(Date.now() + 60000),
        revokedAt: null,
        createdAt: new Date(),
        user: { ...mockDbUser, role: UserRole.SALES_EXEC }, // Live DB says SALES_EXEC
      };

      const mockDb = {
        staffSession: {
          findUnique: async () => mockMismatchSession,
        },
      };

      const service = new StaffAuthService(mockDb as unknown as PrismaClient, mockSecret);
      // Stale or forged token claiming SALES_HEAD
      const token = service.signStaffSession({
        ...mockDbUser,
        role: UserRole.SALES_HEAD,
      });

      await expect(service.verifySessionAndFetchUser(token)).rejects.toThrow(
        StaffSessionForbiddenError
      );
    });

    it("revokeSession should persistently record revokedAt in PostgreSQL", async () => {
      let updatedRevokedAt = false;
      const mockDb = {
        staffSession: {
          updateMany: async ({ data }: { data: { revokedAt: Date } }) => {
            if (data.revokedAt) updatedRevokedAt = true;
            return { count: 1 };
          },
        },
      };

      const service = new StaffAuthService(mockDb as unknown as PrismaClient, mockSecret);
      const token = service.signStaffSession(mockDbUser);

      const revoked = await service.revokeSession(token);
      expect(revoked).toBe(true);
      expect(updatedRevokedAt).toBe(true);
    });

    it("should fail closed and throw if database error occurs during session verification", async () => {
      const mockDb = {
        staffSession: {
          findUnique: async () => {
            throw new Error("Neon PostgreSQL connection timeout");
          },
        },
      };

      const service = new StaffAuthService(mockDb as unknown as PrismaClient, mockSecret);
      const token = service.signStaffSession(mockDbUser);

      // Must fail closed by rejecting (not returning an authenticated session)
      await expect(service.verifySessionAndFetchUser(token)).rejects.toThrow(
        "Neon PostgreSQL connection timeout"
      );
    });

    it("should throw if database error occurs during session revocation so caller knows revocation failed", async () => {
      const mockDb = {
        staffSession: {
          updateMany: async () => {
            throw new Error("Database network partition during revocation update");
          },
        },
      };

      const service = new StaffAuthService(mockDb as unknown as PrismaClient, mockSecret);
      const token = service.signStaffSession(mockDbUser);

      await expect(service.revokeSession(token)).rejects.toThrow(
        "Database network partition during revocation update"
      );
    });

    it("authenticateStaff persists only tokenHash to database and includes rawToken (not tokenHash) in cookie", async () => {
      let createdSessionData: { userId: string; tokenHash: string; expiresAt: Date } | null = null;
      const mockDb = {
        user: {
          findUnique: async () => ({
            id: "usr-1",
            email: "staff@enquivo.in",
            name: "Staff User",
            role: UserRole.SALES_EXEC,
            passwordHash: await authService.hashPassword("TestPass123!"),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        staffSession: {
          create: async ({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
            createdSessionData = data;
            return { id: "sess-1", ...data, revokedAt: null, createdAt: new Date() };
          },
        },
      };

      const service = new StaffAuthService(mockDb as unknown as PrismaClient, mockSecret);
      const { token } = await service.authenticateStaff(
        { email: "staff@enquivo.in", password: "TestPass123!" },
        "127.0.0.1"
      );

      // Decode the cookie payload
      const [payloadPart] = token.split(".");
      const decodedPayload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf-8"));

      // Cookie must contain rawToken, NOT tokenHash
      expect(decodedPayload.rawToken).toBeDefined();
      expect(decodedPayload.tokenHash).toBeUndefined();

      // Database must receive tokenHash, NEVER rawToken
      expect(createdSessionData).not.toBeNull();
      expect(createdSessionData!.tokenHash).toBeDefined();
      expect(createdSessionData!.tokenHash).toBe(StaffAuthService.hashRawToken(decodedPayload.rawToken));
      expect((createdSessionData! as unknown as Record<string, unknown>).rawToken).toBeUndefined();
      expect(createdSessionData!.tokenHash).not.toBe(decodedPayload.rawToken);
    });

    it("tampered cookies are rejected by verifySessionAndFetchUser before database lookup", async () => {
      let dbLookupCalled = false;
      const mockDb = {
        staffSession: {
          findUnique: async () => {
            dbLookupCalled = true;
            return null;
          },
        },
      };

      const service = new StaffAuthService(mockDb as unknown as PrismaClient, mockSecret);
      const token = service.signStaffSession(mockDbUser);
      const [payloadPart] = token.split(".");

      // Tampered signature
      const tamperedToken = `${payloadPart}.forgedSignature1234567890`;
      await expect(service.verifySessionAndFetchUser(tamperedToken)).rejects.toThrow(
        StaffSessionInvalidError
      );
      expect(dbLookupCalled).toBe(false);
    });

    it("revokeSession computes SHA-256 of rawToken and updates matching database tokenHash", async () => {
      let queriedTokenHash: string | null = null;
      const mockDb = {
        staffSession: {
          updateMany: async ({ where }: { where: { tokenHash: string; revokedAt: null } }) => {
            queriedTokenHash = where.tokenHash;
            return { count: 1 };
          },
        },
      };

      const service = new StaffAuthService(mockDb as unknown as PrismaClient, mockSecret);
      const token = service.signStaffSession(mockDbUser);
      const payload = service.verifySessionToken(token);

      const revoked = await service.revokeSession(token);
      expect(revoked).toBe(true);
      expect(queriedTokenHash).toBe(StaffAuthService.hashRawToken(payload.rawToken));
    });
  });
});
