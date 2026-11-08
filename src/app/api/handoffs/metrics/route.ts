import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import { handoffService } from "@/services/handoff/handoff.service";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * GET /api/handoffs/metrics
 * Retrieves real database-backed aggregate metrics for the handoffs queue.
 * Scoped by role:
 * - SALES_HEAD: Full queue metrics including executive workload distribution.
 * - SALES_EXEC: Workload metrics scoped to that specific executive.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireStaffSession(req);
    const metrics = await handoffService.getHandoffMetrics(session.user);

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
    console.error("GET /api/handoffs/metrics error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching handoff metrics" },
      { status: 500 }
    );
  }
}
