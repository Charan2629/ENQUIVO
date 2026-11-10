import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { ConversationLanguage, LeadSource } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { verifySameOrigin } from "@/lib/security";
import {
  BuyerSessionService,
  BUYER_SESSION_COOKIE,
  BuyerSessionError,
  BuyerSessionExpiredError,
  BuyerSessionRevokedError,
  BuyerSessionOptedOutError,
} from "@/services/session/buyer-session.service";
import { LeadService } from "@/services/lead/lead.service";
import { filterBuyerFacingMessages } from "@/lib/chat-message";
import { normalizePhoneNumber } from "@/lib/validations/lead";

const initSessionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Please enter your full name.")
    .max(100, "Name cannot exceed 100 characters"),
  phone: z
    .string()
    .trim()
    .min(1, "Please enter your mobile phone number.")
    .refine(
      (val) => {
        try {
          normalizePhoneNumber(val);
          return true;
        } catch {
          return false;
        }
      },
      {
        message:
          "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
      }
    ),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address (e.g. name@example.com).")
    .optional()
    .nullable()
    .or(z.literal("")),
  language: z.nativeEnum(ConversationLanguage).default(ConversationLanguage.EN),
  projectId: z.string().trim().min(1).optional().nullable(),
  configuration: z.string().trim().max(50).optional().nullable(),
  consentText: z
    .string()
    .trim()
    .min(10, "Please accept the privacy consent to continue."),
});

/**
 * GET /api/chat/session
 * Verifies active buyer session from HTTP-only cookie and returns existing conversation state & messages.
 */
export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const sessionToken = extractCookie(cookieHeader, BUYER_SESSION_COOKIE);

    if (!sessionToken) {
      return NextResponse.json({ authenticated: false });
    }

    const sessionService = new BuyerSessionService();
    const session = await sessionService.validateSession(sessionToken);

    // Load recent message history for this validated conversation
    const messages = await defaultPrisma.chatMessage.findMany({
      where: { conversationId: session.conversation.id },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        role: true,
        content: true,
        groundingFactIds: true,
        createdAt: true,
      },
    });

    // Check if an existing handoff was created
    const handoff = await defaultPrisma.handoff.findUnique({
      where: { conversationId: session.conversation.id },
      include: {
        assignedTo: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      authenticated: true,
      conversation: {
        id: session.conversation.id,
        language: session.conversation.language,
        startedAt: session.conversation.startedAt,
      },
      lead: {
        name: session.lead.name,
        phone: session.lead.phone ? maskPhone(session.lead.phone) : null,
      },
      handoff: handoff
        ? {
            status: handoff.status,
            escalationReason: handoff.escalationReason,
            summary: handoff.summary,
            assignedToName: handoff.assignedTo?.name ?? "Senior Sales Executive",
          }
        : null,
      messages: filterBuyerFacingMessages(messages),
    });
  } catch (error) {
    if (
      error instanceof BuyerSessionExpiredError ||
      error instanceof BuyerSessionRevokedError ||
      error instanceof BuyerSessionOptedOutError
    ) {
      // Clear invalid/expired cookie on the client
      const response = NextResponse.json({
        authenticated: false,
        reason: error.message,
      });
      response.cookies.set(BUYER_SESSION_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    if (error instanceof BuyerSessionError) {
      return NextResponse.json({ authenticated: false, reason: error.message });
    }

    const message = error instanceof Error ? error.message : "Internal session error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/chat/session
 * Initializes a new guest buyer session:
 * 1. Validates intake fields and explicit DPDP consent.
 * 2. Ingests or merges lead atomically via LeadService (preserving first-touch attribution).
 * 3. Finds or creates an active Conversation.
 * 4. Issues signed session token via HTTP-only cookie.
 */
export async function POST(req: Request) {
  try {
    // CSRF / Same-Origin check for state-changing requests
    if (!verifySameOrigin(req)) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }

    const body = await req.json();
    const validated = initSessionSchema.parse(body);

    const leadService = new LeadService(defaultPrisma);
    const sessionService = new BuyerSessionService(defaultPrisma);

    // Ingest lead with explicit DPDP consent
    const ingestResult = await leadService.ingestLead({
      name: validated.name,
      phone: validated.phone,
      email: validated.email,
      source: LeadSource.WEBSITE,
      projectId: validated.projectId,
      configuration: validated.configuration,
      consent: {
        consentText: validated.consentText,
        affirmed: true,
      },
    });

    const lead = ingestResult.lead;

    // Reject if lead is already in opted-out state
    if (ingestResult.consentRecord?.optedOut) {
      return NextResponse.json(
        {
          error:
            "This contact has previously opted out of communications per DPDP Act 2023. Please contact sales directly to re-subscribe.",
        },
        { status: 403 }
      );
    }

    // Reuse existing active (un-ended) conversation if available, or create new
    let conversation = await defaultPrisma.conversation.findFirst({
      where: {
        leadId: lead.id,
        endedAt: null,
      },
      orderBy: { startedAt: "desc" },
    });

    if (!conversation) {
      conversation = await defaultPrisma.conversation.create({
        data: {
          leadId: lead.id,
          language: validated.language,
          startedAt: new Date(),
        },
      });
    } else if (conversation.language !== validated.language) {
      // Update conversation language if buyer toggled preference
      conversation = await defaultPrisma.conversation.update({
        where: { id: conversation.id },
        data: { language: validated.language },
      });
    }

    // Create signed session token
    const sessionToken = sessionService.signSession({
      conversationId: conversation.id,
      leadId: lead.id,
    });

    const cookieOptions = sessionService.getCookieOptions();

    // Load existing messages if this active conversation was resumed
    const existingMessages = await defaultPrisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        role: true,
        content: true,
        groundingFactIds: true,
        createdAt: true,
      },
    });

    const response = NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        language: conversation.language,
        startedAt: conversation.startedAt,
      },
      lead: {
        name: lead.name,
      },
      messages: filterBuyerFacingMessages(existingMessages),
    });

    // Enforce HTTP-only cookie; raw token is NEVER exposed in the JSON body
    response.cookies.set(BUYER_SESSION_COOKIE, sessionToken, cookieOptions);

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      const field = firstIssue?.path[0]?.toString();
      const message = firstIssue?.message || "Validation failed";
      return NextResponse.json(
        {
          error: message,
          field,
          details: error.issues,
        },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      (error.name === "InvalidPhoneNumberError" ||
        error.message.toLowerCase().includes("phone number"))
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
          field: "phone",
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to initialize buyer session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/chat/session
 * Ends the active conversation and revokes the buyer session cookie.
 */
export async function DELETE(req: Request) {
  try {
    if (!verifySameOrigin(req)) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }

    const cookieHeader = req.headers.get("cookie");
    const sessionToken = extractCookie(cookieHeader, BUYER_SESSION_COOKIE);

    const sessionService = new BuyerSessionService(defaultPrisma);

    if (sessionToken) {
      try {
        const payload = sessionService.verifySessionToken(sessionToken);
        await sessionService.revokeSession(payload.conversationId);
      } catch {
        // Continue to clear cookie even if token was already invalid or expired
      }
    }

    const response = NextResponse.json({
      success: true,
      message: "Conversation ended and session revoked successfully.",
    });

    // Clear cookie
    response.cookies.set(BUYER_SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to end session";
    return NextResponse.json({ error: message }, { status: 500 });
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

function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}
