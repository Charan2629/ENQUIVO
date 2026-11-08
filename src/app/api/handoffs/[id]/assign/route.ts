import { NextRequest, NextResponse } from "next/server";
import { requireSalesHead } from "@/lib/auth-guard";
import {
  handoffService,
  HandoffNotFoundError,
  InvalidAssigneeError,
  HandoffForbiddenError,
} from "@/services/handoff/handoff.service";
import { assignHandoffSchema } from "@/lib/validations/handoff";
import { verifySameOrigin } from "@/lib/security";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * PATCH /api/handoffs/[id]/assign
 * Assigns or reassigns an escalation handoff to a designated Sales Executive.
 * Strictly restricted to SALES_HEAD staff accounts.
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
      return NextResponse.json({ error: "Invalid handoff ID" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const validation = assignHandoffSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updated = await handoffService.assignHandoff(
      id,
      validation.data.salesExecId,
      session.user
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Handoff assigned successfully",
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
    if (error instanceof InvalidAssigneeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("PATCH /api/handoffs/[id]/assign error:", error);
    return NextResponse.json(
      { error: "Internal server error updating handoff assignment" },
      { status: 500 }
    );
  }
}
