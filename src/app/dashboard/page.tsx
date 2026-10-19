
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import LogoutButton from "./logout-button";
import ReportForm from "./report-form";

export default async function Dashboard() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const admin = isAdmin(session);

  const reports = await prisma.vulnerabilityReport.findMany({
    where: admin ? {} : { reporterId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <main>
      <p className="eyebrow">
        {admin ? "Administrator" : "Researcher"} dashboard
      </p>

      <h1>Vulnerability reports</h1>

      <p>Signed in as {session.email}</p>

      <LogoutButton />

      <ReportForm />

      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Severity</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>{report.title}</td>
              <td>{report.severity}</td>
              <td>{report.status}</td>
            </tr>
          ))}

          {reports.length === 0 && (
            <tr>
              <td colSpan={3}>No vulnerability reports found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
