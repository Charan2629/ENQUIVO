import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { UserRole } from "@prisma/client";
import {
  StaffAuthService,
  StaffAuthInvalidCredentialsError,
  StaffAuthThrottledError,
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
  StaffSessionRevokedError,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "@/services/auth/staff-auth.service";
import { testPrisma, disconnectTestPrisma } from "../helpers/testPrisma";

describe("StaffAuthService Integration Tests (Isolated Neon Test Branch)", () => {
  const authService = new StaffAuthService(testPrisma, "integration-test-secret-at-least-32-chars-long");
  const createdUserIds = new Set<string>();

  const RUN_ID = Date.now().toString().slice(-4);
  const headEmail = `head-${RUN_ID}@enquivo.test`;
  const execEmail = `exec-${RUN_ID}@enquivo.test`;
  const buyerEmail = `buyer-${RUN_ID}@enquivo.test`;
  const testPassword = "ValidStaffPassword2026!";

  beforeEach(() => {
    StaffAuthService.clearAllThrottleRecords();
  });

  afterAll(async () => {
    if (createdUserIds.size > 0) {
      await testPrisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
    }
    await disconnectTestPrisma();
  });

  it("1. Successfully authenticates a SALES_HEAD and verifies session token against database", async () => {
    const passwordHash = await authService.hashPassword(testPassword);
    const headUser = await testPrisma.user.create({
      data: {
        email: headEmail,
        name: "Test Sales Head",
        passwordHash,
        role: UserRole.SALES_HEAD,
      },
    });
    createdUserIds.add(headUser.id);

    // Authenticate
    const { token, user } = await authService.authenticateStaff(
      { email: headEmail, password: testPassword },
      "127.0.0.1"
    );

    expect(token).toBeDefined();
    expect(user.id).toBe(headUser.id);
    expect(user.email).toBe(headEmail);
    expect(user.role).toBe(UserRole.SALES_HEAD);

    // Revalidate against live PostgreSQL
    const session = await authService.verifySessionAndFetchUser(token);
    expect(session.user.id).toBe(headUser.id);
    expect(session.user.role).toBe(UserRole.SALES_HEAD);
    expect(session.payload.email).toBe(headEmail);
  });

  it("2. Successfully authenticates a SALES_EXEC", async () => {
    const passwordHash = await authService.hashPassword(testPassword);
    const execUser = await testPrisma.user.create({
      data: {
        email: execEmail,
        name: "Test Sales Exec",
        passwordHash,
        role: UserRole.SALES_EXEC,
      },
    });
    createdUserIds.add(execUser.id);

    const { token, user } = await authService.authenticateStaff(
      { email: execEmail, password: testPassword },
      "127.0.0.1"
    );

    expect(token).toBeDefined();
    expect(user.id).toBe(execUser.id);
    expect(user.role).toBe(UserRole.SALES_EXEC);

    const session = await authService.verifySessionAndFetchUser(token);
    expect(session.user.role).toBe(UserRole.SALES_EXEC);
  });

  it("3. Rejects BUYER accounts attempting to log into staff portal", async () => {
    const passwordHash = await authService.hashPassword(testPassword);
    const buyerUser = await testPrisma.user.create({
      data: {
        email: buyerEmail,
        name: "Test Buyer",
        passwordHash,
        role: UserRole.BUYER,
      },
    });
    createdUserIds.add(buyerUser.id);

    await expect(
      authService.authenticateStaff(
        { email: buyerEmail, password: testPassword },
        "127.0.0.1"
      )
    ).rejects.toThrow(StaffSessionForbiddenError);
  });

  it("4. Rejects invalid passwords with StaffAuthInvalidCredentialsError", async () => {
    await expect(
      authService.authenticateStaff(
        { email: headEmail, password: "WrongPassword999!" },
        "127.0.0.1"
      )
    ).rejects.toThrow(StaffAuthInvalidCredentialsError);
  });

  it("5. Rejects non-existent emails with StaffAuthInvalidCredentialsError", async () => {
    await expect(
      authService.authenticateStaff(
        { email: "nonexistent@enquivo.test", password: testPassword },
        "127.0.0.1"
      )
    ).rejects.toThrow(StaffAuthInvalidCredentialsError);
  });

  it("6. Enforces brute-force lockout after 5 consecutive failed attempts", async () => {
    const targetEmail = `throttle-${RUN_ID}@enquivo.test`;
    const clientIp = "192.168.1.100";

    // 5 failed attempts
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      try {
        await authService.authenticateStaff(
          { email: targetEmail, password: "WrongPassword!" },
          clientIp
        );
      } catch {
        // Expected invalid credentials
      }
    }

    // 6th attempt should be blocked immediately with StaffAuthThrottledError
    await expect(
      authService.authenticateStaff(
        { email: targetEmail, password: testPassword },
        clientIp
      )
    ).rejects.toThrow(StaffAuthThrottledError);
  });

  it("7. Database revalidation rejects session if account is deleted from PostgreSQL", async () => {
    const tempUser = await testPrisma.user.create({
      data: {
        email: `temp-${RUN_ID}@enquivo.test`,
        name: "Temporary User",
        passwordHash: await authService.hashPassword(testPassword),
        role: UserRole.SALES_EXEC,
      },
    });

    const { token } = await authService.authenticateStaff(
      { email: tempUser.email, password: testPassword },
      "127.0.0.1"
    );

    // Delete the user from PostgreSQL
    await testPrisma.user.delete({ where: { id: tempUser.id } });

    // Session verification must now fail
    await expect(authService.verifySessionAndFetchUser(token)).rejects.toThrow(
      StaffSessionInvalidError
    );
  });

  it("8. Prevents token replay attacks by invalidating session in PostgreSQL on revocation", async () => {
    const replayUser = await testPrisma.user.create({
      data: {
        email: `replay-${RUN_ID}@enquivo.test`,
        name: "Replay Test User",
        passwordHash: await authService.hashPassword(testPassword),
        role: UserRole.SALES_EXEC,
      },
    });
    createdUserIds.add(replayUser.id);

    const { token } = await authService.authenticateStaff(
      { email: replayUser.email, password: testPassword },
      "127.0.0.1"
    );

    // Initial revalidation succeeds
    const initialSession = await authService.verifySessionAndFetchUser(token);
    expect(initialSession.user.id).toBe(replayUser.id);

    // Verify session row exists in PostgreSQL
    const payload = authService.verifySessionToken(token);
    expect(payload.rawToken).toBeDefined();
    expect((payload as unknown as Record<string, unknown>).tokenHash).toBeUndefined();

    const tokenHash = StaffAuthService.hashRawToken(payload.rawToken);
    const dbSessionBefore = await testPrisma.staffSession.findUnique({
      where: { tokenHash },
    });
    expect(dbSessionBefore).not.toBeNull();
    expect(dbSessionBefore?.revokedAt).toBeNull();
    expect(dbSessionBefore?.userId).toBe(replayUser.id);
    // Confirm rawToken is NOT stored in the database
    expect(dbSessionBefore?.tokenHash).not.toBe(payload.rawToken);

    // Revoke session server-side in PostgreSQL (as executed during logout)
    await authService.revokeSession(token);

    // Verify database row now reflects revokedAt
    const dbSessionAfter = await testPrisma.staffSession.findUnique({
      where: { tokenHash },
    });
    expect(dbSessionAfter?.revokedAt).not.toBeNull();

    // Replay attempt must fail with StaffSessionRevokedError
    await expect(authService.verifySessionAndFetchUser(token)).rejects.toThrow(
      StaffSessionRevokedError
    );

    // Simulate another independent serverless instance / process restart
    const separateInstanceAuthService = new StaffAuthService(
      testPrisma,
      "integration-test-secret-at-least-32-chars-long"
    );
    await expect(
      separateInstanceAuthService.verifySessionAndFetchUser(token)
    ).rejects.toThrow(StaffSessionRevokedError);
  });

  it("9. Live database role demotion immediately revokes staff access on next request", async () => {
    const demoteUser = await testPrisma.user.create({
      data: {
        email: `demote-${RUN_ID}@enquivo.test`,
        name: "Demote Test User",
        passwordHash: await authService.hashPassword(testPassword),
        role: UserRole.SALES_EXEC,
      },
    });
    createdUserIds.add(demoteUser.id);

    const { token } = await authService.authenticateStaff(
      { email: demoteUser.email, password: testPassword },
      "127.0.0.1"
    );

    // Demote role in live PostgreSQL database
    await testPrisma.user.update({
      where: { id: demoteUser.id },
      data: { role: UserRole.BUYER },
    });

    // Revalidation must immediately reject with StaffSessionForbiddenError
    await expect(authService.verifySessionAndFetchUser(token)).rejects.toThrow(
      StaffSessionForbiddenError
    );
  });

  it("10. Token role mismatch with live database role is immediately rejected", async () => {
    const headToExecUser = await testPrisma.user.create({
      data: {
        email: `head-to-exec-${RUN_ID}@enquivo.test`,
        name: "Head To Exec User",
        passwordHash: await authService.hashPassword(testPassword),
        role: UserRole.SALES_HEAD,
      },
    });
    createdUserIds.add(headToExecUser.id);

    const { token } = await authService.authenticateStaff(
      { email: headToExecUser.email, password: testPassword },
      "127.0.0.1"
    );

    // Admin demotes user from SALES_HEAD to SALES_EXEC in database
    await testPrisma.user.update({
      where: { id: headToExecUser.id },
      data: { role: UserRole.SALES_EXEC },
    });

    // Stale token still claiming SALES_HEAD must be rejected due to role mismatch
    await expect(authService.verifySessionAndFetchUser(token)).rejects.toThrow(
      StaffSessionForbiddenError
    );
  });

  it("11. Rejects session when database record expiresAt has elapsed", async () => {
    const expiredUser = await testPrisma.user.create({
      data: {
        email: `expired-${RUN_ID}@enquivo.test`,
        name: "Expired Test User",
        passwordHash: await authService.hashPassword(testPassword),
        role: UserRole.SALES_EXEC,
      },
    });
    createdUserIds.add(expiredUser.id);

    const { token } = await authService.authenticateStaff(
      { email: expiredUser.email, password: testPassword },
      "127.0.0.1"
    );

    const payload = authService.verifySessionToken(token);
    const tokenHash = StaffAuthService.hashRawToken(payload.rawToken);

    // Manually expire the session in PostgreSQL (e.g. by DB administrative policy)
    await testPrisma.staffSession.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 5000) },
    });

    await expect(authService.verifySessionAndFetchUser(token)).rejects.toThrow(
      "Staff session has expired"
    );
  });

  it("12. Rejects tampered cookie signature before database query is accepted", async () => {
    const validUser = await testPrisma.user.create({
      data: {
        email: `tamper-${RUN_ID}@enquivo.test`,
        name: "Tamper Test User",
        passwordHash: await authService.hashPassword(testPassword),
        role: UserRole.SALES_EXEC,
      },
    });
    createdUserIds.add(validUser.id);

    const { token } = await authService.authenticateStaff(
      { email: validUser.email, password: testPassword },
      "127.0.0.1"
    );

    const [payloadPart] = token.split(".");
    const tamperedToken = `${payloadPart}.invalidSignature1234567890`;

    await expect(authService.verifySessionAndFetchUser(tamperedToken)).rejects.toThrow(
      StaffSessionInvalidError
    );
  });
});
