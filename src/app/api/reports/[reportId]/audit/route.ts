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
    const session = await authenticated(true);
    const id = await reportId(context);
    await visibleReport(id, session);
    return prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: "VULNERABILITY_REPORT", entityId: id },
          { metadata: { path: ["reportId"], equals: id } },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: { actor: { select: { displayName: true } } },
    });
  });
}
