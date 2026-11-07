import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LoginRequestSchema } from "@/lib/validations/auth";
import {
  staffAuthService,
  STAFF_SESSION_COOKIE,
  StaffAuthInvalidCredentialsError,
  StaffAuthThrottledError,
  StaffSessionForbiddenError,
  StaffAuthService,
} from "@/services/auth/staff-auth.service";
import { verifySameOrigin } from "@/lib/security";

export async function POST(req: NextRequest) {
  // 1. Enforce Same-Origin CSRF protection
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Forbidden: Cross-site request rejected" },
      { status: 403 }
    );
  }

  // 2. Validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON body" },
      { status: 400 }
    );
  }

  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  // 3. Extract client IP for throttling
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip");

  // 4. Authenticate staff member
  try {
    const { token, user } = await staffAuthService.authenticateStaff({ email, password }, ip);

    // 5. Set secure HTTP-only cookie
    const cookieStore = await cookies();
    const cookieOpts = StaffAuthService.getCookieOptions();

    cookieStore.set(STAFF_SESSION_COOKIE, token, cookieOpts);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    if (error instanceof StaffAuthThrottledError) {
      return NextResponse.json(
        {
          error: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": error.retryAfterSeconds.toString(),
          },
        }
      );
    }

    if (error instanceof StaffAuthInvalidCredentialsError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    if (error instanceof StaffSessionForbiddenError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    console.error("Unhandled staff login error:", error);
    return NextResponse.json(
      { error: "An unexpected authentication error occurred" },
      { status: 500 }
    );
  }
}
