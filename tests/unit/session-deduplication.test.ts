import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRole } from "@prisma/client";
import {
  getStaffSession,
  requireStaffSession,
  requireStaffRole,
  requireSalesHead,
  runWithRequestSessionScope,
} from "@/lib/auth-guard";
import {
  staffAuthService,
  STAFF_SESSION_COOKIE,
  StaffSessionForbiddenError,
  StaffSessionInvalidError,
} from "@/services/auth/staff-auth.service";

describe("Staff Session Deduplication & Request-Scoped Caching", () => {
  const mockUserHead = {
    id: "usr-sales-head-1",
    email: "sales-head@enquivo.in",
    name: "Aarav Sharma",
    role: UserRole.SALES_HEAD,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserExec = {
    id: "usr-sales-exec-1",
    email: "vikram.mehta@enquivo.in",
    name: "Vikram Mehta",
    role: UserRole.SALES_EXEC,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function createMockRequest(token: string): Request {
    return new Request("http://localhost:3000/dashboard", {
      headers: {
        cookie: `${STAFF_SESSION_COOKIE}=${encodeURIComponent(token)}`,
      },
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("deduplicates session lookups within the same request scope (SSR layout + page pattern)", async () => {
    const token = staffAuthService.signStaffSession(mockUserHead, 60000, "raw-token-1");
    const req = createMockRequest(token);

    let dbCallCount = 0;
    vi.spyOn(staffAuthService, "verifySessionAndFetchUser").mockImplementation(async () => {
      dbCallCount++;
      return {
        payload: {
          userId: mockUserHead.id,
          email: mockUserHead.email,
          name: mockUserHead.name,
          role: mockUserHead.role,
          rawToken: "raw-token-1",
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000,
        },
        user: mockUserHead,
      };
    });

    await runWithRequestSessionScope(async () => {
      // 1. Layout checks session
      const layoutSession = await getStaffSession(req);
      expect(layoutSession).not.toBeNull();
      expect(layoutSession?.user.email).toBe("sales-head@enquivo.in");

      // 2. Nested page enforces session
      const pageSession = await requireStaffSession(req);
      expect(pageSession).not.toBeNull();
      expect(pageSession.user.id).toBe(mockUserHead.id);

      // 3. Nested component checks role
      const headSession = await requireSalesHead(req);
      expect(headSession.user.role).toBe(UserRole.SALES_HEAD);

      // CRITICAL ASSERTION: Across all 3 calls within this request, DB was queried exactly ONCE!
      expect(dbCallCount).toBe(1);
    });
  });

  it("re-evaluates live against the database on separate requests", async () => {
    const token = staffAuthService.signStaffSession(mockUserExec, 60000, "raw-token-2");
    const req = createMockRequest(token);

    let dbCallCount = 0;
    vi.spyOn(staffAuthService, "verifySessionAndFetchUser").mockImplementation(async () => {
      dbCallCount++;
      return {
        payload: {
          userId: mockUserExec.id,
          email: mockUserExec.email,
          name: mockUserExec.name,
          role: mockUserExec.role,
          rawToken: "raw-token-2",
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000,
        },
        user: mockUserExec,
      };
    });

    // Request 1
    await runWithRequestSessionScope(async () => {
      const s1 = await getStaffSession(req);
      expect(s1?.user.email).toBe("vikram.mehta@enquivo.in");
    });
    expect(dbCallCount).toBe(1);

    // Request 2 (Separate request must trigger a fresh live database check)
    await runWithRequestSessionScope(async () => {
      const s2 = await getStaffSession(req);
      expect(s2?.user.email).toBe("vikram.mehta@enquivo.in");
    });
    expect(dbCallCount).toBe(2);
  });

  it("rejects revoked sessions on subsequent requests after logout", async () => {
    const token = staffAuthService.signStaffSession(mockUserHead, 60000, "raw-token-3");
    const req = createMockRequest(token);

    let isRevoked = false;
    vi.spyOn(staffAuthService, "verifySessionAndFetchUser").mockImplementation(async () => {
      if (isRevoked) {
        throw new Error("Staff session has been revoked or logged out");
      }
      return {
        payload: {
          userId: mockUserHead.id,
          email: mockUserHead.email,
          name: mockUserHead.name,
          role: mockUserHead.role,
          rawToken: "raw-token-3",
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000,
        },
        user: mockUserHead,
      };
    });

    // Request 1: Active session
    await runWithRequestSessionScope(async () => {
      const s1 = await getStaffSession(req);
      expect(s1).not.toBeNull();
    });

    // User logs out (simulated DB revocation)
    isRevoked = true;

    // Request 2: Must fail live revalidation
    await runWithRequestSessionScope(async () => {
      const s2 = await getStaffSession(req);
      expect(s2).toBeNull();

      await expect(requireStaffSession(req)).rejects.toThrow(StaffSessionInvalidError);
    });
  });

  it("strictly enforces role boundaries (SALES_HEAD vs SALES_EXEC)", async () => {
    const tokenExec = staffAuthService.signStaffSession(mockUserExec, 60000, "raw-token-4");
    const reqExec = createMockRequest(tokenExec);

    vi.spyOn(staffAuthService, "verifySessionAndFetchUser").mockResolvedValue({
      payload: {
        userId: mockUserExec.id,
        email: mockUserExec.email,
        name: mockUserExec.name,
        role: mockUserExec.role,
        rawToken: "raw-token-4",
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      },
      user: mockUserExec,
    });

    await runWithRequestSessionScope(async () => {
      // Sales Exec can access general staff resources
      const execSession = await requireStaffSession(reqExec);
      expect(execSession.user.role).toBe(UserRole.SALES_EXEC);

      // Sales Exec is forbidden from Sales Head resources (e.g. Fact Sheet Governance)
      await expect(requireSalesHead(reqExec)).rejects.toThrow(StaffSessionForbiddenError);
      await expect(requireStaffRole([UserRole.SALES_HEAD], reqExec)).rejects.toThrow(
        StaffSessionForbiddenError
      );
    });
  });
});

