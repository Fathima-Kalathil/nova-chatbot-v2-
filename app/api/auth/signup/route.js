import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "@/lib/db";
import { authConfigured } from "@/lib/auth";
import { mailConfigured } from "@/lib/mail";
import { issueCode } from "@/lib/verification";
import { limited, clientIp } from "@/lib/ratelimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  if (!authConfigured()) {
    return Response.json(
      { error: "Server is missing AUTH_SECRET (at least 16 characters). Add it in Vercel and redeploy." },
      { status: 500 }
    );
  }
  if (!mailConfigured()) {
    return Response.json(
      { error: "Email verification is not set up yet. Add SMTP_USER and SMTP_PASS in Vercel and redeploy." },
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
    const hash = await bcrypt.hash(password, 10);
    const existing = await sql`SELECT id, email_verified FROM users WHERE email = ${email}`;

    let userId;
    if (existing.length > 0) {
      if (existing[0].email_verified) {
        return Response.json({ error: "An account with this email already exists. Please log in." }, { status: 409 });
      }
      // Registered earlier but never verified: let them start again with new details.
      await sql`UPDATE users SET name = ${name}, password_hash = ${hash} WHERE id = ${existing[0].id}`;
      userId = existing[0].id;
    } else {
      const rows = await sql`
        INSERT INTO users (name, email, password_hash, email_verified)
        VALUES (${name}, ${email}, ${hash}, false) RETURNING id`;
      userId = rows[0].id;
    }

    try {
      await issueCode(userId, email);
    } catch (err) {
      console.error("Verification email error:", err?.message);
      return Response.json(
        { error: "We could not send the verification email. Check the email address and try again." },
        { status: 502 }
      );
    }

    // No login yet: the user must verify the email first.
    return Response.json({ needsVerification: true, email });
  } catch (err) {
    console.error("Signup error:", err?.message);
    return Response.json(
      { error: "Could not create the account. Check that the database is connected in Vercel." },
      { status: 500 }
    );
  }
}
