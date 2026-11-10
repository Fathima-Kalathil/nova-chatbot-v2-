"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function api(path, method, body) {
  const res = await fetch(path, { method, headers: JSON_HEADERS, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  return { ok: res.ok, status: res.status, data };
}

export default function SettingsView() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  const [name, setName] = useState("");
  const [nameMsg, setNameMsg] = useState(null); // { ok, text }

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [dialog, setDialog] = useState(null); // "sessions" | "delete"
  const [delPassword, setDelPassword] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok) return router.replace("/login");
        const u = (await me.json()).user;
        setUser(u);
        setName(u.name);
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") closeDialog();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function closeDialog() {
    setDialog(null);
    setDelPassword("");
    setDialogError("");
    setDialogBusy(false);
  }

  async function saveName(e) {
    e.preventDefault();
    setNameMsg(null);
    const r = await api("/api/account", "PATCH", { name });
    if (r.status === 401) return router.replace("/login");
    if (!r.ok) return setNameMsg({ ok: false, text: r.data.error || "Could not save the name." });
    setUser(r.data.user);
    setName(r.data.user.name);
    setNameMsg({ ok: true, text: "Name saved." });
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (next !== confirm) return setPwMsg({ ok: false, text: "The two new passwords do not match." });
    setPwBusy(true);
    const r = await api("/api/account/password", "POST", { current, next });
    setPwBusy(false);
    if (r.status === 401) return router.replace("/login");
    if (!r.ok) return setPwMsg({ ok: false, text: r.data.error || "Could not change the password." });
    setCurrent("");
    setNext("");
    setConfirm("");
    setPwMsg({ ok: true, text: "Password changed. Your other devices were logged out and we sent you a confirmation email." });
  }

  async function logoutEverywhere() {
    setDialogBusy(true);
    const r = await api("/api/account/sessions", "DELETE");
    if (!r.ok && r.status !== 401) {
      setDialogError(r.data.error || "Could not log out of all devices.");
      setDialogBusy(false);
      return;
    }
    router.replace("/login");
  }

  async function deleteAccount(e) {
    e.preventDefault();
    setDialogError("");
    setDialogBusy(true);
    const r = await api("/api/account", "DELETE", { password: delPassword });
    if (!r.ok) {
      if (r.status === 401) return router.replace("/login");
      setDialogError(r.data.error || "Could not delete the account.");
      setDialogBusy(false);
      return;
    }
    router.replace("/signup");
  }

  if (!user) return <div className="boot">Loading settings...</div>;

  return (
    <main className="settings-page">
      <div className="settings-wrap">
        <header className="settings-head">
          <Link href="/" className="back-link">← Back to chat</Link>
          <h1>Settings</h1>
        </header>

        <section className="panel" aria-labelledby="profile-h">
          <h2 id="profile-h">Profile</h2>
          <form onSubmit={saveName} className="panel-form">
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
            </label>
            <label>
              Email
              <input value={user.email} readOnly disabled />
            </label>
            {nameMsg && <p className={nameMsg.ok ? "auth-ok" : "auth-error"} role="status">{nameMsg.text}</p>}
            <div><button className="primary" type="submit" disabled={!name.trim() || name.trim() === user.name}>Save name</button></div>
          </form>
        </section>

        <section className="panel" aria-labelledby="pw-h">
          <h2 id="pw-h">Change password</h2>
          <form onSubmit={changePassword} className="panel-form">
            <label>
              Current password
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
            </label>
            <label>
              New password
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required />
              <span className="hint">8 to 72 characters. Other devices will be logged out.</span>
            </label>
            <label>
              Confirm new password
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required />
            </label>
            {pwMsg && <p className={pwMsg.ok ? "auth-ok" : "auth-error"} role="status">{pwMsg.text}</p>}
            <div><button className="primary" type="submit" disabled={pwBusy || !current || !next || !confirm}>{pwBusy ? "Saving..." : "Change password"}</button></div>
          </form>
        </section>

        <section className="panel" aria-labelledby="sess-h">
          <h2 id="sess-h">Devices</h2>
          <p className="panel-text">Log out of Nova everywhere, including this browser. Use this if you lost a device or used a shared computer.</p>
          <div><button className="outline" onClick={() => setDialog("sessions")}>Log out of all devices</button></div>
        </section>

        <section className="panel danger-panel" aria-labelledby="del-h">
          <h2 id="del-h">Delete account</h2>
          <p className="panel-text">Permanently deletes your account, all your chats and all messages. This cannot be undone.</p>
          <div><button className="btn-delete" onClick={() => setDialog("delete")}>Delete my account</button></div>
        </section>
      </div>

      {dialog === "sessions" && (
        <div className="modal-backdrop" onClick={closeDialog}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ls-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="ls-title">Log out of all devices?</h2>
            <p>You will be logged out here too and need to log in again everywhere.</p>
            {dialogError && <p className="auth-error" role="alert">{dialogError}</p>}
            <div className="modal-actions">
              <button className="btn-cancel" autoFocus onClick={closeDialog}>Cancel</button>
              <button className="btn-confirm" onClick={logoutEverywhere} disabled={dialogBusy}>Log out everywhere</button>
            </div>
          </div>
        </div>
      )}

      {dialog === "delete" && (
        <div className="modal-backdrop" onClick={closeDialog}>
          <form className="modal" role="dialog" aria-modal="true" aria-labelledby="da-title" onClick={(e) => e.stopPropagation()} onSubmit={deleteAccount}>
            <h2 id="da-title">Delete your account?</h2>
            <p>This permanently deletes your account, chats and messages. Enter your password to confirm.</p>
            <input
              className="modal-input"
              type="password"
              value={delPassword}
              onChange={(e) => setDelPassword(e.target.value)}
              placeholder="Your password"
              aria-label="Your password"
              autoComplete="current-password"
              autoFocus
              required
            />
            {dialogError && <p className="auth-error" role="alert">{dialogError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={closeDialog}>Cancel</button>
              <button type="submit" className="btn-delete" disabled={dialogBusy || !delPassword}>Delete account</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
