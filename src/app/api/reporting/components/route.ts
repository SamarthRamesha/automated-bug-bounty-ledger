import { componentSummary } from "@/lib/evidence";
import { prisma } from "@/lib/db";
import { ApiError, authenticated, endpoint } from "@/lib/workflow";
export async function GET() {
  return endpoint(async () => {
    await authenticated(true);
    // Match SQL-owned report IDs so orphan documents never influence reporting.
    const reports = await prisma.vulnerabilityReport.findMany({
      select: { id: true },
    });
    try {
      return await componentSummary(reports.map((report) => report.id));
    } catch {
      throw new ApiError(
        503,
        "EVIDENCE_UNAVAILABLE",
        "Evidence reporting is unavailable. Try again shortly.",
      );
    }
  });
}
