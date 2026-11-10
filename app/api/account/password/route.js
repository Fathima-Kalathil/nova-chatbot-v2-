import { after } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getSessionUser, createSession } from "@/lib/auth";
import { sendPasswordChangedEmail } from "@/lib/mail";
import { limited } from "@/lib/ratelimit";
import { passwordError } from "@/lib/validate";

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Please log in again." }, { status: 401 });

  // Also stops someone with a stolen session from guessing the current password.
  if (await limited(`pwchange:${user.id}`, 10, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const current = String(body.current || "").slice(0, 200);
  const next = String(body.next || "");

  const pwError = passwordError(next);
  if (pwError) return Response.json({ error: pwError }, { status: 400 });

  try {
    const rows = await sql`SELECT password_hash FROM users WHERE id = ${user.id}`;
    const ok = rows[0] ? await bcrypt.compare(current, rows[0].password_hash) : false;
    if (!ok) return Response.json({ error: "Your current password is not correct." }, { status: 400 });
    if (current === next) return Response.json({ error: "The new password must be different." }, { status: 400 });

    const hash = await bcrypt.hash(next, 10);
    // Other devices are logged out; this browser stays logged in with a fresh session.
    await sql`
      UPDATE users SET password_hash = ${hash},
        sessions_valid_after = to_timestamp(${Date.now() / 1000}::float8)
      WHERE id = ${user.id}`;
    await createSession(user.id);

    after(async () => {
      try {
        await sendPasswordChangedEmail(user.email);
      } catch (err) {
        console.error("Notice email error:", err?.message);
      }
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Change password error:", err?.message);
    return Response.json({ error: "Could not change the password. Please try again." }, { status: 500 });
  }
}
