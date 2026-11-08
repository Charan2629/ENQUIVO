import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import { handoffService } from "@/services/handoff/handoff.service";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * GET /api/handoffs/[id]
 * Retrieves single handoff detail including full conversation history and lead profile.
 * Applies strict anti-IDOR server-side scoping: returns 404 if the handoff does not exist
 * or if a SALES_EXEC attempts to access another executive's handoff.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireStaffSession(req);
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid handoff ID" }, { status: 400 });
    }

    const handoff = await handoffService.getHandoffDetail(id, session.user);

    if (!handoff) {
      return NextResponse.json(
        { error: "Handoff not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: handoff,
    });
  } catch (error) {
    if ((error as { digest?: string })?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    if (error instanceof StaffSessionInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof StaffSessionForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("GET /api/handoffs/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching handoff detail" },
      { status: 500 }
    );
  }
}
