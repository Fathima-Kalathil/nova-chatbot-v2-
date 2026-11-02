import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";
import { createSession, authConfigured } from "@/lib/auth";
import { limited, clientIp } from "@/lib/ratelimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  if (!authConfigured()) {
    return Response.json(
      { error: "Server is missing AUTH_SECRET (at least 16 characters). Add it in Vercel and redeploy." },
      { status: 500 }
    );
  }
  if (limited(`signup:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many sign-ups from this network. Try again later." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = String(body.name || "").trim().slice(0, 60);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!name) return Response.json({ error: "Please enter your name." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return Response.json({ error: "Please enter a valid email." }, { status: 400 });
  if (password.length < 8 || password.length > 100) {
    return Response.json({ error: "Password must be 8 to 100 characters." }, { status: 400 });
  }

  try {
    await ensureSchema();
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return Response.json({ error: "An account with this email already exists. Please log in." }, { status: 409 });
    }
    const hash = await bcrypt.hash(password, 10);
    const rows = await sql`
      INSERT INTO users (name, email, password_hash) VALUES (${name}, ${email}, ${hash})
      RETURNING id, name, email`;
    await createSession(rows[0].id);
    return Response.json({ user: rows[0] });
  } catch (err) {
    console.error("Signup error:", err?.message);
    return Response.json(
      { error: "Could not create the account. Check that the database is connected in Vercel." },
      { status: 500 }
    );
  }
}
