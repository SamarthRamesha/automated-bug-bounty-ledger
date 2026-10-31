import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { severities, reportStatuses } from "@/types/domain";
import type { Prisma } from "@/generated/prisma/client";
import LogoutButton from "./logout-button";
import ReportForm from "./report-form";
import Ledger from "./ledger";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    severity?: string;
    page?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const admin = isAdmin(session);
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 200) : "";
  const page = Math.min(
    10000,
    Math.max(1, Number.parseInt(query.page, 10) || 1),
  );
  const where: Prisma.VulnerabilityReportWhereInput = {
    ...(admin ? {} : { reporterId: session.userId }),
    ...(reportStatuses.includes(query.status as never)
      ? { status: query.status as never }
      : {}),
    ...(severities.includes(query.severity as never)
      ? { severity: query.severity as never }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { affectedAsset: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [reports, count, summary] = await Promise.all([
    prisma.vulnerabilityReport.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    prisma.vulnerabilityReport.count({ where }),
    admin
      ? prisma.$queryRaw<
          {
            status: string;
            severity: string;
            report_count: bigint;
            patched_report_count: bigint;
          }[]
        >`SELECT * FROM v_report_dashboard ORDER BY status, severity`
      : Promise.resolve([]),
  ]);
  const link = (target: number) =>
    `/dashboard?${new URLSearchParams({ q, status: query.status || "", severity: query.severity || "", page: String(target) })}`;
  return (
    <main>
      <p className="eyebrow">
        {admin ? "Administrator" : "Researcher"} dashboard
      </p>
      <h1>Vulnerability reports</h1>
      <p>Signed in as {session.email}</p>
      <LogoutButton />
      <ReportForm />
      <section>
        <h2>Reports</h2>
        <form className="filters">
          <label>
            Search title or asset
            <input name="q" defaultValue={q} maxLength={200} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={query.status || ""}>
              <option value="">All statuses</option>
              {reportStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Severity
            <select name="severity" defaultValue={query.severity || ""}>
              <option value="">All severities</option>
              {severities.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button>Filter reports</button>
        </form>
        <p>
          {count} matching report{count === 1 ? "" : "s"}
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/dashboard/reports/${r.id}`}>{r.title}</Link>
                  </td>
                  <td>{r.severity}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
              {!reports.length && (
                <tr>
                  <td colSpan={3}>No vulnerability reports found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <nav className="actions">
          {page > 1 && <Link href={link(page - 1)}>Previous page</Link>}
          {page * 20 < count && <Link href={link(page + 1)}>Next page</Link>}
        </nav>
      </section>
      {admin && (
        <section>
          <h2>Report overview</h2>
          {!summary.length && <p>No reports yet.</p>}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Reports</th>
                  <th>Approved patch</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => (
                  <tr key={`${row.status}-${row.severity}`}>
                    <td>{row.status}</td>
                    <td>{row.severity}</td>
                    <td>{String(row.report_count)}</td>
                    <td>{String(row.patched_report_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <Ledger admin={admin} />
    </main>
  );
}
