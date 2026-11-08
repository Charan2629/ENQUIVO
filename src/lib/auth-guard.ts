import { cookies } from "next/headers";
import { connection } from "next/server";
import { UserRole } from "@prisma/client";
import {
  staffAuthService,
  STAFF_SESSION_COOKIE,
  ValidatedStaffSession,
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

/**
 * Extracts the staff session token from either an explicit Request or Next.js cookies().
 */
export async function getStaffSessionToken(req?: Request): Promise<string | undefined> {
  if (req) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return undefined;
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${STAFF_SESSION_COOKIE}=`));
    return match ? decodeURIComponent(match.substring(STAFF_SESSION_COOKIE.length + 1)) : undefined;
  }

  try {
    const cookieStore = await cookies();
    return cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

/**
 * Retrieves and cryptographically validates the staff session, revalidating the user against PostgreSQL.
 * Returns null if missing or invalid.
 */
export async function getStaffSession(req?: Request): Promise<ValidatedStaffSession | null> {
  if (!req) {
    try {
      await connection();
    } catch {
      // Ignored outside Next.js request contexts (e.g. Vitest unit tests)
    }
  }

  const token = await getStaffSessionToken(req);
  if (!token) return null;

  try {
    return await staffAuthService.verifySessionAndFetchUser(token);
  } catch {
    return null;
  }
}

/**
 * Enforces that a valid staff session exists.
 * Throws StaffSessionInvalidError if unauthenticated.
 */
export async function requireStaffSession(req?: Request): Promise<ValidatedStaffSession> {
  const session = await getStaffSession(req);
  if (!session) {
    throw new StaffSessionInvalidError("Authentication required. Please log in.");
  }
  return session;
}

/**
 * Enforces that a valid staff session exists AND matches one of the permitted roles.
 * Throws StaffSessionForbiddenError if the user's role is not authorized.
 */
export async function requireStaffRole(
  allowedRoles: UserRole[],
  req?: Request
): Promise<ValidatedStaffSession> {
  const session = await requireStaffSession(req);
  if (!allowedRoles.includes(session.user.role)) {
    throw new StaffSessionForbiddenError(
      `Role '${session.user.role}' is not authorized to access this resource.`
    );
  }
  return session;
}

/**
 * Convenience helper: Enforces that the authenticated user is specifically a SALES_HEAD.
 */
export async function requireSalesHead(req?: Request): Promise<ValidatedStaffSession> {
  return requireStaffRole([UserRole.SALES_HEAD], req);
}
