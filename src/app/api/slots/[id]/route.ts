import { NextRequest, NextResponse } from "next/server";
import { requireSalesHead } from "@/lib/auth-guard";
import {
  bookingService,
  BookingNotFoundError,
  BookingConflictError,
} from "@/services/booking/booking.service";
import { updateSlotSchema } from "@/lib/validations/slot";
import { verifySameOrigin } from "@/lib/security";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * PATCH /api/slots/[id]
 * Updates an appointment slot. Restricted to SALES_HEAD.
 * Slots with an active confirmed booking cannot be modified.
 */
export async function PATCH(
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

    const session = await requireSalesHead(req);
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid slot ID" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const validation = updateSlotSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updated = await bookingService.updateSlot(
      id,
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
    console.error("PATCH /api/slots/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error updating slot" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/slots/[id]
 * Deletes an appointment slot. Restricted to SALES_HEAD.
 * Slots with booking history are preserved.
 */
export async function DELETE(
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

    const session = await requireSalesHead(req);
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid slot ID" }, { status: 400 });
    }

    const result = await bookingService.deleteSlot(id, session.user);

    return NextResponse.json({
      success: true,
      data: result,
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
    console.error("DELETE /api/slots/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error deleting slot" },
      { status: 500 }
    );
  }
}
