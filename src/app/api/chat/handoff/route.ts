import { NextResponse } from "next/server";
import { verifySameOrigin } from "@/lib/security";
import {
  AIConciergeService,
  AIConversationNotFoundError,
  AISecurityError,
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

/**
 * Direct Human Escalation Endpoint.
 * Guarantees that buyers can connect to a sales executive even when
 * the external AI provider is experiencing outages, rate limits, or high demand.
 * Enforces session authentication via HTTP-only cookie `eq_buyer_session`.
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

    // 3. Directly create and assign handoff without calling Gemini
    const aiService = new AIConciergeService();
    const result = await aiService.createManualHandoff({
      conversationId: session.conversation.id,
      leadId: session.lead.id,
    });

    return NextResponse.json({
      success: true,
      handoff: result.handoff,
      aiMessage: result.aiMessage,
      assignedToName: result.assignedToName,
    });
  } catch (error) {
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

    console.error("Unhandled manual handoff error:", error);
    return NextResponse.json(
      { error: "Failed to connect with sales team. Please try again or refresh the page." },
      { status: 500 }
    );
  }
}

function extractCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.substring(name.length + 1) : undefined;
}

