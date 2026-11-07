import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  try {
    const session = await getStaffSession(req);

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: session.user,
    });
  } catch (error) {
    if ((error as { digest?: string })?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    console.error("Staff session verification error:", error);
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }
}
