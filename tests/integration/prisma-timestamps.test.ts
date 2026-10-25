import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { createPgAdapter } from "@/lib/postgres";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Prisma timestamp consistency",
  () => {
    it("preserves instants for writes, reads, and database defaults across timezones", async () => {
      const { PrismaClient } = await import("@/generated/prisma/client");
      const url = process.env.TEST_DATABASE_URL!;
      const prisma = new PrismaClient({ adapter: createPgAdapter(url) });
      const pool = new Pool({
        connectionString: url,
        options: "-c timezone=Asia/Kolkata",
      });
      const id = randomUUID();
      try {
        const expected = new Date("2026-01-01T12:34:56.789Z");
        await prisma.user.create({
          data: {
            id,
            email: `time-${id}@example.local`,
            displayName: "Timezone regression",
            passwordHash: "test-only",
            createdAt: expected,
          },
        });
        const raw = (
          await pool.query("SELECT created_at FROM users WHERE id=$1", [id])
        ).rows[0];
        expect(raw.created_at.toISOString()).toBe(expected.toISOString());
        expect(
          (
            await prisma.user.findUniqueOrThrow({ where: { id } })
          ).createdAt.toISOString(),
        ).toBe(expected.toISOString());
        const clock = await prisma.$queryRaw<
          { now: Date; zone: string }[]
        >`SELECT now(), current_setting('TimeZone') AS zone`;
        expect(clock[0].zone).toBe("UTC");
        expect(Math.abs(clock[0].now.getTime() - Date.now())).toBeLessThan(
          5000,
        );
      } finally {
        await pool.query("DELETE FROM users WHERE id=$1", [id]);
        await pool.end();
        await prisma.$disconnect();
      }
    });
  },
);
