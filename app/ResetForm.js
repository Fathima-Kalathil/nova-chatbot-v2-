"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const JSON_HEADERS = { "Content-Type": "application/json" };

export default function ResetForm({ email: initialEmail }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(initialEmail ? "If an account exists for this email, we sent a 6-digit code. It is valid for 10 minutes." : "");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [wait, setWait] = useState(initialEmail ? 60 : 0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setInfo("");
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ email, code, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not reset the password. Please try again.");
        setBusy(false);
        return;
      }
      router.replace("/login?reset=1");
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
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Could not send a new code.");
      else {
        setInfo("If an account exists for this email, a new code is on its way. Check your inbox and spam folder.");
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
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <span className="logo" aria-hidden="true">✦</span>
          <h1>Nova</h1>
        </div>
        <h2>Choose a new password</h2>

        {initialEmail ? (
          <p className="auth-note">Code sent to <strong>{email}</strong></p>
        ) : (
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
        )}

        <label>
          Code from the email
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
        <label>
          New password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required />
          <span className="hint">8 to 72 characters.</span>
        </label>
        <label>
          Confirm new password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required />
        </label>

        {info && <p className="auth-ok" role="status">{info}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" className="primary" disabled={busy || code.length !== 6 || !email || !password || !confirm}>
          {busy ? "Saving..." : "Reset password"}
        </button>

        <p className="auth-switch">
          Did not get the email?{" "}
          <button type="button" className="link-btn" onClick={resend} disabled={sending || wait > 0 || !email}>
            {sending ? "Sending..." : wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
          </button>
        </p>
        <p className="auth-switch"><Link href="/login">Back to log in</Link></p>
      </form>
    </main>
  );
}
