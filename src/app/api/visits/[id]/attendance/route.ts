import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import {
  bookingService,
  BookingNotFoundError,
  BookingConflictError,
} from "@/services/booking/booking.service";
import { recordAttendanceSchema } from "@/lib/validations/booking";
import { verifySameOrigin } from "@/lib/security";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * POST /api/visits/[id]/attendance
 * Records the attendance outcome (ATTENDED or NO_SHOW) for a site visit.
 * SALES_HEAD can record attendance for any visit.
 * SALES_EXEC can only record attendance for visits of leads assigned to them.
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const rawInput = typeof body === "object" && body !== null ? { ...(body as object), visitId: id } : { visitId: id };
    const validation = recordAttendanceSchema.safeParse(rawInput);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updated = await bookingService.recordAttendance(
      validation.data,
      session.user
    );

    return NextResponse.json({
      success: true,
      data: updated,
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
    console.error("POST /api/visits/[id]/attendance error:", error);
    return NextResponse.json(
      { error: "Internal server error recording attendance" },
      { status: 500 }
    );
  }
}
