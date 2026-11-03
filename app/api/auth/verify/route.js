import { sql, ensureSchema } from "@/lib/db";
import { createSession, authConfigured } from "@/lib/auth";
import { codeMatches } from "@/lib/otp";
import { MAX_ATTEMPTS } from "@/lib/verification";
import { limited, clientIp } from "@/lib/ratelimit";

export async function POST(req) {
  if (!authConfigured()) {
    return Response.json({ error: "Server is missing AUTH_SECRET." }, { status: 500 });
  }
  if (limited(`verify:${clientIp(req)}`, 20, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return Response.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  try {
    await ensureSchema();
    const users = await sql`SELECT id, name, email, email_verified FROM users WHERE email = ${email}`;
    const user = users[0];
    const generic = "That code is not valid. Check it or request a new one.";
    if (!user) return Response.json({ error: generic }, { status: 400 });
    if (user.email_verified) {
      return Response.json({ error: "This email is already verified. Please log in." }, { status: 409 });
    }

    // Use up one attempt first (atomic), so parallel guesses cannot skip the limit.
    const rows = await sql`
      UPDATE email_codes SET attempts = attempts + 1
      WHERE user_id = ${user.id} AND attempts < ${MAX_ATTEMPTS} AND expires_at > now()
      RETURNING code_hash, attempts`;
    if (rows.length === 0) {
      return Response.json(
        { error: "This code has expired or was tried too many times. Please request a new code." },
        { status: 400 }
      );
    }

    if (!codeMatches(user.id, code, rows[0].code_hash)) {
      const left = MAX_ATTEMPTS - rows[0].attempts;
      return Response.json(
        { error: left > 0 ? `Incorrect code. ${left} ${left === 1 ? "try" : "tries"} left.` : "Incorrect code. Please request a new code." },
        { status: 400 }
      );
    }

    await sql`UPDATE users SET email_verified = true WHERE id = ${user.id}`;
    await sql`DELETE FROM email_codes WHERE user_id = ${user.id}`;
    await createSession(user.id);
    return Response.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("Verify error:", err?.message);
    return Response.json({ error: "Could not verify the code. Please try again." }, { status: 500 });
  }
}
