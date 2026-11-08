import { NextRequest, NextResponse } from "next/server";
import { requireSalesHead } from "@/lib/auth-guard";
import {
  factSheetService,
  FactSheetNotFoundError,
  FactSheetForbiddenError,
} from "@/services/fact-sheet/fact-sheet.service";
import { verifyFactSheetSchema } from "@/lib/validations/fact-sheet";
import { verifySameOrigin } from "@/lib/security";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * POST /api/fact-sheet/[id]/verify
 * Approves (VERIFY) or rejects (REJECT) a fact sheet entry.
 * Restricted to SALES_HEAD.
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

    const validation = verifyFactSheetSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await factSheetService.verifyFactSheet(
      id,
      validation.data.action,
      session.user
    );

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
    console.error("POST /api/fact-sheet/[id]/verify error:", error);
    return NextResponse.json(
      { error: "Internal server error verifying fact sheet" },
      { status: 500 }
    );
  }
}
