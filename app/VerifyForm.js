"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const JSON_HEADERS = { "Content-Type": "application/json" };

export default function VerifyForm({ email: initialEmail }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(initialEmail ? "We emailed you a 6-digit code. It is valid for 10 minutes." : "");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [wait, setWait] = useState(initialEmail ? 60 : 0); // seconds before "Resend" works

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not verify the code. Please try again.");
        setBusy(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection.");
      setBusy(false);
    }
  }

  async function resend() {
    if (sending || wait > 0 || !email) return;
    setError("");
    setInfo("");
    setSending(true);
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send a new code.");
        if (data.wait) setWait(data.wait);
      } else {
        setInfo("A new code is on its way. Check your inbox and spam folder.");
        setCode("");
        setWait(60);
      }
    } catch {
      setError("Could not reach the server. Check your connection.");
    }
    setSending(false);
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={verify}>
        <div className="auth-brand">
          <span className="logo" aria-hidden="true">✦</span>
          <h1>Nova</h1>
        </div>
        <h2>Verify your email</h2>

        {initialEmail ? (
          <p className="auth-note">
            Enter the code sent to <strong>{email}</strong>.
          </p>
        ) : (
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
        )}

        <label>
          Verification code
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="000000"
            autoFocus
            required
          />
        </label>

        {info && <p className="auth-ok" role="status">{info}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" className="primary" disabled={busy || code.length !== 6 || !email}>
          {busy ? "Checking..." : "Verify and continue"}
        </button>

        <p className="auth-switch">
          Did not get the email?{" "}
          <button type="button" className="link-btn" onClick={resend} disabled={sending || wait > 0 || !email}>
            {sending ? "Sending..." : wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
          </button>
        </p>
        <p className="auth-switch">
          Wrong email? <Link href="/signup">Sign up again</Link> or <Link href="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}
