"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SUGGESTIONS = [
  "Explain React hooks simply",
  "Help me prepare for a frontend interview",
  "Write a friendly email asking for feedback",
];

const JSON_HEADERS = { "Content-Type": "application/json" };

// Pinned chats first, then newest first.
function arrange(list) {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
  });
}

function PinIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

// Shows text with the searched word highlighted.
function Highlight({ text, query }) {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts = [];
  let i = 0;
  for (;;) {
    const j = lower.indexOf(q, i);
    if (j === -1) break;
    if (j > i) parts.push(text.slice(i, j));
    parts.push(<mark key={j}>{text.slice(j, j + q.length)}</mark>);
    i = j + q.length;
  }
  parts.push(text.slice(i));
  return <>{parts}</>;
}

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

  const [menu, setMenu] = useState(null); // { chat, x, y }
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // chat object
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [query, setQuery] = useState("");
  const [found, setFound] = useState(null); // { q, items } from the server
  const [searching, setSearching] = useState(false);

  const endRef = useRef(null);
  const renameDone = useRef(false);

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
        if (res.ok) setChats(arrange((await res.json()).chats));
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Escape closes the menu and the delete box.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setMenu(null);
        setConfirmDelete(null);
        setConfirmLogout(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Search message text on the server, 300 ms after the user stops typing.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFound(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.status === 401) return router.replace("/login");
        if (res.ok) setFound({ q, items: (await res.json()).results });
      } catch {
        // cancelled or network error: keep showing the title matches
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, router]);

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

  function openFromSearch(id) {
    setQuery("");
    openChat(id);
  }

  // ----- 3-dots menu -----
  function openMenu(chat, e) {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const width = 190;
    const x = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    const y = Math.min(r.bottom + 4, window.innerHeight - 160);
    setMenu({ chat, x, y });
  }

  async function togglePin(chat) {
    setMenu(null);
    const pinned = !chat.pinned;
    setChats((c) => arrange(c.map((x) => (x.id === chat.id ? { ...x, pinned } : x))));
    try {
      const res = await fetch(`/api/chats/${chat.id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ pinned }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setChats((c) => arrange(c.map((x) => (x.id === chat.id ? { ...x, pinned: !pinned } : x))));
    }
  }

  function startRename(chat) {
    setMenu(null);
    renameDone.current = false;
    setRenamingId(chat.id);
    setRenameValue(chat.title);
  }

  async function finishRename(save) {
    if (renameDone.current) return;
    renameDone.current = true;
    const id = renamingId;
    const title = renameValue.trim().slice(0, 80);
    const old = chats.find((c) => c.id === id);
    setRenamingId(null);
    if (!save || !title || !old || title === old.title) return;

    setChats((c) => c.map((x) => (x.id === id ? { ...x, title } : x)));
    try {
      const res = await fetch(`/api/chats/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setChats((c) => c.map((x) => (x.id === id ? { ...x, title: old.title } : x)));
    }
  }

  function askDelete(chat) {
    setMenu(null);
    setConfirmDelete(chat);
  }

  async function deleteChat() {
    const chat = confirmDelete;
    setConfirmDelete(null);
    if (!chat) return;
    try {
      const res = await fetch(`/api/chats/${chat.id}`, { method: "DELETE" });
      if (!res.ok) return;
      setChats((c) => c.filter((x) => x.id !== chat.id));
      if (chat.id === activeId) newChat();
    } catch {}
  }

  // ----- sending messages -----
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
        headers: JSON_HEADERS,
        body: JSON.stringify({ chatId: activeId, message: content }),
      });
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();

      if (data.chatId) {
        setActiveId(data.chatId);
        setChats((c) => {
          const existing = c.find((x) => x.id === data.chatId);
          const entry = {
            ...(existing || { id: data.chatId, title: data.title || content.slice(0, 40), pinned: false }),
            updated_at: new Date().toISOString(),
          };
          return arrange([entry, ...c.filter((x) => x.id !== data.chatId)]);
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

  const q = query.trim();
  const localMatches = q
    ? chats
        .filter((c) => c.title.toLowerCase().includes(q.toLowerCase()))
        .map((c) => ({ id: c.id, title: c.title, pinned: c.pinned, snippet: null }))
    : [];
  const results = found && found.q === q ? found.items : localMatches;

  const pinned = chats.filter((c) => c.pinned);
  const others = chats.filter((c) => !c.pinned);

  function renderItem(c) {
    const isRenaming = renamingId === c.id;
    return (
      <div
        key={c.id}
        className={`chat-item ${c.id === activeId ? "active" : ""} ${menu?.chat.id === c.id ? "menu-open" : ""}`}
        onClick={() => !isRenaming && openChat(c.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && !isRenaming && openChat(c.id)}
      >
        {c.pinned && !isRenaming && (
          <span className="pin-mark" title="Pinned"><PinIcon size={13} /></span>
        )}

        {isRenaming ? (
          <input
            className="rename-input"
            value={renameValue}
            autoFocus
            maxLength={80}
            aria-label="Chat name"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenameValue(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={() => finishRename(true)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") finishRename(true);
              if (e.key === "Escape") finishRename(false);
            }}
          />
        ) : (
          <>
            <span className="chat-title">{c.title}</span>
            <button className="dots" aria-label={`Options for ${c.title}`} aria-haspopup="menu" onClick={(e) => openMenu(c, e)}>
              <DotsIcon />
            </button>
          </>
        )}
      </div>
    );
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
          <div className="search">
            <span className="search-icon"><SearchIcon /></span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder="Search chats"
              aria-label="Search chats"
              maxLength={100}
            />
            {query && (
              <button className="search-clear" aria-label="Clear search" onClick={() => setQuery("")}>✕</button>
            )}
          </div>
        </div>

        <nav className="chat-list" aria-label={q ? "Search results" : "Your chats"}>
          {q ? (
            <>
              {searching && <p className="search-status">Searching messages...</p>}
              {!searching && results.length === 0 && (
                <p className="side-empty">{q.length < 2 ? "Keep typing to search messages." : `No chats found for "${q}".`}</p>
              )}
              {results.map((r) => (
                <div
                  key={r.id}
                  className="chat-item result"
                  role="button"
                  tabIndex={0}
                  onClick={() => openFromSearch(r.id)}
                  onKeyDown={(e) => e.key === "Enter" && openFromSearch(r.id)}
                >
                  <div className="result-body">
                    <span className="chat-title"><Highlight text={r.title} query={q} /></span>
                    {r.snippet && <span className="result-snippet"><Highlight text={r.snippet} query={q} /></span>}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {chats.length === 0 && <p className="side-empty">Your chats will appear here.</p>}

              {pinned.length > 0 && (
                <>
                  <p className="group-label">Pinned</p>
                  {pinned.map(renderItem)}
                </>
              )}
              {others.length > 0 && (
                <>
                  {pinned.length > 0 && <p className="group-label">Chats</p>}
                  {others.map(renderItem)}
                </>
              )}
            </>
          )}
        </nav>

        <div className="side-bottom">
          <span className="user-name" title={user.email}>{user.name}</span>
          <button className="logout" onClick={() => setConfirmLogout(true)}>Log out</button>
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

      {/* 3-dots popup menu */}
      {menu && (
        <>
          <div className="pop-backdrop" onClick={() => setMenu(null)} />
          <div className="pop-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
            <button role="menuitem" onClick={() => togglePin(menu.chat)}>
              <PinIcon />
              <span>{menu.chat.pinned ? "Unpin" : "Pin"}</span>
            </button>
            <button role="menuitem" onClick={() => startRename(menu.chat)}>
              <PencilIcon />
              <span>Rename</span>
            </button>
            <button role="menuitem" className="danger" onClick={() => askDelete(menu.chat)}>
              <TrashIcon />
              <span>Delete</span>
            </button>
          </div>
        </>
      )}

      {/* Delete confirmation box */}
      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="del-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="del-title">Delete chat?</h2>
            <p>Are you sure you want to delete this chat?</p>
            <div className="modal-actions">
              <button className="btn-cancel" autoFocus onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-delete" onClick={deleteChat}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {/* Log out confirmation box */}
      {confirmLogout && (
        <div className="modal-backdrop" onClick={() => setConfirmLogout(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="out-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="out-title">Log out?</h2>
            <p>Are you sure you want to log out? Your chats are saved and will be here when you log back in.</p>
            <div className="modal-actions">
              <button className="btn-cancel" autoFocus onClick={() => setConfirmLogout(false)}>Cancel</button>
              <button
                className="btn-confirm"
                onClick={() => {
                  setConfirmLogout(false);
                  logout();
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
