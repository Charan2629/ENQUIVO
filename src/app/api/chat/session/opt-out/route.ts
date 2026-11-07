import { NextResponse } from "next/server";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { verifySameOrigin } from "@/lib/security";
import {
  BuyerSessionService,
  BUYER_SESSION_COOKIE,
  BuyerSessionError,
} from "@/services/session/buyer-session.service";

/**
 * POST /api/chat/session/opt-out
 * Exercises DPDP Act 2023 right to withdraw consent:
 * 1. Authenticates session via HTTP-only cookie.
 * 2. Marks ConsentRecord as opted-out (`optedOut: true`, `optOutAt: now`).
 * 3. Immediately revokes and ends active conversation.
 * 4. Clears session cookie.
 */
export async function POST(req: Request) {
  try {
    if (!verifySameOrigin(req)) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }

    const cookieHeader = req.headers.get("cookie");
    const sessionToken = extractCookie(cookieHeader, BUYER_SESSION_COOKIE);

    if (!sessionToken) {
      return NextResponse.json({ error: "Active session required to opt out" }, { status: 401 });
    }

    const sessionService = new BuyerSessionService(defaultPrisma);
    const session = await sessionService.validateSession(sessionToken);

    await sessionService.optOutSession(session.lead.id, session.conversation.id);

    const response = NextResponse.json({
      success: true,
      message:
        "Your consent has been successfully withdrawn. You have been opted out of further communications per the DPDP Act 2023.",
    });

    // Clear session cookie
    response.cookies.set(BUYER_SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    if (error instanceof BuyerSessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to process opt-out";
    return NextResponse.json({ error: message }, { status: 500 });
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
