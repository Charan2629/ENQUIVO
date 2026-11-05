import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const testConnectionString = process.env.TEST_DATABASE_URL;

if (!testConnectionString || typeof testConnectionString !== "string" || testConnectionString.trim() === "") {
  throw new Error("TEST_DATABASE_URL is missing or empty in .env.local");
}

let parsedUrl: URL;
try {
  parsedUrl = new URL(testConnectionString);
} catch {
  throw new Error("TEST_DATABASE_URL is not a valid URL");
}

if (parsedUrl.hostname.includes("ep-frosty-tooth-b3446kf8")) {
  throw new Error(
    "CRITICAL SAFETY ABORT: TEST_DATABASE_URL must not point to the original endpoint ep-frosty-tooth-b3446kf8"
  );
}

if (!parsedUrl.hostname.includes("ep-mute-butterfly-b3a54tpa")) {
  throw new Error(
    `CRITICAL SAFETY ABORT: TEST_DATABASE_URL must contain test endpoint ep-mute-butterfly-b3a54tpa, got ${parsedUrl.hostname}`
  );
}

const adapter = new PrismaPg({ connectionString: testConnectionString });

export const testPrisma = new PrismaClient({
  adapter,
  log: ["error"],
});

export async function disconnectTestPrisma(): Promise<void> {
  await testPrisma.$disconnect();
}
