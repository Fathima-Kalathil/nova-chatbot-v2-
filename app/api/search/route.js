import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { likePattern, makeSnippet } from "@/lib/search";
import { limited } from "@/lib/ratelimit";

// Search the logged-in user's chats: by title and by message text.
export async function GET(req) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Not logged in." }, { status: 401 });

  if (await limited(`search:${user.id}`, 60, 60 * 1000)) {
    return Response.json({ error: "Too many searches. Slow down for a moment." }, { status: 429 });
  }

  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ results: [] });

  const like = likePattern(q);
  try {
    const rows = await sql`
      SELECT c.id, c.title, c.pinned,
        (SELECT m.content FROM messages m
          WHERE m.chat_id = c.id AND m.content ILIKE ${like}
          ORDER BY m.id DESC LIMIT 1) AS match
      FROM chats c
      WHERE c.user_id = ${user.id}
        AND (c.title ILIKE ${like}
             OR EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id AND m.content ILIKE ${like}))
      ORDER BY c.updated_at DESC
      LIMIT 30`;
    const results = rows.map((r) => ({
      id: r.id,
      title: r.title,
      pinned: r.pinned,
      snippet: r.match ? makeSnippet(r.match, q) : null,
    }));
    return Response.json({ results });
  } catch (err) {
    console.error("Search error:", err?.message);
    return Response.json({ error: "Could not search right now." }, { status: 500 });
  }
}
