import { sql, UUID_RE } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { askNova } from "@/lib/llm";
import { limited } from "@/lib/ratelimit";

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Please log in again." }, { status: 401 });

  if (!process.env.LLM_API_KEY) {
    return Response.json(
      { error: "Server is missing LLM_API_KEY. Add it to your environment variables." },
      { status: 500 }
    );
  }

  // 30 messages per user per hour, to protect the free API quota.
  if (await limited(`chat:${user.id}`, 30, 60 * 60 * 1000)) {
    return Response.json({ error: "Message limit reached. Please try again in an hour." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const message = String(body.message || "").trim().slice(0, 4000);
  if (!message) return Response.json({ error: "Please type a message." }, { status: 400 });

  try {
    let chatId = body.chatId || null;
    let title = null;

    if (chatId) {
      if (!UUID_RE.test(chatId)) return Response.json({ error: "Chat not found." }, { status: 404 });
      const own = await sql`SELECT id FROM chats WHERE id = ${chatId} AND user_id = ${user.id}`;
      if (own.length === 0) return Response.json({ error: "Chat not found." }, { status: 404 });
    } else {
      title = message.length > 40 ? message.slice(0, 40).trim() + "..." : message;
      const created = await sql`
        INSERT INTO chats (user_id, title) VALUES (${user.id}, ${title}) RETURNING id`;
      chatId = created[0].id;
    }

    await sql`INSERT INTO messages (chat_id, role, content) VALUES (${chatId}, 'user', ${message})`;

    // Nova sees the last 10 messages of this chat.
    const recent = await sql`
      SELECT role, content FROM (
        SELECT id, role, content FROM messages WHERE chat_id = ${chatId} ORDER BY id DESC LIMIT 10
      ) t ORDER BY id ASC`;

    let reply;
    try {
      reply = await askNova(recent);
    } catch (err) {
      console.error("LLM error:", err?.status, err?.message);
      const msg =
        err?.status === 429
          ? "Nova is busy right now (free-tier limit). Try again in a minute."
          : "Something went wrong talking to the model. Check your API key and model name.";
      return Response.json({ error: msg, chatId, title }, { status: 502 });
    }

    if (!reply) reply = "Sorry, I could not come up with a reply. Please try again.";

    await sql`INSERT INTO messages (chat_id, role, content) VALUES (${chatId}, 'assistant', ${reply})`;
    await sql`UPDATE chats SET updated_at = now() WHERE id = ${chatId}`;

    return Response.json({ chatId, title, reply });
  } catch (err) {
    console.error("Chat error:", err?.message);
    return Response.json(
      { error: "Could not save the chat. Check that the database is connected in Vercel." },
      { status: 500 }
    );
  }
}
