"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Sign in failed.");
      router.push("/dashboard"); router.refresh();
    } catch (e) { setError((e as Error).message || "Could not reach the server."); setBusy(false); }
  }
  return <main><p className="eyebrow">Bug bounty ledger</p><h1>Sign in</h1><form onSubmit={login}><fieldset disabled={busy}><label>Email<input required name="email" type="email" autoComplete="username" /></label><label>Password<input required name="password" type="password" autoComplete="current-password" /></label>{error && <p role="alert">{error}</p>}<button>{busy ? "Signing in…" : "Sign in"}</button></fieldset></form></main>;
}
