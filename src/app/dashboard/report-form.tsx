
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type ReportFormProps = {
  onSubmitted?: () => void;
};

export default function ReportForm({ onSubmitted }: ReportFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [affectedAsset, setAffectedAsset] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          severity,
          affectedAsset: affectedAsset.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(
          result?.error?.message ??
            result?.message ??
            "Could not submit the report. Please check the fields."
        );
        return;
      }

      setTitle("");
      setDescription("");
      setSeverity("MEDIUM");
      setAffectedAsset("");
      setMessage("Report submitted successfully.");
      router.refresh();
      onSubmitted?.();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="report-form-section">
      <h2>Submit a vulnerability report</h2>
      <p>Provide the details of the vulnerability you discovered.</p>

      <form onSubmit={handleSubmit} className="report-form">
        <label htmlFor="report-title">Report title</label>
        <input
          id="report-title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          minLength={8}
          maxLength={200}
          required
          placeholder="e.g. SQL injection in search endpoint"
        />

        <label htmlFor="report-description">Description</label>
        <textarea
          id="report-description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          minLength={20}
          maxLength={10000}
          required
          rows={5}
          placeholder="Explain the vulnerability and its potential impact."
        />

        <label htmlFor="report-severity">Severity</label>
        <select
          id="report-severity"
          name="severity"
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
          required
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>

        <label htmlFor="report-asset">Affected asset</label>
        <input
          id="report-asset"
          name="affectedAsset"
          value={affectedAsset}
          onChange={(event) => setAffectedAsset(event.target.value)}
          maxLength={255}
          required
          placeholder="e.g. https://example.com/search"
        />

        <button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit report"}
        </button>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
