import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";
import { createSession, authConfigured, setVerifyTicket } from "@/lib/auth";
import { issueCode } from "@/lib/verification";
import { limited, clientIp } from "@/lib/ratelimit";

// Compared against when the email does not exist, so that "no such user" takes as long as "wrong password".
const DUMMY_HASH = bcrypt.hashSync("nova-not-a-real-password", 10);

export async function POST(req) {
  if (!authConfigured()) {
    return Response.json(
      { error: "Server is missing AUTH_SECRET (at least 16 characters). Add it in Vercel and redeploy." },
      { status: 500 }
    );
  }
  if (await limited(`login:${clientIp(req)}`, 15, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  const password = String(body.password || "").slice(0, 200);
  if (!email || !password) {
    return Response.json({ error: "Enter your email and password." }, { status: 400 });
  }

  // Limit guesses against ONE account even when they come from many different IP addresses.
  if (await limited(`login-acct:${email}`, 20, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts for this account. Try again in a few minutes." }, { status: 429 });
  }

  try {
    await ensureSchema();
    const rows = await sql`
      SELECT id, name, email, password_hash, email_verified FROM users WHERE email = ${email}`;
    const user = rows[0];
    const match = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !match) {
      return Response.json({ error: "Incorrect email or password." }, { status: 401 });
    }

    // Correct password but the email was never verified: send a fresh code and ask for it.
    if (!user.email_verified) {
      const result = await issueCode(user.id, user.email, { bind: true });
      await setVerifyTicket(user.id, result.nonce);
      return Response.json(
        { error: "Please verify your email to continue.", needsVerification: true, email: user.email },
        { status: 403 }
      );
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
