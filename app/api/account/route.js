import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getSessionUser, clearSession } from "@/lib/auth";
import { limited } from "@/lib/ratelimit";
import { cleanName } from "@/lib/validate";

// Change the display name.
export async function PATCH(req) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Please log in again." }, { status: 401 });
  if (await limited(`account:${user.id}`, 30, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many changes. Try again later." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = cleanName(body.name);
  if (!name) return Response.json({ error: "Please enter a name." }, { status: 400 });

  try {
    await sql`UPDATE users SET name = ${name} WHERE id = ${user.id}`;
    return Response.json({ user: { id: user.id, name, email: user.email } });
  } catch (err) {
    console.error("Rename account error:", err?.message);
    return Response.json({ error: "Could not save the name." }, { status: 500 });
  }
}

// Delete the account and everything in it (chats, messages, codes). Needs the password.
export async function DELETE(req) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Please log in again." }, { status: 401 });
  if (await limited(`account-del:${user.id}`, 5, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const password = String(body.password || "").slice(0, 200);

  try {
    const rows = await sql`SELECT password_hash FROM users WHERE id = ${user.id}`;
    const ok = rows[0] ? await bcrypt.compare(password, rows[0].password_hash) : false;
    if (!ok) return Response.json({ error: "That password is not correct." }, { status: 400 });

    await sql`DELETE FROM users WHERE id = ${user.id}`; // chats, messages and codes are removed by ON DELETE CASCADE
    await clearSession();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Delete account error:", err?.message);
    return Response.json({ error: "Could not delete the account. Please try again." }, { status: 500 });
  }
}
