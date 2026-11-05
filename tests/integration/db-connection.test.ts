import { describe, it, expect, afterAll } from "vitest";
import { testPrisma, disconnectTestPrisma } from "../helpers/testPrisma";

describe("Neon Isolated Test Database Connection", () => {
  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("connects to the expected neondb database", async () => {
    const result = await testPrisma.$queryRaw<Array<{ db: string }>>`
      SELECT current_database() as db;
    `;
    expect(result).toHaveLength(1);
    expect(result[0].db).toBe("neondb");
  });

  it("verifies public.leads table exists in test branch", async () => {
    const result = await testPrisma.$queryRaw<Array<{ rel: string | null }>>`
      SELECT to_regclass('public.leads')::text as rel;
    `;
    expect(result).toHaveLength(1);
    expect(result[0].rel).toBeTruthy();
  });

  it("verifies public._prisma_migrations table exists in test branch", async () => {
    const result = await testPrisma.$queryRaw<Array<{ rel: string | null }>>`
      SELECT to_regclass('public._prisma_migrations')::text as rel;
    `;
    expect(result).toHaveLength(1);
    expect(result[0].rel).toBeTruthy();
  });

  it("verifies public.one_active_booking_per_slot partial unique index exists in test branch", async () => {
    const result = await testPrisma.$queryRaw<Array<{ rel: string | null }>>`
      SELECT to_regclass('public.one_active_booking_per_slot')::text as rel;
    `;
    expect(result).toHaveLength(1);
    expect(result[0].rel).toBeTruthy();
  });
});
