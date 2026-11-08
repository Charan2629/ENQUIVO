import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import { bookingService } from "@/services/booking/booking.service";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * GET /api/visits/metrics
 * Computes role-scoped site visit and attendance metrics.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireStaffSession(req);

    const metrics = await bookingService.getVisitMetrics(session.user);

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
    console.error("GET /api/visits/metrics error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching visit metrics" },
      { status: 500 }
    );
  }
}
