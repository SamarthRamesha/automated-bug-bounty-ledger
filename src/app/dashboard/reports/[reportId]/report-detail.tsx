"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { displayAmount } from "@/lib/money";
import { statusTransitions, type LifecycleStatus } from "@/lib/validation";

type Patch = {
  id: string;
  summary: string;
  reference: string;
  patchedAt: string;
  reviewStatus: string;
  reviewedAt?: string;
  reviewNote?: string;
};
type Payout = {
  amount: string;
  currency: string;
  reference: string;
  recordedAt: string;
};
type Report = {
  id: string;
  title: string;
  description: string;
  affectedAsset: string;
  severity: string;
  status: LifecycleStatus;
  reporter: { displayName: string };
  patches: Patch[];
  payout?: Payout;
  statusHistory: {
    id: string;
    fromStatus?: string;
    toStatus: string;
    changedAt: string;
    changedBy?: { displayName: string };
  }[];
};
type Evidence = {
  _id: string;
  reproduction: {
    steps: string[];
    expectedBehavior: string;
    observedBehavior: string;
  };
  affectedComponents: string[];
  technicalMetadata: Record<string, string>;
  sanitizedPocNotes?: string;
  createdAt: string;
};
type Audit = {
  id: string;
  action: string;
  createdAt: string;
  actor?: { displayName: string };
  metadata: unknown;
};
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error?.message ?? "Request failed. Try again.");
  return result.data;
}
function date(value: string) {
  return new Date(value).toLocaleString();
}
export default function ReportDetail({
  reportId,
  admin,
}: {
  reportId: string;
  admin: boolean;
}) {
  const base = `/api/reports/${reportId}`;
  const [report, setReport] = useState<Report>();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState("");
  const [evidenceError, setEvidenceError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [operationId, setOperationId] = useState("");
  const load = useCallback(async () => {
    try {
      setReport(await api<Report>(base));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [base]);
  const loadEvidence = useCallback(async () => {
    try {
      setEvidence(await api<Evidence[]>(`${base}/evidence`));
      setEvidenceError("");
    } catch (e) {
      setEvidenceError((e as Error).message);
    }
  }, [base]);
  const loadAudit = useCallback(async () => {
    if (!admin) return;
    try {
      setAudit(await api<Audit[]>(`${base}/audit`));
      setAuditError("");
    } catch (e) {
      setAuditError((e as Error).message);
    }
  }, [base, admin]);
  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    void api<Report>(base, options)
      .then(setReport)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    void api<Evidence[]>(`${base}/evidence`, options)
      .then(setEvidence)
      .catch((e) => {
        if (!controller.signal.aborted) setEvidenceError(e.message);
      });
    if (admin)
      void api<Audit[]>(`${base}/audit`, options)
        .then(setAudit)
        .catch((e) => {
          if (!controller.signal.aborted) setAuditError(e.message);
        });
    return () => controller.abort();
  }, [base, admin]);
  async function mutate(
    path: string,
    method: string,
    input: unknown,
    form?: HTMLFormElement,
    key?: string,
  ) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await api<{ auditPending?: boolean }>(`${base}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        body: JSON.stringify(input),
      });
      setSuccess(
        result.auditPending
          ? "Evidence saved; audit completion is pending. Retry with the same evidence and key to reconcile."
          : "Saved successfully.",
      );
      if (!result.auditPending) {
        form?.reset();
        if (key) setOperationId("");
      }
      await Promise.all([load(), loadEvidence(), loadAudit()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!report)
    return (
      <>
        <h1>Report details</h1>
        <p role={error ? "alert" : "status"}>{error || "Loading report…"}</p>
        <button onClick={load}>Retry</button>
      </>
    );
  const next = statusTransitions[report.status].filter(
    (status) => status !== "PATCHED",
  );
  function evidenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form);
    let metadata;
    try {
      metadata = JSON.parse(String(data.get("metadata") || "{}"));
    } catch {
      setError("Technical metadata must be a JSON object with string values.");
      return;
    }
    const key = operationId || crypto.randomUUID();
    setOperationId(key);
    void mutate(
      "/evidence",
      "POST",
      {
        reproduction: {
          steps: String(data.get("steps"))
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          expectedBehavior: data.get("expected"),
          observedBehavior: data.get("observed"),
        },
        affectedComponents: String(data.get("components"))
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        technicalMetadata: metadata,
        ...(data.get("notes") ? { sanitizedPocNotes: data.get("notes") } : {}),
      },
      form,
      key,
    );
  }
  return (
    <>
      <p className="eyebrow">
        {report.severity} · {report.status}
      </p>
      <h1>{report.title}</h1>
      <p>
        Reported by {report.reporter.displayName} · Asset:{" "}
        {report.affectedAsset}
      </p>
      <p className="prewrap">{report.description}</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      {admin && (
        <section>
          <h2>Report status</h2>
          <div className="actions">
            {next.map((status) => (
              <button
                disabled={busy}
                key={status}
                onClick={() => mutate("/status", "PATCH", { status })}
              >
                {status.replaceAll("_", " ")}
              </button>
            ))}
          </div>
          {next.length === 0 && (
            <p>
              {report.status === "REMEDIATING"
                ? "Approve a patch to advance this report."
                : "No further transitions."}
            </p>
          )}
        </section>
      )}
      <section>
        <h2>Evidence</h2>
        {evidenceError && (
          <p role="alert">
            {evidenceError}{" "}
            <button onClick={loadEvidence}>Retry evidence</button>
          </p>
        )}
        {evidence.length === 0 && !evidenceError && (
          <p>No evidence submitted.</p>
        )}
        {evidence.map((item) => (
          <article key={item._id}>
            <h3>{item.affectedComponents.join(", ")}</h3>
            <p>{date(item.createdAt)}</p>
            <ol>
              {item.reproduction.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <p>Expected: {item.reproduction.expectedBehavior}</p>
            <p>Observed: {item.reproduction.observedBehavior}</p>
            <pre>{JSON.stringify(item.technicalMetadata, null, 2)}</pre>
            <p>{item.sanitizedPocNotes}</p>
          </article>
        ))}
        <details>
          <summary>Add sanitized evidence</summary>
          <form onSubmit={evidenceSubmit}>
            <fieldset disabled={busy}>
              <label>
                Reproduction steps, one per line
                <textarea name="steps" required maxLength={60000} />
              </label>
              <label>
                Expected behavior
                <textarea name="expected" required maxLength={2000} />
              </label>
              <label>
                Observed behavior
                <textarea name="observed" required maxLength={2000} />
              </label>
              <label>
                Affected components, comma-separated
                <input name="components" required maxLength={3600} />
              </label>
              <label>
                Technical metadata (JSON with string values)
                <textarea name="metadata" defaultValue="{}" />
              </label>
              <label>
                Sanitized notes
                <textarea name="notes" maxLength={5000} />
              </label>
              <p>
                Use observations without credentials or private exploit
                material.
              </p>
              {operationId && (
                <p>
                  A retry key is retained. Retry the same evidence, or{" "}
                  <button type="button" onClick={() => setOperationId("")}>
                    start a new submission
                  </button>
                  .
                </p>
              )}
              <button type="submit">
                {busy ? "Saving…" : "Save evidence"}
              </button>
            </fieldset>
          </form>
        </details>
      </section>
      <section>
        <h2>Patches</h2>
        {report.patches.length === 0 && <p>No patches submitted.</p>}
        {report.patches.map((patch) => (
          <article key={patch.id}>
            <h3>
              {patch.reference} · {patch.reviewStatus}
            </h3>
            <p>{patch.summary}</p>
            <p>Patched: {date(patch.patchedAt)}</p>
            {patch.reviewedAt && (
              <p>
                Reviewed: {date(patch.reviewedAt)} ·{" "}
                {patch.reviewNote || "Approved"}
              </p>
            )}
            {admin &&
              report.status === "REMEDIATING" &&
              patch.reviewStatus === "PENDING" && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const decision = (
                      (event.nativeEvent as SubmitEvent)
                        .submitter as HTMLButtonElement
                    )?.value;
                    if (!decision) return;
                    void mutate(
                      `/patches/${patch.id}/review`,
                      "PATCH",
                      {
                        decision,
                        note: new FormData(event.currentTarget).get("note"),
                      },
                      event.currentTarget,
                    );
                  }}
                >
                  <fieldset disabled={busy}>
                    <label>
                      Review note (required for rejection)
                      <input name="note" maxLength={500} />
                    </label>
                    <div className="actions">
                      <button value="APPROVED">Approve patch</button>
                      <button value="REJECTED">Reject patch</button>
                    </div>
                  </fieldset>
                </form>
              )}
          </article>
        ))}
        {admin && report.status === "REMEDIATING" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const value = String(data.get("patchedAt"));
              void mutate(
                "/patches",
                "POST",
                {
                  summary: data.get("summary"),
                  reference: data.get("reference"),
                  patchedAt: new Date(value).toISOString(),
                },
                event.currentTarget,
              );
            }}
          >
            <fieldset disabled={busy}>
              <h3>Submit patch for review</h3>
              <label>
                Patch summary
                <textarea
                  name="summary"
                  required
                  minLength={10}
                  maxLength={10000}
                />
              </label>
              <label>
                Patch/version reference
                <input name="reference" required maxLength={255} />
              </label>
              <label>
                Patch date and time
                <input type="datetime-local" name="patchedAt" required />
              </label>
              <button>Submit patch</button>
            </fieldset>
          </form>
        )}
      </section>
      <section>
        <h2>Bounty payout</h2>
        {report.payout ? (
          <p>
            {report.payout.currency} {displayAmount(report.payout.amount)} ·
            Reference: {report.payout.reference} ·{" "}
            {date(report.payout.recordedAt)}
          </p>
        ) : (
          <p>
            No payout recorded. Eligibility requires closure and an approved
            patch.
          </p>
        )}
        {admin &&
          report.status === "CLOSED" &&
          report.patches.some((p) => p.reviewStatus === "APPROVED") &&
          !report.payout && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void mutate(
                  "/payouts",
                  "POST",
                  Object.fromEntries(data),
                  event.currentTarget,
                );
              }}
            >
              <fieldset disabled={busy}>
                <p>
                  Recipient: {report.reporter.displayName}. This records a
                  payment; it does not transfer money.
                </p>
                <label>
                  Amount
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    max="9999999999.99"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Currency
                  <select name="currency">
                    <option>INR</option>
                    <option>USD</option>
                  </select>
                </label>
                <label>
                  Payment reference
                  <input name="reference" required maxLength={100} />
                </label>
                <button>Record payout</button>
              </fieldset>
            </form>
          )}
      </section>
      <section>
        <h2>Status history</h2>
        <ol>
          {report.statusHistory.map((item) => (
            <li key={item.id}>
              {item.fromStatus || "Created"} → {item.toStatus} ·{" "}
              {date(item.changedAt)} ·{" "}
              {item.changedBy?.displayName || "Unattributed"}
            </li>
          ))}
        </ol>
      </section>
      {admin && (
        <section>
          <h2>Audit trail</h2>
          {auditError && <p role="alert">{auditError}</p>}
          {!audit.length && <p>No audit events.</p>}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Time</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((item) => (
                  <tr key={item.id}>
                    <td>{item.action}</td>
                    <td>{item.actor?.displayName || "Unattributed"}</td>
                    <td>{date(item.createdAt)}</td>
                    <td>
                      <code>{JSON.stringify(item.metadata)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
