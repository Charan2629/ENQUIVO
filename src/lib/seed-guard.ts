/**
 * src/lib/seed-guard.ts
 *
 * Strict safety guards for the database seed script.
 * Enforces that destructive seeding:
 * 1. Is never permitted in production (NODE_ENV=production).
 * 2. Requires explicit authorization (ALLOW_DESTRUCTIVE_SEED=true).
 * 3. Can ONLY target explicitly approved development database endpoints.
 *    Rejects unknown hostnames, test databases, and malformed URLs by default.
 */

export const APPROVED_SEED_ENDPOINTS = [
  "ep-frosty-tooth-b3446kf8.c-4.ap-southeast-1.aws.neon.tech",
  "ep-frosty-tooth-b3446kf8-pooler.c-4.ap-southeast-1.aws.neon.tech",
] as const;

export interface SeedGuardParams {
  nodeEnv?: string;
  allowDestructiveSeed?: string;
  databaseUrl?: string;
  directUrl?: string;
  isDestructive?: boolean;
}

export interface SeedGuardResult {
  allowed: boolean;
  targetHost: string | null;
  reason?: string;
}

/**
 * Validates whether the environment and database connection URL satisfy all safety criteria
 * for executing the destructive database seed protocol.
 *
 * Pure function with zero side effects: safe to test without database connections or process.exit.
 *
 * Must return allowed: true ONLY when ALL of the following are true:
 * - nodeEnv !== "production"
 * - allowDestructiveSeed === "true"
 * - Target database URL exists and parses to a valid URL
 * - Target hostname matches an explicitly approved development endpoint in APPROVED_SEED_ENDPOINTS
 */
export function validateSeedTarget(params: SeedGuardParams): SeedGuardResult {
  // 1. Strict production block: production is blocked regardless of flags
  if (params.nodeEnv === "production") {
    return {
      allowed: false,
      targetHost: null,
      reason:
        "Destructive database seeding is strictly prohibited in production environment (NODE_ENV=production).",
    };
  }

  // 2. Explicit authorization flag check (required for destructive seed)
  const isDestructive = params.isDestructive ?? true;
  if (isDestructive && params.allowDestructiveSeed !== "true") {
    return {
      allowed: false,
      targetHost: null,
      reason:
        "Database seed requires explicit authorization. Set ALLOW_DESTRUCTIVE_SEED=true in your environment to authorize wiping and reseeding the database.",
    };
  }

  // 3. Resolve connection URL (consistent with src/lib/prisma.ts precedence)
  const connectionUrl = params.databaseUrl || params.directUrl;
  if (
    !connectionUrl ||
    typeof connectionUrl !== "string" ||
    connectionUrl.trim() === ""
  ) {
    return {
      allowed: false,
      targetHost: null,
      reason:
        "Database connection URL (DATABASE_URL or DIRECT_URL) is missing or empty.",
    };
  }

  // 4. Parse hostname safely
  let parsedHost: string;
  try {
    const parsed = new URL(connectionUrl);
    parsedHost = parsed.hostname.toLowerCase();
    if (!parsedHost) {
      return {
        allowed: false,
        targetHost: null,
        reason: "Database connection URL does not contain a valid hostname.",
      };
    }
  } catch {
    return {
      allowed: false,
      targetHost: null,
      reason: "Database connection URL is malformed and cannot be parsed.",
    };
  }

  // 5. Strict allowlist validation: reject every unknown endpoint by default
  const isApproved = APPROVED_SEED_ENDPOINTS.some(
    (approved) => parsedHost === approved.toLowerCase()
  );

  if (!isApproved) {
    return {
      allowed: false,
      targetHost: parsedHost,
      reason: `Target database endpoint '${parsedHost}' is not in the approved development allowlist. Seeding is strictly forbidden on unapproved or test databases.`,
    };
  }

  return {
    allowed: true,
    targetHost: parsedHost,
  };
}

/**
 * Asserts seed safety guards or terminates process with exit code 1.
 * Logs only the sanitized target hostname, never credentials.
 */
export function assertSeedSafety(
  params: SeedGuardParams = {
    nodeEnv: process.env.NODE_ENV,
    allowDestructiveSeed: process.env.ALLOW_DESTRUCTIVE_SEED,
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  },
  options: { isDestructive?: boolean } = {}
): string {
  const isDestructive = options.isDestructive ?? (params.isDestructive ?? true);
  const result = validateSeedTarget({ ...params, isDestructive });

  if (!result.allowed) {
    console.error(`🛑 FATAL SEED SAFETY ERROR: ${result.reason}`);
    process.exit(1);
  }

  if (isDestructive) {
    console.log(
      "🔒 Safety guards passed: Development environment and ALLOW_DESTRUCTIVE_SEED=true confirmed."
    );
  } else {
    console.log(
      "🔒 Safety guards passed: Non-destructive seed mode on approved development endpoint."
    );
  }
  console.log(`🎯 Verified approved development endpoint: ${result.targetHost}`);
  return result.targetHost!;
}
