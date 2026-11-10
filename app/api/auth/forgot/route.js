import { after } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { authConfigured } from "@/lib/auth";
import { mailConfigured } from "@/lib/mail";
import { issueResetCode } from "@/lib/verification";
import { limited, clientIp } from "@/lib/ratelimit";
import { EMAIL_RE } from "@/lib/validate";

// Starts a password reset: emails a 6-digit code to the account's email address.
// The answer is always the same, whether or not the account exists, so emails cannot be probed.
export async function POST(req) {
  if (!authConfigured() || !mailConfigured()) {
    return Response.json({ error: "Password reset is not set up on the server." }, { status: 500 });
  }
  if (await limited(`forgot:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  if (!EMAIL_RE.test(email)) return Response.json({ error: "Please enter a valid email." }, { status: 400 });

  try {
    await ensureSchema();
    const rows = await sql`SELECT id, email, email_verified FROM users WHERE email = ${email}`;
    const user = rows[0];
    if (user && user.email_verified) {
      // Done after the response is sent, so the response time does not reveal whether the account exists.
      after(async () => {
        try {
          await issueResetCode(user.id, user.email);
        } catch (err) {
          console.error("Forgot error:", err?.message);
        }
      });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Forgot error:", err?.message);
    return Response.json({ error: "Could not start the reset. Please try again." }, { status: 500 });
  }
}
