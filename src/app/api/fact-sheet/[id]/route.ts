import { NextRequest, NextResponse } from "next/server";
import { requireSalesHead } from "@/lib/auth-guard";
import {
  factSheetService,
  FactSheetNotFoundError,
  FactSheetForbiddenError,
} from "@/services/fact-sheet/fact-sheet.service";
import { updateFactSheetSchema } from "@/lib/validations/fact-sheet";
import { verifySameOrigin } from "@/lib/security";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * PATCH /api/fact-sheet/[id]
 * Updates a fact sheet entry. Restricted to SALES_HEAD.
 * Note: If content is modified on a VERIFIED fact, it is automatically demoted to UNVERIFIED.
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
      return NextResponse.json({ error: "Invalid fact sheet ID" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const validation = updateFactSheetSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updated = await factSheetService.updateFactSheet(
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
    if (error instanceof StaffSessionForbiddenError || error instanceof FactSheetForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof FactSheetNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("PATCH /api/fact-sheet/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error updating fact sheet" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fact-sheet/[id]
 * Deletes a fact sheet entry. Restricted to SALES_HEAD.
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
      return NextResponse.json({ error: "Invalid fact sheet ID" }, { status: 400 });
    }

    const result = await factSheetService.deleteFactSheet(id, session.user);

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
    if (error instanceof StaffSessionForbiddenError || error instanceof FactSheetForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof FactSheetNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("DELETE /api/fact-sheet/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error deleting fact sheet" },
      { status: 500 }
    );
  }
}
