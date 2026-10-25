import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { authenticated, endpoint } from "@/lib/workflow";
export async function GET() {
  return endpoint(async () => {
    const session = await authenticated();
    return prisma.bountyPayout.findMany({ where: isAdmin(session) ? {} : { report: { reporterId: session.userId } }, orderBy: { recordedAt: "desc" }, include: { report: { select: { id: true, title: true, reporter: { select: { displayName: true } } } } } });
  });
}
