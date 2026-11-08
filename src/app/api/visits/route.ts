import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import {
  bookingService,
  BookingConflictError,
} from "@/services/booking/booking.service";
import { visitQuerySchema } from "@/lib/validations/booking";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * GET /api/visits
 * Retrieves a paginated list of site visits with server-side role scoping,
 * multi-field filtering, search, and attendance status.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireStaffSession(req);

    const searchParams = req.nextUrl.searchParams;
    const rawQuery: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      if (value !== undefined && value !== "") {
        rawQuery[key] = value;
      }
    }

    const queryResult = visitQuerySchema.safeParse(rawQuery);
    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: queryResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await bookingService.getVisits(queryResult.data, session.user);

    return NextResponse.json({
      success: true,
      data: result.visits,
      pagination: result.pagination,
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
    if (error instanceof BookingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("GET /api/visits error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching visits" },
      { status: 500 }
    );
  }
}
