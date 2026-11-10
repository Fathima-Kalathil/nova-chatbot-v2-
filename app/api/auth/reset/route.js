import { after } from "next/server";
import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";
import { authConfigured } from "@/lib/auth";
import { sendPasswordChangedEmail } from "@/lib/mail";
import { codeMatches } from "@/lib/otp";
import { MAX_ATTEMPTS } from "@/lib/verification";
import { limited, clientIp } from "@/lib/ratelimit";
import { passwordError } from "@/lib/validate";

// Finishes a password reset: checks the emailed code, sets the new password, ends all sessions.
export async function POST(req) {
  if (!authConfigured()) {
    return Response.json({ error: "Server is missing AUTH_SECRET." }, { status: 500 });
  }
  if (await limited(`reset:${clientIp(req)}`, 20, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  const code = String(body.code || "").trim();
  const password = String(body.password || "");
  if (!email || !/^\d{6}$/.test(code)) {
    return Response.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }
  const pwError = passwordError(password);
  if (pwError) return Response.json({ error: pwError }, { status: 400 });

  // However many IP addresses are used, one account only gets a limited number of code guesses per hour.
  if (await limited(`reset-acct:${email}`, 15, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts for this account. Try again later." }, { status: 429 });
  }

  try {
    await ensureSchema();
    const users = await sql`SELECT id, email, email_verified FROM users WHERE email = ${email}`;
    const user = users[0];
    const generic = "That code is not valid. Check it or request a new one.";
    if (!user || !user.email_verified) return Response.json({ error: generic }, { status: 400 });

    // Use up one attempt first (atomic), so parallel guesses cannot skip the limit.
    const rows = await sql`
      UPDATE password_resets SET attempts = attempts + 1
      WHERE user_id = ${user.id} AND attempts < ${MAX_ATTEMPTS} AND expires_at > now()
      RETURNING code_hash, attempts`;
    if (rows.length === 0) {
      return Response.json(
        { error: "This code has expired or was tried too many times. Please request a new code." },
        { status: 400 }
      );
    }
    if (!codeMatches(`reset:${user.id}`, code, rows[0].code_hash)) {
      const left = MAX_ATTEMPTS - rows[0].attempts;
      return Response.json(
        { error: left > 0 ? `Incorrect code. ${left} ${left === 1 ? "try" : "tries"} left.` : "Incorrect code. Please request a new code." },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(password, 10);
    // New password + every older login on every device stops working.
    await sql`
      UPDATE users SET password_hash = ${hash},
        sessions_valid_after = to_timestamp(${Date.now() / 1000}::float8)
      WHERE id = ${user.id}`;
    await sql`DELETE FROM password_resets WHERE user_id = ${user.id}`;

    after(async () => {
      try {
        await sendPasswordChangedEmail(user.email);
      } catch (err) {
        console.error("Notice email error:", err?.message);
      }
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Reset error:", err?.message);
    return Response.json({ error: "Could not reset the password. Please try again." }, { status: 500 });
  }
}
