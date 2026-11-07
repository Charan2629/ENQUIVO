import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import { leadService } from "@/services/lead/lead.service";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * GET /api/leads/[id]
 * Retrieves comprehensive details for a single lead.
 * Enforces server-side role scoping:
 * - SALES_HEAD: can access any active lead.
 * - SALES_EXEC: can ONLY access leads assigned to them.
 * Returns 404 if the record is missing or unauthorized to prevent IDOR existence probing.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireStaffSession(req);
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const lead = await leadService.getLeadDetail(id, session.user);

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: lead,
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
    console.error("GET /api/leads/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching lead detail" },
      { status: 500 }
    );
  }
}
