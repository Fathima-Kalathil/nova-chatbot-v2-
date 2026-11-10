"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ForgotForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      router.push(`/reset?email=${encodeURIComponent(email.trim())}`);
    } catch {
      setError("Could not reach the server. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <span className="logo" aria-hidden="true">✦</span>
          <h1>Nova</h1>
        </div>
        <h2>Forgot your password?</h2>
        <p className="auth-note">Enter your account email and we will send you a 6-digit code to choose a new password.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" className="primary" disabled={busy || !email.trim()}>
          {busy ? "Please wait..." : "Send code"}
        </button>
        <p className="auth-switch">
          Remembered it? <Link href="/login">Back to log in</Link>
        </p>
      </form>
    </main>
  );
}
