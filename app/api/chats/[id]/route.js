import { sql, UUID_RE } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// Open one chat: returns its messages.
export async function GET(_req, { params }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Not logged in." }, { status: 401 });
  if (!UUID_RE.test(id)) return Response.json({ error: "Chat not found." }, { status: 404 });
  try {
    const chat = await sql`SELECT id, title FROM chats WHERE id = ${id} AND user_id = ${user.id}`;
    if (chat.length === 0) return Response.json({ error: "Chat not found." }, { status: 404 });
    const messages = await sql`SELECT role, content FROM messages WHERE chat_id = ${id} ORDER BY id ASC`;
    return Response.json({ chat: chat[0], messages });
  } catch (err) {
    console.error("Open chat error:", err?.message);
    return Response.json({ error: "Could not open the chat." }, { status: 500 });
  }
}

// Rename and/or pin one chat. Body: { title?: string, pinned?: boolean }
export async function PATCH(req, { params }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Not logged in." }, { status: 401 });
  if (!UUID_RE.test(id)) return Response.json({ error: "Chat not found." }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    if (typeof body.title === "string") {
      const title = body.title.trim().slice(0, 80);
      if (!title) return Response.json({ error: "Chat name can't be empty." }, { status: 400 });
      await sql`UPDATE chats SET title = ${title} WHERE id = ${id} AND user_id = ${user.id}`;
    }
    if (typeof body.pinned === "boolean") {
      await sql`UPDATE chats SET pinned = ${body.pinned} WHERE id = ${id} AND user_id = ${user.id}`;
    }
    const rows = await sql`SELECT id, title, pinned FROM chats WHERE id = ${id} AND user_id = ${user.id}`;
    if (rows.length === 0) return Response.json({ error: "Chat not found." }, { status: 404 });
    return Response.json({ chat: rows[0] });
  } catch (err) {
    console.error("Update chat error:", err?.message);
    return Response.json({ error: "Could not update the chat." }, { status: 500 });
  }
}

// Delete one chat (and its messages).
export async function DELETE(_req, { params }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Not logged in." }, { status: 401 });
  if (!UUID_RE.test(id)) return Response.json({ error: "Chat not found." }, { status: 404 });
  try {
    await sql`DELETE FROM chats WHERE id = ${id} AND user_id = ${user.id}`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Delete chat error:", err?.message);
    return Response.json({ error: "Could not delete the chat." }, { status: 500 });
  }
}
