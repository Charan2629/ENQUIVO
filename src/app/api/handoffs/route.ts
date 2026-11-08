import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import { handoffService } from "@/services/handoff/handoff.service";
import { handoffQuerySchema } from "@/lib/validations/handoff";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * GET /api/handoffs
 * Retrieves a paginated list of handoffs with server-side authorization scoping,
 * multi-field filtering, search, and sorting.
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

    const queryResult = handoffQuerySchema.safeParse(rawQuery);
    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: queryResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await handoffService.getHandoffs(queryResult.data, session.user);

    return NextResponse.json({
      success: true,
      data: result.handoffs,
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
    console.error("GET /api/handoffs error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching handoffs" },
      { status: 500 }
    );
  }
}
