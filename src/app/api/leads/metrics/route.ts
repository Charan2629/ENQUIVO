import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import { leadService } from "@/services/lead/lead.service";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * GET /api/leads/metrics
 * Retrieves real database-backed metrics for the lead pipeline dashboard.
 * Scoped by staff role (SALES_HEAD: all leads; SALES_EXEC: assigned leads).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireStaffSession(req);
    const metrics = await leadService.getLeadMetrics(session.user);

    return NextResponse.json({
      success: true,
      data: metrics,
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
    console.error("GET /api/leads/metrics error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching lead metrics" },
      { status: 500 }
    );
  }
}
