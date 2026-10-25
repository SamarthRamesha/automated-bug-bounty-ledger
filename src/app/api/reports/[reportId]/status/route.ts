
import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canTransitionStatus,
  reportIdSchema,
  statusSchema,
  type LifecycleStatus,
} from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Login required." } },
      { status: 401 },
    );
  }

  if (!isAdmin(session)) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Administrator role required.",
        },
      },
      { status: 403 },
    );
  }

  const { reportId } = await params;
  const parsedId = reportIdSchema.safeParse(reportId);

  if (!parsedId.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REPORT_ID",
          message: "Report ID must be a valid UUID.",
        },
      },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: "Invalid status.",
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
    const existing = await prisma.vulnerabilityReport.findUnique({
      where: { id: parsedId.data },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Report not found.",
          },
        },
        { status: 404 },
      );
    }

    const currentStatus = existing.status as LifecycleStatus;
    const nextStatus = parsed.data.status as LifecycleStatus;

    if (!canTransitionStatus(currentStatus, nextStatus)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot transition a report from ${currentStatus} to ${nextStatus}.`,
          },
        },
        { status: 409 },
      );
    }

    if (nextStatus === "PATCHED" || nextStatus === "CLOSED") {
      const approved = await prisma.patch.count({ where: { reportId: parsedId.data, reviewStatus: "APPROVED" } });
      if (!approved) return NextResponse.json({ error: { code: "PATCH_REQUIRED", message: "An approved patch is required." } }, { status: 409 });
    }

    // Atomic compare-and-swap: update only if the status
    // is still the one we validated above.
    const result = await prisma.vulnerabilityReport.updateMany({
      where: {
        id: parsedId.data,
        status: existing.status,
      },
      data: {
        status: nextStatus,
        lastStatusChangedBy: session.userId,
      },
    });

    if (result.count === 0) {
      const stillExists = await prisma.vulnerabilityReport.findUnique({
        where: { id: parsedId.data },
        select: { id: true },
      });

      if (!stillExists) {
        return NextResponse.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Report not found.",
            },
          },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          error: {
            code: "CONCURRENT_UPDATE",
            message:
              "This report was updated by another request. Refresh and try again.",
          },
        },
        { status: 409 },
      );
    }

    const report = await prisma.vulnerabilityReport.findUnique({
      where: { id: parsedId.data },
    });

    if (!report) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Report not found.",
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: report });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Could not update report status.",
        },
      },
      { status: 500 },
    );
  }
}
