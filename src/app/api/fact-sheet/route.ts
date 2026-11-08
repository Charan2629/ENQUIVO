import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, requireSalesHead } from "@/lib/auth-guard";
import {
  factSheetService,
  FactSheetForbiddenError,
} from "@/services/fact-sheet/fact-sheet.service";
import {
  createFactSheetSchema,
  factSheetQuerySchema,
} from "@/lib/validations/fact-sheet";
import { verifySameOrigin } from "@/lib/security";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * GET /api/fact-sheet
 * Retrieves a paginated list of fact sheets with filtering and search.
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

    const queryResult = factSheetQuerySchema.safeParse(rawQuery);
    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: queryResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await factSheetService.getFactSheets(queryResult.data, session.user);

    return NextResponse.json({
      success: true,
      data: result.facts,
      pagination: result.pagination,
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
    console.error("GET /api/fact-sheet error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching fact sheets" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fact-sheet
 * Creates a new fact sheet entry. Restricted to SALES_HEAD.
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

    const validation = createFactSheetSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const created = await factSheetService.createFactSheet(
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
    if (error instanceof StaffSessionForbiddenError || error instanceof FactSheetForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("POST /api/fact-sheet error:", error);
    return NextResponse.json(
      { error: "Internal server error creating fact sheet entry" },
      { status: 500 }
    );
  }
}
