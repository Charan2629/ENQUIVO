import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaClient, UserRole } from "@prisma/client";
import { hash, verify } from "@node-rs/argon2";
import { prisma as defaultPrisma } from "@/lib/prisma";

// ============================================================================
// Errors
// ============================================================================
export class StaffAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffAuthError";
  }
}

export class StaffAuthInvalidCredentialsError extends StaffAuthError {
  constructor(message = "Invalid email or password") {
    super(message);
    this.name = "StaffAuthInvalidCredentialsError";
  }
}

export class StaffAuthThrottledError extends StaffAuthError {
  constructor(public retryAfterSeconds: number, message = "Too many failed login attempts. Please try again later.") {
    super(message);
    this.name = "StaffAuthThrottledError";
  }
}

export class StaffSessionInvalidError extends StaffAuthError {
  constructor(message = "Invalid staff session token") {
    super(message);
    this.name = "StaffSessionInvalidError";
  }
}

export class StaffSessionExpiredError extends StaffAuthError {
  constructor(message = "Staff session has expired") {
    super(message);
    this.name = "StaffSessionExpiredError";
  }
}

export class StaffSessionRevokedError extends StaffAuthError {
  constructor(message = "Staff session has been revoked or logged out") {
    super(message);
    this.name = "StaffSessionRevokedError";
  }
}

export class StaffSessionForbiddenError extends StaffAuthError {
  constructor(message = "Account does not have required staff permissions") {
    super(message);
    this.name = "StaffSessionForbiddenError";
  }
}

// ============================================================================
// Types
// ============================================================================
export interface StaffSessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  rawToken: string;
  createdAt: number;
  expiresAt: number;
}

export interface SanitizedStaffUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidatedStaffSession {
  payload: StaffSessionPayload;
  user: SanitizedStaffUser;
}

export interface LoginAttempt {
  count: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
}

export const STAFF_SESSION_COOKIE = "eq_staff_session";
export const DEFAULT_STAFF_SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Allowed staff roles
export const ALLOWED_STAFF_ROLES: UserRole[] = [UserRole.SALES_HEAD, UserRole.SALES_EXEC];

// ============================================================================
// StaffAuthService
// ============================================================================
export class StaffAuthService {
  private secret: string;
  private static failedAttempts = new Map<string, LoginAttempt>();

  constructor(
    private db: PrismaClient = defaultPrisma,
    secret?: string
  ) {
    this.secret =
      secret ||
      process.env.AUTH_SECRET ||
      process.env.SESSION_SECRET ||
      "enquivo-staff-default-development-secret-change-in-production-32-chars";
  }

  // --------------------------------------------------------------------------
  // Password Management (Argon2id)
  // --------------------------------------------------------------------------
  async hashPassword(password: string): Promise<string> {
    return hash(password);
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Brute-Force Throttling
  // --------------------------------------------------------------------------
  static getThrottleKey(identifier: string, ip?: string | null): string {
    const cleanIp = (ip || "unknown").trim();
    const cleanId = identifier.trim().toLowerCase();
    return `${cleanIp}:${cleanId}`;
  }

  isThrottled(key: string): { throttled: boolean; retryAfterSeconds: number } {
    const attempt = StaffAuthService.failedAttempts.get(key);
    if (!attempt) {
      return { throttled: false, retryAfterSeconds: 0 };
    }

    const now = Date.now();
    const timeSinceFirst = now - attempt.firstAttemptAt;

    // Window has elapsed -> reset
    if (timeSinceFirst > LOGIN_LOCKOUT_WINDOW_MS) {
      StaffAuthService.failedAttempts.delete(key);
      return { throttled: false, retryAfterSeconds: 0 };
    }

    if (attempt.count >= MAX_FAILED_LOGIN_ATTEMPTS) {
      const remainingMs = LOGIN_LOCKOUT_WINDOW_MS - (now - attempt.lastAttemptAt);
      const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
      return { throttled: true, retryAfterSeconds };
    }

    return { throttled: false, retryAfterSeconds: 0 };
  }

  recordFailedAttempt(key: string): void {
    const now = Date.now();
    const existing = StaffAuthService.failedAttempts.get(key);

    if (!existing || now - existing.firstAttemptAt > LOGIN_LOCKOUT_WINDOW_MS) {
      StaffAuthService.failedAttempts.set(key, {
        count: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      });
      return;
    }

    existing.count += 1;
    existing.lastAttemptAt = now;
  }

  resetFailedAttempts(key: string): void {
    StaffAuthService.failedAttempts.delete(key);
  }

  static clearAllThrottleRecords(): void {
    StaffAuthService.failedAttempts.clear();
  }

  // --------------------------------------------------------------------------
  // Session Token Creation & Cryptography (HMAC-SHA256)
  // --------------------------------------------------------------------------
  private computeHmac(data: string): string {
    return createHmac("sha256", this.secret).update(data).digest("base64url");
  }

  /**
   * Computes a deterministic SHA-256 hash of the raw session token for PostgreSQL storage & lookup.
   */
  static hashRawToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  generateSessionToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = StaffAuthService.hashRawToken(rawToken);
    return { rawToken, tokenHash };
  }

  signStaffSession(
    user: { id: string; email: string; name: string; role: UserRole },
    expiresInMs?: number,
    rawTokenInput?: string
  ): string {
    const rawToken = rawTokenInput || randomBytes(32).toString("base64url");
    const now = Date.now();
    const expiresAt = now + (expiresInMs ?? DEFAULT_STAFF_SESSION_DURATION_MS);

    const payload: StaffSessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      rawToken,
      createdAt: now,
      expiresAt,
    };

    const serializedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.computeHmac(serializedPayload);

    return `${serializedPayload}.${signature}`;
  }

  /**
   * Cryptographically validates HMAC-SHA256 signature, expiry, and JSON structure.
   * Rejects forged or tampered tokens before any database query is executed.
   */
  verifySessionToken(tokenString: string | undefined): StaffSessionPayload {
    if (!tokenString || typeof tokenString !== "string") {
      throw new StaffSessionInvalidError("Missing or empty staff session token");
    }

    const parts = tokenString.split(".");
    if (parts.length !== 2) {
      throw new StaffSessionInvalidError("Malformed staff session token format");
    }

    const [serializedPayload, signature] = parts;
    const expectedSignature = this.computeHmac(serializedPayload);

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new StaffSessionInvalidError("Invalid session token signature");
    }

    let payload: StaffSessionPayload;
    try {
      payload = JSON.parse(Buffer.from(serializedPayload, "base64url").toString("utf-8"));
    } catch {
      throw new StaffSessionInvalidError("Corrupted session payload");
    }

    if (!payload.userId || !payload.email || !payload.role || !payload.expiresAt || !payload.rawToken) {
      throw new StaffSessionInvalidError("Incomplete session payload");
    }

    if (Date.now() > payload.expiresAt) {
      throw new StaffSessionExpiredError();
    }

    return payload;
  }

  // --------------------------------------------------------------------------
  // Persistent PostgreSQL Session Lifecycle & Revocation
  // --------------------------------------------------------------------------

  /**
   * Authenticates staff credentials, persists the session record in PostgreSQL, and returns a signed cookie token.
   */
  async authenticateStaff(
    params: { email: string; password: string },
    ip?: string | null
  ): Promise<{ token: string; user: SanitizedStaffUser }> {
    const throttleKey = StaffAuthService.getThrottleKey(params.email, ip);
    const throttleStatus = this.isThrottled(throttleKey);

    if (throttleStatus.throttled) {
      throw new StaffAuthThrottledError(throttleStatus.retryAfterSeconds);
    }

    const user = await this.db.user.findUnique({
      where: { email: params.email.trim().toLowerCase() },
    });

    if (!user) {
      this.recordFailedAttempt(throttleKey);
      throw new StaffAuthInvalidCredentialsError();
    }

    // Role check: Only staff roles may log into the staff portal
    if (!ALLOWED_STAFF_ROLES.includes(user.role)) {
      this.recordFailedAttempt(throttleKey);
      throw new StaffSessionForbiddenError("Account is not authorized for staff access");
    }

    const isValidPassword = await this.verifyPassword(params.password, user.passwordHash);
    if (!isValidPassword) {
      this.recordFailedAttempt(throttleKey);
      throw new StaffAuthInvalidCredentialsError();
    }

    // Authentication successful: reset throttling
    this.resetFailedAttempts(throttleKey);

    const sanitizedUser: SanitizedStaffUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Generate cryptographic tokens
    const { rawToken, tokenHash } = this.generateSessionToken();
    const durationMs = DEFAULT_STAFF_SESSION_DURATION_MS;
    const expiresAt = new Date(Date.now() + durationMs);

    // Persist session record in PostgreSQL (SHA-256 hash only, NEVER the rawToken)
    await this.db.staffSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // The cookie payload contains rawToken, NEVER tokenHash
    const token = this.signStaffSession(sanitizedUser, durationMs, rawToken);

    return { token, user: sanitizedUser };
  }

  /**
   * Cryptographically verifies HMAC signature, hashes rawToken with SHA-256,
   * queries persisted PostgreSQL session by tokenHash, checks revocation status (revokedAt),
   * checks expiry, and revalidates active DB user role.
   */
  async verifySessionAndFetchUser(tokenString: string | undefined): Promise<ValidatedStaffSession> {
    // 1. Verify HMAC signature & token structure first (tampered tokens reject before DB query)
    const payload = this.verifySessionToken(tokenString);

    // 2. Hash rawToken with SHA-256 to look up session in PostgreSQL
    const tokenHash = StaffAuthService.hashRawToken(payload.rawToken);

    // 3. Fetch persisted session record from PostgreSQL
    const persistedSession = await this.db.staffSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!persistedSession) {
      throw new StaffSessionInvalidError("Staff session not found in database or has been purged");
    }

    // Check server-side revocation in PostgreSQL
    if (persistedSession.revokedAt !== null) {
      throw new StaffSessionRevokedError("Staff session has been revoked or logged out");
    }

    // Check PostgreSQL database expiration timestamp
    if (new Date() > persistedSession.expiresAt) {
      throw new StaffSessionExpiredError("Staff session has expired");
    }

    const dbUser = persistedSession.user;
    if (!dbUser) {
      throw new StaffSessionInvalidError("User account associated with session no longer exists");
    }

    // Enforce live role check: must still be an authorized staff role
    if (!ALLOWED_STAFF_ROLES.includes(dbUser.role)) {
      throw new StaffSessionForbiddenError("Live account role is not authorized for staff access");
    }

    // Role synchronization: assert that live database role matches token's claimed role
    if (dbUser.role !== payload.role) {
      throw new StaffSessionForbiddenError("Session role claims mismatch live database role");
    }

    return {
      payload,
      user: dbUser,
    };
  }

  /**
   * Persistently revokes a session in PostgreSQL by recording revokedAt timestamp.
   * Cryptographically verifies HMAC signature, extracts rawToken, hashes it with SHA-256,
   * and updates the corresponding PostgreSQL record.
   * Throws database errors so callers can handle DB failures honestly.
   */
  async revokeSession(tokenString: string | undefined): Promise<boolean> {
    if (!tokenString || typeof tokenString !== "string") return false;
    const parts = tokenString.split(".");
    if (parts.length !== 2) return false;

    // 1. Verify HMAC signature first
    const [serializedPayload, signature] = parts;
    const expectedSignature = this.computeHmac(serializedPayload);
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return false;
    }

    // 2. Extract payload and rawToken
    let payload: StaffSessionPayload;
    try {
      payload = JSON.parse(Buffer.from(serializedPayload, "base64url").toString("utf-8"));
    } catch {
      return false;
    }
    if (!payload.rawToken) return false;

    // 3. Hash rawToken to locate the PostgreSQL session record
    const tokenHash = StaffAuthService.hashRawToken(payload.rawToken);

    // 4. Execute database update. If PostgreSQL throws, allow error to bubble up
    // so caller knows server-side revocation failed.
    const result = await this.db.staffSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count > 0;
  }

  // --------------------------------------------------------------------------
  // Cookie Configuration Helper
  // --------------------------------------------------------------------------
  static getCookieOptions(isProduction = process.env.NODE_ENV === "production") {
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/",
      maxAge: Math.floor(DEFAULT_STAFF_SESSION_DURATION_MS / 1000), // in seconds
    };
  }
}

export const staffAuthService = new StaffAuthService();
