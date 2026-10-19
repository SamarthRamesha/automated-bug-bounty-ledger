
import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Login required." } },
      { status: 401 },
    );
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();

  const searchFilter = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { affectedAsset: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const where = isAdmin(session)
    ? searchFilter
    : { reporterId: session.userId, ...searchFilter };

  try {
    const reports = await prisma.vulnerabilityReport.findMany({
      where,
      include: {
        reporter: {
          select: { displayName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: reports });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Could not retrieve reports." } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Login required." } },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const parsed = reportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: "Check report fields.",
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  try {
    const report = await prisma.vulnerabilityReport.create({
      data: {
        ...parsed.data,
        reporterId: session.userId,
      },
    });

    return NextResponse.json({ data: report }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Could not create report." } },
      { status: 500 },
    );
  }
}
