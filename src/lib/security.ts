/**
 * Standardized Cross-Site Request Forgery (CSRF) & Same-Origin Verification.
 * Enforces browser security headers across all state-changing API endpoints.
 */
export function verifySameOrigin(req: Request): boolean {
  // 1. Check browser-enforced Sec-Fetch-Site header
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return false;
  }

  // 2. Check Origin header
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");

  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return false;
      }
    } catch {
      return false;
    }
  }

  // 3. Check Referer header if Origin is absent
  if (!origin && host) {
    const referer = req.headers.get("referer");
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host !== host) {
          return false;
        }
      } catch {
        return false;
      }
    }
  }

  return true;
}

