
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed. Please try again.");
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Could not log out. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleLogout} disabled={loading}>
        {loading ? "Logging out..." : "Log out"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}