import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { verifySameOrigin } from "@/lib/security";
import {
  AIConciergeService,
  AIConversationNotFoundError,
  AISecurityError,
  AITransientError,
  AIRateLimitError,
  AIAuthError,
  AIModelNotFoundError,
  AIError,
} from "@/services/ai/ai.service";
import {
  BuyerSessionService,
  BUYER_SESSION_COOKIE,
  BuyerSessionExpiredError,
  BuyerSessionRevokedError,
  BuyerSessionOptedOutError,
  BuyerSessionTamperingError,
  BuyerSessionError,
} from "@/services/session/buyer-session.service";

const chatPayloadSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Message exceeds 2000 characters"),
  // Optional client parameters: strictly audited against the authenticated session
  conversationId: z.string().optional(),
  leadId: z.string().optional(),
  clientMessageId: z.string().trim().min(1).max(100).optional(),
});

/**
 * Inbound buyer chat endpoint for ENQUIVO AI Concierge.
 * Enforces session authentication via HTTP-only cookie `eq_buyer_session`.
 * Derives conversationId and leadId server-side; rejects client tampering.
 */
export async function POST(req: Request) {
  try {
    // 1. Same-Origin / CSRF validation for state-changing requests
    if (!verifySameOrigin(req)) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }

    // 2. Authenticate session from HTTP-only cookie
    const cookieHeader = req.headers.get("cookie");
    const sessionToken = extractCookie(cookieHeader, BUYER_SESSION_COOKIE);

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Authentication required: No active buyer session. Please initialize a session first." },
        { status: 401 }
      );
    }

    const sessionService = new BuyerSessionService();
    const session = await sessionService.validateSession(sessionToken);

    // 3. Parse and validate request body
    const body = await req.json();
    const validated = chatPayloadSchema.parse(body);

    // 4. Anti-Tampering Check: client must never be able to access another buyer's conversation
    if (validated.conversationId && validated.conversationId !== session.conversation.id) {
      throw new BuyerSessionTamperingError(
        `Client conversationId "${validated.conversationId}" does not match authenticated session "${session.conversation.id}"`
      );
    }

    if (validated.leadId && validated.leadId !== session.lead.id) {
      throw new BuyerSessionTamperingError(
        `Client leadId "${validated.leadId}" does not match authenticated session "${session.lead.id}"`
      );
    }

    // 5. Server-derived identity passed to AIConciergeService
    const aiService = new AIConciergeService();
    const result = await aiService.sendMessage({
      conversationId: session.conversation.id,
      leadId: session.lead.id,
      message: validated.message,
      clientMessageId: validated.clientMessageId,
    });

    return NextResponse.json({
      success: true,
      userMessage: result.userMessage,
      aiMessage: result.aiMessage,
      groundingFactIds: result.groundingFactIds,
      handoffCreated: result.handoffCreated,
      handoff: result.handoff,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof BuyerSessionExpiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (
      error instanceof BuyerSessionRevokedError ||
      error instanceof BuyerSessionOptedOutError ||
      error instanceof BuyerSessionTamperingError ||
      error instanceof AISecurityError
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof BuyerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof AIConversationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof AITransientError) {
      return NextResponse.json(
        { error: error.message, code: "SERVICE_UNAVAILABLE", retryable: true },
        { status: 503 }
      );
    }

    if (error instanceof AIRateLimitError) {
      return NextResponse.json(
        { error: error.message, code: "RATE_LIMITED", retryable: true },
        { status: 429 }
      );
    }

    if (error instanceof AIAuthError) {
      return NextResponse.json(
        {
          error: "The AI Concierge is temporarily unavailable due to a configuration issue. Please connect with our sales team.",
          code: "AUTH_CONFIG_ERROR",
          retryable: false,
        },
        { status: 500 }
      );
    }

    if (error instanceof AIModelNotFoundError) {
      return NextResponse.json(
        {
          error: "The AI Concierge model is currently undergoing maintenance. Please connect with our sales team.",
          code: "MODEL_UNAVAILABLE",
          retryable: false,
        },
        { status: 500 }
      );
    }

    if (error instanceof AIError) {
      return NextResponse.json(
        { error: error.message, code: "AI_ERROR", retryable: false },
        { status: 500 }
      );
    }

    console.error("Unhandled chat API error:", error);
    return NextResponse.json(
      { error: "We encountered an unexpected error communicating with the AI Concierge. Please try again or connect with our sales team." },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================
function extractCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.substring(name.length + 1) : undefined;
}
