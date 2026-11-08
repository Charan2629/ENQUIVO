/**
 * tests/unit/seed-guard.test.ts
 *
 * Unit tests for the database seed safety guard (src/lib/seed-guard.ts).
 * Validates endpoint allowlisting, production blocking, and authorization guards
 * without executing any database operations or destructive SQL.
 */

import { describe, it, expect } from "vitest";
import {
  validateSeedTarget,
  APPROVED_SEED_ENDPOINTS,
} from "../../src/lib/seed-guard";

describe("Database Seed Safety Guard (validateSeedTarget)", () => {
  const approvedDirectUrl =
    "postgresql://demo_user:demo_pass@ep-frosty-tooth-b3446kf8.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  const approvedPooledUrl =
    "postgresql://demo_user:demo_pass@ep-frosty-tooth-b3446kf8-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  const integrationTestUrl =
    "postgresql://test_user:test_pass@ep-mute-butterfly-b3a54tpa-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  const unknownProdUrl =
    "postgresql://prod_user:prod_pass@ep-unknown-prod-12345.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  const localhostUrl =
    "postgresql://postgres:password@localhost:5432/enquivo?sslmode=disable";

  describe("1. Approved Development Endpoint + Required Flag", () => {
    it("allows execution when targeting approved direct development endpoint with required flag", () => {
      const result = validateSeedTarget({
        nodeEnv: "development",
        allowDestructiveSeed: "true",
        databaseUrl: approvedDirectUrl,
      });

      expect(result.allowed).toBe(true);
      expect(result.targetHost).toBe(
        "ep-frosty-tooth-b3446kf8.c-4.ap-southeast-1.aws.neon.tech"
      );
      expect(result.reason).toBeUndefined();
    });

    it("allows execution when targeting approved pooled development endpoint with required flag", () => {
      const result = validateSeedTarget({
        nodeEnv: "development",
        allowDestructiveSeed: "true",
        databaseUrl: approvedPooledUrl,
      });

      expect(result.allowed).toBe(true);
      expect(result.targetHost).toBe(
        "ep-frosty-tooth-b3446kf8-pooler.c-4.ap-southeast-1.aws.neon.tech"
      );
    });

    it("falls back to DIRECT_URL if DATABASE_URL is undefined", () => {
      const result = validateSeedTarget({
        nodeEnv: "development",
        allowDestructiveSeed: "true",
        directUrl: approvedDirectUrl,
      });

      expect(result.allowed).toBe(true);
      expect(result.targetHost).toBe(
        "ep-frosty-tooth-b3446kf8.c-4.ap-southeast-1.aws.neon.tech"
      );
    });
  });

  describe("2. Production Environment Guard", () => {
    it("strictly blocks execution in production even with approved URL and ALLOW_DESTRUCTIVE_SEED=true", () => {
      const result = validateSeedTarget({
        nodeEnv: "production",
        allowDestructiveSeed: "true",
        databaseUrl: approvedDirectUrl,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("strictly prohibited in production");
    });
  });

  describe("3. Missing Destructive Seed Flag Guard", () => {
    it("blocks execution when ALLOW_DESTRUCTIVE_SEED is missing", () => {
      const result = validateSeedTarget({
        nodeEnv: "development",
        databaseUrl: approvedDirectUrl,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("requires explicit authorization");
    });

    it("blocks execution when ALLOW_DESTRUCTIVE_SEED is false", () => {
      const result = validateSeedTarget({
        nodeEnv: "development",
        allowDestructiveSeed: "false",
        databaseUrl: approvedDirectUrl,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("requires explicit authorization");
    });
  });

  describe("4. Integration Test Database Endpoint Guard", () => {
    it("strictly rejects the integration test endpoint (ep-mute-butterfly-b3a54tpa) to protect test data", () => {
      const result = validateSeedTarget({
        nodeEnv: "development",
        allowDestructiveSeed: "true",
        databaseUrl: integrationTestUrl,
      });

      expect(result.allowed).toBe(false);
      expect(result.targetHost).toContain("ep-mute-butterfly-b3a54tpa");
      expect(result.reason).toContain("not in the approved development allowlist");
    });
  });

  describe("5. Unknown Endpoint Guard (Fail Closed)", () => {
    it("strictly rejects unknown external cloud database endpoints", () => {
      const result = validateSeedTarget({
        nodeEnv: "development",
        allowDestructiveSeed: "true",
        databaseUrl: unknownProdUrl,
      });

      expect(result.allowed).toBe(false);
      expect(result.targetHost).toBe(
        "ep-unknown-prod-12345.c-4.ap-southeast-1.aws.neon.tech"
      );
      expect(result.reason).toContain("not in the approved development allowlist");
    });

    it("strictly rejects local database endpoints (localhost / 127.0.0.1)", () => {
      const result = validateSeedTarget({
        nodeEnv: "development",
        allowDestructiveSeed: "true",
        databaseUrl: localhostUrl,
      });

      expect(result.allowed).toBe(false);
      expect(result.targetHost).toBe("localhost");
      expect(result.reason).toContain("not in the approved development allowlist");
    });
  });

  describe("6. Missing or Malformed Database URL Guard", () => {
    it("blocks execution when database URL is missing or empty", () => {
      const result = validateSeedTarget({
        nodeEnv: "development",
        allowDestructiveSeed: "true",
        databaseUrl: "",
        directUrl: "",
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("missing or empty");
    });

    it("blocks execution when database URL is malformed", () => {
      const result = validateSeedTarget({
        nodeEnv: "development",
        allowDestructiveSeed: "true",
        databaseUrl: "not-a-valid-connection-string",
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("malformed");
    });
  });

  describe("7. Allowlist Integrity", () => {
    it("contains exactly the two approved development hostnames", () => {
      expect(APPROVED_SEED_ENDPOINTS).toEqual([
        "ep-frosty-tooth-b3446kf8.c-4.ap-southeast-1.aws.neon.tech",
        "ep-frosty-tooth-b3446kf8-pooler.c-4.ap-southeast-1.aws.neon.tech",
      ]);
    });
  });
});
