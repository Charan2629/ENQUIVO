import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import { factSheetService } from "@/services/fact-sheet/fact-sheet.service";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * GET /api/fact-sheet/metrics
 * Computes live metrics for the Fact Sheet governance dashboard.
 */
export async function GET(req: NextRequest) {
  try {
    await requireStaffSession(req);

    const metrics = await factSheetService.getFactSheetMetrics();

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
    console.error("GET /api/fact-sheet/metrics error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching fact sheet metrics" },
      { status: 500 }
    );
  }
}
