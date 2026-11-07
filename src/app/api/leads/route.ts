import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, requireSalesHead } from "@/lib/auth-guard";
import { leadService } from "@/services/lead/lead.service";
import { leadQuerySchema, ingestLeadSchema } from "@/lib/validations/lead";
import {
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";
import { verifySameOrigin } from "@/lib/security";

/**
 * GET /api/leads
 * Retrieves a paginated list of leads with server-side authorization scoping,
 * multi-field filtering, search, and sorting.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireStaffSession(req);

    // Extract query parameters
    const searchParams = req.nextUrl.searchParams;
    const rawQuery: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      if (value !== undefined && value !== "") {
        rawQuery[key] = value;
      }
    }

    const queryResult = leadQuerySchema.safeParse(rawQuery);
    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: queryResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await leadService.getLeads(queryResult.data, session.user);

    return NextResponse.json({
      success: true,
      data: result.leads,
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
    console.error("GET /api/leads error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching leads" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leads
 * Ingests a new lead manually from the staff portal.
 * Deduplicates by phone, merges conditionally, retains first-touch attribution,
 * and records multi-touch events and DPDP consent.
 */
export async function POST(req: NextRequest) {
  try {
    if (!verifySameOrigin(req)) {
      return NextResponse.json(
        { error: "Cross-site request forgery detected" },
        { status: 403 }
      );
    }

    // Manual lead intake is an administrative privilege reserved for SALES_HEAD in M6.2
    // (Executive assignment workflow is governed in Milestone 6.3)
    await requireSalesHead(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const validation = ingestLeadSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await leadService.ingestLead(validation.data);

    return NextResponse.json(
      {
        success: true,
        data: {
          lead: {
            id: result.lead.id,
            leadCode: result.lead.leadCode,
            name: result.lead.name,
            phone: result.lead.phone,
            email: result.lead.email,
            source: result.lead.source,
            projectId: result.lead.projectId,
            configuration: result.lead.configuration,
            createdAt: result.lead.createdAt,
          },
          isNew: result.isNew,
          sourceEvent: {
            id: result.sourceEvent.id,
            source: result.sourceEvent.source,
            campaign: result.sourceEvent.campaign,
            occurredAt: result.sourceEvent.occurredAt,
          },
          consentRecorded: !!result.consentRecord,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof StaffSessionInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof StaffSessionForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("POST /api/leads error:", error);
    return NextResponse.json(
      { error: "Internal server error ingesting lead" },
      { status: 500 }
    );
  }
}
