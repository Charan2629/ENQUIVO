import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, requireSalesHead } from "@/lib/auth-guard";
import {
  bookingService,
  BookingConflictError,
} from "@/services/booking/booking.service";
import {
  createSlotSchema,
  slotQuerySchema,
} from "@/lib/validations/slot";
import { verifySameOrigin } from "@/lib/security";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * GET /api/slots
 * Retrieves a list of slots matching filters for the staff portal.
 */
export async function GET(req: NextRequest) {
  try {
    await requireStaffSession(req);

    const searchParams = req.nextUrl.searchParams;
    const rawQuery: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      if (value !== undefined && value !== "") {
        rawQuery[key] = value;
      }
    }

    const queryResult = slotQuerySchema.safeParse(rawQuery);
    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: queryResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const slots = await bookingService.getAllSlots(queryResult.data);

    return NextResponse.json({
      success: true,
      data: slots,
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
    console.error("GET /api/slots error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching slots" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/slots
 * Creates a new appointment slot. Restricted to SALES_HEAD.
 */
export async function POST(req: NextRequest) {
  try {
    if (!verifySameOrigin(req)) {
      return NextResponse.json(
        { error: "Cross-site request forgery detected" },
        { status: 403 }
      );
    }

    const session = await requireSalesHead(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const validation = createSlotSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const created = await bookingService.createSlot(
      validation.data,
      session.user
    );

    return NextResponse.json(
      {
        success: true,
        data: created,
      },
      { status: 201 }
    );
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
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("POST /api/slots error:", error);
    return NextResponse.json(
      { error: "Internal server error creating slot" },
      { status: 500 }
    );
  }
}
