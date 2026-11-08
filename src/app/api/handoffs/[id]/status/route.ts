import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import {
  handoffService,
  HandoffNotFoundError,
  HandoffForbiddenError,
} from "@/services/handoff/handoff.service";
import { updateHandoffStatusSchema } from "@/lib/validations/handoff";
import { verifySameOrigin } from "@/lib/security";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * PATCH /api/handoffs/[id]/status
 * Updates the resolution status of a handoff.
 * - SALES_HEAD can update any handoff.
 * - SALES_EXEC can update only handoffs assigned to them.
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

    const session = await requireStaffSession(req);
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid handoff ID" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const validation = updateHandoffStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updated = await handoffService.updateHandoffStatus(
      id,
      validation.data.status,
      session.user
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Handoff status updated to ${validation.data.status}`,
    });
  } catch (error) {
    if ((error as { digest?: string })?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    if (error instanceof StaffSessionInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof StaffSessionForbiddenError || error instanceof HandoffForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof HandoffNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("PATCH /api/handoffs/[id]/status error:", error);
    return NextResponse.json(
      { error: "Internal server error updating handoff status" },
      { status: 500 }
    );
  }
}
