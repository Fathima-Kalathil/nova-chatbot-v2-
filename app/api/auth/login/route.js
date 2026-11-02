import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";
import { createSession, authConfigured } from "@/lib/auth";
import { limited, clientIp } from "@/lib/ratelimit";

export async function POST(req) {
  if (!authConfigured()) {
    return Response.json(
      { error: "Server is missing AUTH_SECRET (at least 16 characters). Add it in Vercel and redeploy." },
      { status: 500 }
    );
  }
  if (limited(`login:${clientIp(req)}`, 15, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    return Response.json({ error: "Enter your email and password." }, { status: 400 });
  }

  try {
    await ensureSchema();
    const rows = await sql`SELECT id, name, email, password_hash FROM users WHERE email = ${email}`;
    const user = rows[0];
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!ok) {
      return Response.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    await createSession(user.id);
    return Response.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("Login error:", err?.message);
    return Response.json(
      { error: "Could not log in. Check that the database is connected in Vercel." },
      { status: 500 }
    );
  }
}
