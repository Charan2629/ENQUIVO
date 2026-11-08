import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import { bookingService } from "@/services/booking/booking.service";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * GET /api/slots/metrics
 * Computes slot metrics for the Slot Calendar view.
 */
export async function GET(req: NextRequest) {
  try {
    await requireStaffSession(req);

    const metrics = await bookingService.getSlotMetrics();

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
    console.error("GET /api/slots/metrics error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching slot metrics" },
      { status: 500 }
    );
  }
}
