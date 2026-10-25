import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { payoutSchema } from "@/lib/validation";
import { ApiError, authenticated, body, endpoint, lockReport, reportId, type ReportContext } from "@/lib/workflow";
export async function POST(request: Request, context: ReportContext) {
  return endpoint(async () => {
    const session = await authenticated(true);
    const id = await reportId(context);
    const input = await body(request, payoutSchema);
    return prisma.$transaction(async tx => {
      const report = await lockReport(tx, id);
      if (report.status !== "CLOSED" || !await tx.patch.count({ where: { reportId: id, reviewStatus: "APPROVED" } })) throw new ApiError(409, "INELIGIBLE", "Payout requires a closed report with an approved patch.");
      return tx.bountyPayout.create({ data: { ...input, amount: new Prisma.Decimal(input.amount), reportId: id, recordedById: session.userId } });
    });
  }, 201);
}
