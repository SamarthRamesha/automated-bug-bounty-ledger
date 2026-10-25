import { prisma } from "@/lib/db";
import { patchReviewSchema, reportIdSchema } from "@/lib/validation";
import {
  ApiError,
  authenticated,
  body,
  endpoint,
  lockReport,
  parse,
  reportId,
} from "@/lib/workflow";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ reportId: string; patchId: string }> },
) {
  return endpoint(async () => {
    const session = await authenticated(true);
    const id = await reportId(context);
    const patchId = parse(reportIdSchema, (await context.params).patchId);
    const input = await body(request, patchReviewSchema);
    return prisma.$transaction(async (tx) => {
      const report = await lockReport(tx, id);
      const patch = await tx.patch.findFirst({
        where: { id: patchId, reportId: id },
      });
      if (!patch) throw new ApiError(404, "NOT_FOUND", "Patch not found.");
      if (report.status !== "REMEDIATING" || patch.reviewStatus !== "PENDING")
        throw new ApiError(
          409,
          "INVALID_REVIEW",
          "Only pending patches in remediation can be reviewed.",
        );
      const reviewed = await tx.patch.update({
        where: { id: patchId },
        data: {
          reviewStatus: input.decision,
          reviewedById: session.userId,
          reviewedAt: new Date(),
          reviewNote: input.note || null,
        },
      });
      if (input.decision === "APPROVED")
        await tx.vulnerabilityReport.update({
          where: { id },
          data: { status: "PATCHED", lastStatusChangedBy: session.userId },
        });
      return reviewed;
    });
  });
}
