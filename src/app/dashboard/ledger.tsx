"use client";
import Link from "next/link";
import { displayAmount } from "@/lib/money";
import { useEffect, useState } from "react";
type Payout = {
  id: string;
  amount: string;
  currency: string;
  reference: string;
  report: { id: string; title: string; reporter: { displayName: string } };
};
export default function Ledger({ admin }: { admin: boolean }) {
  const [payouts, setPayouts] = useState<Payout[]>();
  const [components, setComponents] =
    useState<{ component: string; evidenceCount: number }[]>();
  const [error, setError] = useState("");
  const [componentError, setComponentError] = useState("");
  useEffect(() => {
    async function load(path: string) {
      const response = await fetch(path);
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message || "Could not load records.");
      return result.data;
    }
    void load("/api/payouts")
      .then(setPayouts)
      .catch((e) => setError(e.message));
    if (admin)
      void load("/api/reporting/components")
        .then(setComponents)
        .catch((e) => setComponentError(e.message));
  }, [admin]);
  return (
    <>
      <section>
        <h2>Payout ledger</h2>
        {error && <p role="alert">{error}</p>}
        {!payouts && !error && <p>Loading payouts…</p>}
        {payouts?.length === 0 && <p>No payouts recorded.</p>}
        {!!payouts?.length && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Researcher</th>
                  <th>Amount</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/dashboard/reports/${p.report.id}`}>
                        {p.report.title}
                      </Link>
                    </td>
                    <td>{p.report.reporter.displayName}</td>
                    <td>
                      {p.currency} {displayAmount(p.amount)}
                    </td>
                    <td>{p.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {admin && (
        <section>
          <h2>Evidence by component</h2>
          <p>
            MongoDB aggregation counts evidence documents mentioning each
            component.
          </p>
          {componentError && <p role="alert">{componentError}</p>}
          {!components && !componentError && <p>Loading evidence summary…</p>}
          {components?.length === 0 && <p>No component evidence yet.</p>}
          <ul>
            {components?.map((c) => (
              <li key={c.component}>
                {c.component}: {c.evidenceCount}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
