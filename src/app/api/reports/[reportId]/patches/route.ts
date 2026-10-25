import { prisma } from "@/lib/db";
import { patchSchema } from "@/lib/validation";
import {
  ApiError,
  authenticated,
  body,
  endpoint,
  lockReport,
  reportId,
  type ReportContext,
} from "@/lib/workflow";
export async function POST(request: Request, context: ReportContext) {
  return endpoint(async () => {
    const session = await authenticated(true);
    const id = await reportId(context);
    const input = await body(request, patchSchema);
    return prisma.$transaction(async (tx) => {
      const report = await lockReport(tx, id);
      if (report.status !== "REMEDIATING")
        throw new ApiError(
          409,
          "INVALID_STATUS",
          "Patches can be submitted only during remediation.",
        );
      return tx.patch.create({
        data: {
          ...input,
          patchedAt: new Date(input.patchedAt),
          reportId: id,
          submittedById: session.userId,
        },
      });
    });
  }, 201);
}
