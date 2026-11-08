import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth-guard";
import {
  sourceAnalyticsService,
  UnauthorizedAnalyticsAccessError,
} from "@/services/analytics/source-analytics.service";
import { sourceAnalyticsQuerySchema } from "@/lib/validations/analytics";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * GET /api/sources/analytics
 * Retrieves marketing source attribution, lead-to-visit conversion rates,
 * spend efficiency (CPL/CPV), and first response time metrics.
 *
 * Scoping:
 * - SALES_HEAD: Full organization-wide lead visibility and marketing spend metrics.
 * - SALES_EXEC: Relational lead scoping to assigned leads; marketing spend figures restricted.
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

    const queryResult = sourceAnalyticsQuerySchema.safeParse(rawQuery);
    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: "Invalid analytics query parameters",
          details: queryResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await sourceAnalyticsService.getSourceAnalytics(
      queryResult.data,
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
    if (
      error instanceof StaffSessionForbiddenError ||
      error instanceof UnauthorizedAnalyticsAccessError
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("[Source Analytics API] Error generating analytics:", error);
    return NextResponse.json(
      { error: "Internal server error generating source analytics" },
      { status: 500 }
    );
  }
}
