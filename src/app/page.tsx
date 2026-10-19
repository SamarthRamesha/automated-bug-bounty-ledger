import Link from "next/link";
export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">DBMS Level 3 Project</p>
      <h1>Automated Bug Bounty Vulnerability Patch &amp; Payout Ledger</h1>
      <p>
        Foundation established. Authentication, report workflows, evidence, remediation,
        payouts, and reporting will be delivered in the documented milestones.
      </p><Link href="/login">Open the ledger</Link>
    </main>
  );
}
