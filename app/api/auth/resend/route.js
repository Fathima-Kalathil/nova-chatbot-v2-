import { sql, ensureSchema } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { issueCode } from "@/lib/verification";
import { limited, clientIp } from "@/lib/ratelimit";

export async function POST(req) {
  if (!mailConfigured()) {
    return Response.json({ error: "Email verification is not set up on the server." }, { status: 500 });
  }
  if (await limited(`resend:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  if (!email) return Response.json({ error: "Enter your email." }, { status: 400 });

  try {
    await ensureSchema();
    const rows = await sql`SELECT id, email, email_verified FROM users WHERE email = ${email}`;
    const user = rows[0];
    // Same answer whether or not the account exists, so emails cannot be probed.
    if (!user || user.email_verified) return Response.json({ ok: true });

    const result = await issueCode(user.id, user.email);
    if (!result.sent) {
      return Response.json(
        { error: `Please wait ${result.wait} seconds before asking for another code.`, wait: result.wait },
        { status: 429 }
      );
    }
    if (result.mailError) {
      return Response.json({ error: "We could not send the email. Please try again." }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Resend error:", err?.message);
    return Response.json({ error: "We could not send the email. Please try again." }, { status: 502 });
  }
}
