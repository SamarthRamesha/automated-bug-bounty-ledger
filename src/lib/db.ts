import { createPgAdapter } from "@/lib/postgres";
import { PrismaClient } from "@/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: createPgAdapter(url) });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
