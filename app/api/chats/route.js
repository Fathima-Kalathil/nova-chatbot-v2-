import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// List the logged-in user's chats for the sidebar (pinned first, then newest).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Not logged in." }, { status: 401 });
  try {
    const chats = await sql`
      SELECT id, title, pinned, updated_at FROM chats WHERE user_id = ${user.id}
      ORDER BY pinned DESC, updated_at DESC LIMIT 100`;
    return Response.json({ chats });
  } catch (err) {
    console.error("List chats error:", err?.message);
    return Response.json({ error: "Could not load chats." }, { status: 500 });
  }
}
