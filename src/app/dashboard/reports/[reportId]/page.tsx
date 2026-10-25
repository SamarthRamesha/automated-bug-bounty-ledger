import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportIdSchema } from "@/lib/validation";
import ReportDetail from "./report-detail";
export default async function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { reportId } = await params;
  if (!reportIdSchema.safeParse(reportId).success) notFound();
  const report = await prisma.vulnerabilityReport.findFirst({ where: { id: reportId, ...(isAdmin(session) ? {} : { reporterId: session.userId }) }, select: { id: true } });
  if (!report) notFound();
  return <main><Link href="/dashboard">← Dashboard</Link><ReportDetail reportId={reportId} admin={isAdmin(session)} /></main>;
}
