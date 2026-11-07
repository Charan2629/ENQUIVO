import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STAFF_SESSION_COOKIE, staffAuthService } from "@/services/auth/staff-auth.service";
import { verifySameOrigin } from "@/lib/security";

export async function POST(req: NextRequest) {
  // 1. Enforce Same-Origin CSRF protection
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Forbidden: Cross-site request rejected" },
      { status: 403 }
    );
  }

  // 2. Revoke session server-side in PostgreSQL to prevent replay attacks
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;

  let serverRevoked = false;
  if (token) {
    try {
      serverRevoked = await staffAuthService.revokeSession(token);
    } catch (dbError) {
      console.error("[Logout] Database error during session revocation:", dbError);
      // Clear the client-side cookie so the user isn't stuck in an un-logoutable state locally,
      // but return an honest 500 error indicating server-side revocation failed in PostgreSQL.
      cookieStore.set(STAFF_SESSION_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });

      return NextResponse.json(
        {
          success: false,
          serverRevoked: false,
          error: "Database error during session revocation; session could not be invalidated on server",
        },
        { status: 500 }
      );
    }
  }

  // 3. Clear staff session cookie
  cookieStore.set(STAFF_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({
    success: true,
    serverRevoked,
    message: "Logged out successfully",
  });
}
