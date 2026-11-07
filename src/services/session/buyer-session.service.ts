import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaClient, Conversation, Lead, ConsentRecord } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

// ============================================================================
// Session Errors
// ============================================================================
export class BuyerSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuyerSessionError";
  }
}

export class BuyerSessionInvalidError extends BuyerSessionError {
  constructor(message = "Invalid buyer session token") {
    super(message);
    this.name = "BuyerSessionInvalidError";
  }
}

export class BuyerSessionExpiredError extends BuyerSessionError {
  constructor(message = "Buyer session has expired") {
    super(message);
    this.name = "BuyerSessionExpiredError";
  }
}

export class BuyerSessionNotFoundError extends BuyerSessionError {
  constructor(message = "Conversation associated with session not found") {
    super(message);
    this.name = "BuyerSessionNotFoundError";
  }
}

export class BuyerSessionRevokedError extends BuyerSessionError {
  constructor(message = "Buyer session has been ended or revoked") {
    super(message);
    this.name = "BuyerSessionRevokedError";
  }
}

export class BuyerSessionOptedOutError extends BuyerSessionError {
  constructor(message = "Buyer has opted out of communication per DPDP Act 2023") {
    super(message);
    this.name = "BuyerSessionOptedOutError";
  }
}

export class BuyerSessionTamperingError extends BuyerSessionError {
  constructor(message = "Security alert: Client-supplied IDs do not match authenticated session") {
    super(message);
    this.name = "BuyerSessionTamperingError";
  }
}

// ============================================================================
// Types
// ============================================================================
export interface BuyerSessionPayload {
  sessionId: string;
  conversationId: string;
  leadId: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
}

export interface ValidatedBuyerSession {
  payload: BuyerSessionPayload;
  conversation: Conversation;
  lead: Lead & { consentRecord: ConsentRecord | null };
}

export const BUYER_SESSION_COOKIE = "eq_buyer_session";
export const DEFAULT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// BuyerSessionService
// ============================================================================
export class BuyerSessionService {
  private secret: string;

  constructor(
    private db: PrismaClient = defaultPrisma,
    secret?: string
  ) {
    this.secret =
      secret ||
      process.env.AUTH_SECRET ||
      process.env.SESSION_SECRET ||
      "enquivo-default-development-secret-change-in-production-32-chars";
  }

  /**
   * Generates a cryptographically secure 256-bit random session token and its SHA-256 hash.
   */
  generateSessionToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(rawToken);
    return { rawToken, tokenHash };
  }

  /**
   * Computes a deterministic SHA-256 hash of a raw token.
   */
  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /**
   * Signs a buyer session payload with HMAC-SHA256 into a tamper-evident cookie string.
   */
  signSession(params: {
    conversationId: string;
    leadId: string;
    rawToken?: string;
    expiresInMs?: number;
  }): string {
    const { rawToken, tokenHash } = params.rawToken
      ? { rawToken: params.rawToken, tokenHash: this.hashToken(params.rawToken) }
      : this.generateSessionToken();

    const now = Date.now();
    const expiresAt = now + (params.expiresInMs ?? DEFAULT_SESSION_DURATION_MS);

    const payload: BuyerSessionPayload = {
      sessionId: rawToken,
      conversationId: params.conversationId,
      leadId: params.leadId,
      tokenHash,
      createdAt: now,
      expiresAt,
    };

    const serializedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.computeHmac(serializedPayload);

    return `${serializedPayload}.${signature}`;
  }

  /**
   * Verifies the cryptographic signature and expiration of a session token string without database lookup.
   */
  verifySessionToken(tokenString: string | undefined): BuyerSessionPayload {
    if (!tokenString || typeof tokenString !== "string") {
      throw new BuyerSessionInvalidError("Missing or empty session token");
    }

    const parts = tokenString.split(".");
    if (parts.length !== 2) {
      throw new BuyerSessionInvalidError("Malformed session token format");
    }

    const [serializedPayload, signature] = parts;
    const expectedSignature = this.computeHmac(serializedPayload);

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      throw new BuyerSessionInvalidError("Session signature verification failed");
    }

    let payload: BuyerSessionPayload;
    try {
      const decoded = Buffer.from(serializedPayload, "base64url").toString("utf-8");
      payload = JSON.parse(decoded) as BuyerSessionPayload;
    } catch {
      throw new BuyerSessionInvalidError("Failed to parse session payload");
    }

    if (!payload.conversationId || !payload.leadId || !payload.expiresAt) {
      throw new BuyerSessionInvalidError("Incomplete session payload");
    }

    if (Date.now() > payload.expiresAt) {
      throw new BuyerSessionExpiredError("Session has expired");
    }

    return payload;
  }

  /**
   * Full server-side session validation:
   * 1. Cryptographically verifies token format and expiration.
   * 2. Confirms conversation existence in PostgreSQL.
   * 3. Confirms conversation-lead binding.
   * 4. Confirms conversation has not been ended or revoked.
   * 5. Confirms lead has not opted out per DPDP Act 2023.
   */
  async validateSession(tokenString: string | undefined): Promise<ValidatedBuyerSession> {
    const payload = this.verifySessionToken(tokenString);

    const conversation = await this.db.conversation.findUnique({
      where: { id: payload.conversationId },
      include: {
        lead: {
          include: {
            consentRecord: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new BuyerSessionNotFoundError(
        `Conversation ${payload.conversationId} bound to session does not exist`
      );
    }

    if (conversation.leadId !== payload.leadId) {
      throw new BuyerSessionTamperingError(
        `Session binding mismatch: conversation ${payload.conversationId} belongs to ${conversation.leadId}, not ${payload.leadId}`
      );
    }

    if (conversation.endedAt !== null) {
      throw new BuyerSessionRevokedError(
        `Conversation ${payload.conversationId} was ended at ${conversation.endedAt.toISOString()}`
      );
    }

    if (conversation.lead.consentRecord?.optedOut) {
      throw new BuyerSessionOptedOutError(
        `Buyer ${conversation.leadId} has exercised their DPDP right to opt out`
      );
    }

    return {
      payload,
      conversation,
      lead: conversation.lead,
    };
  }

  /**
   * Revokes an active buyer session by ending its associated conversation in PostgreSQL.
   */
  async revokeSession(conversationId: string): Promise<void> {
    await this.db.conversation.updateMany({
      where: { id: conversationId, endedAt: null },
      data: { endedAt: new Date() },
    });
  }

  /**
   * Processes a buyer DPDP opt-out: marks ConsentRecord as opted-out and revokes active conversation.
   */
  async optOutSession(leadId: string, conversationId: string): Promise<void> {
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      // 1. Mark consent record as opted out
      await tx.consentRecord.updateMany({
        where: { leadId },
        data: {
          optedOut: true,
          optOutAt: now,
        },
      });

      // 2. End active conversation
      await tx.conversation.updateMany({
        where: { id: conversationId, endedAt: null },
        data: { endedAt: now },
      });
    });
  }

  /**
   * Returns security-hardened HTTP-only cookie configuration.
   */
  getCookieOptions(expiresInMs = DEFAULT_SESSION_DURATION_MS) {
    const isProduction = process.env.NODE_ENV === "production";
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/",
      maxAge: Math.floor(expiresInMs / 1000),
    };
  }

  /**
   * Helper computing HMAC-SHA256 signature in base64url.
   */
  private computeHmac(data: string): string {
    return createHmac("sha256", this.secret).update(data).digest("base64url");
  }
}
