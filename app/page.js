"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SUGGESTIONS = [
  "Explain React hooks simply",
  "Help me prepare for a frontend interview",
  "Write a friendly email asking for feedback",
];

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const endRef = useRef(null);

  // On first load: check login, then load the sidebar list.
  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok) {
          router.replace("/login");
          return;
        }
        setUser((await me.json()).user);
        const res = await fetch("/api/chats");
        if (res.ok) setChats((await res.json()).chats);
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
  }

  async function openChat(id) {
    if (id === activeId) {
      setSidebarOpen(false);
      return;
    }
    setSidebarOpen(false);
    setOpening(true);
    setActiveId(id);
    setMessages([]);
    try {
      const res = await fetch(`/api/chats/${id}`);
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      setMessages(
        res.ok
          ? data.messages
          : [{ role: "assistant", content: data.error || "Could not open this chat.", error: true }]
      );
    } catch {
      setMessages([{ role: "assistant", content: "Could not open this chat.", error: true }]);
    } finally {
      setOpening(false);
    }
  }

  async function removeChat(id, e) {
    e.stopPropagation();
    if (!window.confirm("Delete this chat?")) return;
    try {
      const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setChats((c) => c.filter((x) => x.id !== id));
      if (id === activeId) newChat();
    } catch {}
  }

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || loading || opening) return;

    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: activeId, message: content }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();

      if (data.chatId) {
        setActiveId(data.chatId);
        setChats((c) => {
          const existing = c.find((x) => x.id === data.chatId);
          const entry = existing || { id: data.chatId, title: data.title || content.slice(0, 40) };
          return [entry, ...c.filter((x) => x.id !== data.chatId)];
        });
      }

      if (!res.ok || !data.reply) {
        setMessages([
          ...next,
          { role: "assistant", content: data.error || "No reply received. Please try again.", error: true },
        ]);
      } else {
        setMessages([...next, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Could not reach the server. Check your connection and try again.", error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.replace("/login");
    router.refresh();
  }

  if (!user) {
    return <div className="boot">Loading Nova...</div>;
  }

  return (
    <div className="shell">
      {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="side-top">
          <div className="brand">
            <span className="logo" aria-hidden="true">✦</span>
            <span>Nova</span>
          </div>
          <button className="new-chat" onClick={newChat}>+ New chat</button>
        </div>

        <nav className="chat-list" aria-label="Your chats">
          {chats.length === 0 && <p className="side-empty">Your chats will appear here.</p>}
          {chats.map((c) => (
            <div
              key={c.id}
              className={`chat-item ${c.id === activeId ? "active" : ""}`}
              onClick={() => openChat(c.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openChat(c.id)}
            >
              <span className="chat-title">{c.title}</span>
              <button className="del" aria-label={`Delete chat ${c.title}`} onClick={(e) => removeChat(c.id, e)}>
                ✕
              </button>
            </div>
          ))}
        </nav>

        <div className="side-bottom">
          <span className="user-name" title={user.email}>{user.name}</span>
          <button className="logout" onClick={logout}>Log out</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="menu" aria-label="Open chat list" onClick={() => setSidebarOpen(true)}>☰</button>
          <span className="logo" aria-hidden="true">✦</span>
          <h1>Nova</h1>
        </header>

        <section className="chat" aria-live="polite">
          <div className="chat-inner">
            {messages.length === 0 && !opening && (
              <div className="empty">
                <p className="empty-title">Hi {user.name.split(" ")[0]}, what can I help with?</p>
                <div className="chips">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {opening && <p className="opening">Opening chat...</p>}

            {messages.map((m, i) => (
              <div key={i} className={`row ${m.role}`}>
                <div className={`bubble ${m.error ? "error" : ""}`}>{m.content}</div>
              </div>
            ))}

            {loading && (
              <div className="row assistant">
                <div className="bubble typing" aria-label="Nova is typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </section>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Nova"
            aria-label="Message Nova"
            maxLength={4000}
          />
          <button type="submit" disabled={loading || opening || !input.trim()}>Send</button>
        </form>
      </main>
    </div>
  );
}
