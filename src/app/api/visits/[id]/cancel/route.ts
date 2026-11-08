import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import {
  bookingService,
  BookingNotFoundError,
  BookingConflictError,
} from "@/services/booking/booking.service";
import { verifySameOrigin } from "@/lib/security";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * POST /api/visits/[id]/cancel
 * Cancels a site visit and releases its future slot.
 * SALES_HEAD can cancel any visit.
 * SALES_EXEC can only cancel visits of leads assigned to them.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifySameOrigin(req)) {
      return NextResponse.json(
        { error: "Cross-site request forgery detected" },
        { status: 403 }
      );
    }

    const session = await requireStaffSession(req);
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid visit ID" }, { status: 400 });
    }

    const cancelled = await bookingService.cancelVisitByStaff(id, session.user);

    return NextResponse.json({
      success: true,
      data: cancelled,
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
    if (error instanceof BookingNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BookingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("POST /api/visits/[id]/cancel error:", error);
    return NextResponse.json(
      { error: "Internal server error cancelling visit" },
      { status: 500 }
    );
  }
}
