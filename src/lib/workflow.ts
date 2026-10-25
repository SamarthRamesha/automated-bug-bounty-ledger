import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isAdmin, type Session } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { reportIdSchema } from "@/lib/validation";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export type ReportContext = { params: Promise<{ reportId: string }> };
export async function authenticated(admin = false): Promise<Session> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "UNAUTHORIZED", "Login required.");
  if (admin && !isAdmin(session)) throw new ApiError(403, "FORBIDDEN", "Administrator role required.");
  return session;
}
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, "VALIDATION", result.error.issues.map(i => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
  return result.data;
}
export async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try { value = await request.json(); } catch { throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON."); }
  return parse(schema, value);
}
export async function reportId(context: ReportContext) { return parse(reportIdSchema, (await context.params).reportId); }
export async function visibleReport(id: string, session: Session) {
  const report = await prisma.vulnerabilityReport.findFirst({ where: { id, ...(isAdmin(session) ? {} : { reporterId: session.userId }) } });
  if (!report) throw new ApiError(404, "NOT_FOUND", "Report not found.");
  return report;
}
export async function lockReport(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<{ id: string; status: string }[]>`SELECT id, status FROM vulnerability_reports WHERE id = ${id}::uuid FOR UPDATE`;
  if (!rows.length) throw new ApiError(404, "NOT_FOUND", "Report not found.");
  return rows[0];
}
export async function endpoint(work: () => Promise<unknown>, status = 200) {
  try { return NextResponse.json({ data: await work() }, { status }); }
  catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    // Prisma driver adapters nest SQLSTATE codes beneath the outer error.
    const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}));
    const code = (error as { code?: string })?.code;
    if (code === "P2002" || code === "P2034" || /23505|23514|40P01|40001/.test(serialized ?? "")) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "This action conflicts with the current workflow or an existing record. Refresh and try again." } }, { status: 409 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Could not complete this request." } }, { status: 500 });
  }
}
