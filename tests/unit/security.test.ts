import { describe, it, expect } from "vitest";
import { verifySameOrigin } from "@/lib/security";

describe("verifySameOrigin Security & CSRF Defense Unit Tests", () => {
  it("allows requests when Origin host matches Host header", () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });

    expect(verifySameOrigin(req)).toBe(true);
  });

  it("allows requests when Origin matches x-forwarded-host behind reverse proxy", () => {
    const req = new Request("https://enquivo.vercel.app/api/chat", {
      method: "POST",
      headers: {
        host: "internal-cluster.local",
        "x-forwarded-host": "enquivo.vercel.app",
        origin: "https://enquivo.vercel.app",
      },
    });

    expect(verifySameOrigin(req)).toBe(true);
  });

  it("blocks cross-site requests with Sec-Fetch-Site: cross-site", () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "sec-fetch-site": "cross-site",
      },
    });

    expect(verifySameOrigin(req)).toBe(false);
  });

  it("blocks requests where Origin host does NOT match Host header (CSRF attack)", () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://malicious-attacker.com",
      },
    });

    expect(verifySameOrigin(req)).toBe(false);
  });

  it("blocks requests where Origin is a malformed URL", () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "not-a-valid-url",
      },
    });

    expect(verifySameOrigin(req)).toBe(false);
  });

  it("falls back to Referer check when Origin header is absent", () => {
    const validRefererReq = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        referer: "http://localhost:3000/concierge",
      },
    });

    expect(verifySameOrigin(validRefererReq)).toBe(true);

    const maliciousRefererReq = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        referer: "https://evil.com/phishing-page",
      },
    });

    expect(verifySameOrigin(maliciousRefererReq)).toBe(false);
  });

  it("permits same-origin requests when Sec-Fetch-Site is same-origin or same-site", () => {
    const reqSameOrigin = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
      },
    });

    expect(verifySameOrigin(reqSameOrigin)).toBe(true);
  });
});

