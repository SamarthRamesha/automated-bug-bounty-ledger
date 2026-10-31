import { prisma } from "@/lib/db";
import {
  authenticated,
  endpoint,
  reportId,
  visibleReport,
  type ReportContext,
} from "@/lib/workflow";
export async function GET(_request: Request, context: ReportContext) {
  return endpoint(async () => {
    const session = await authenticated();
    const id = await reportId(context);
    await visibleReport(id, session);
    return prisma.vulnerabilityReport.findUnique({
      where: { id },
      include: {
        reporter: { select: { displayName: true } },
        patches: { orderBy: { createdAt: "desc" } },
        payout: true,
        statusHistory: {
          orderBy: { changedAt: "asc" },
          include: { changedBy: { select: { displayName: true } } },
        },
      },
    });
  });
}
