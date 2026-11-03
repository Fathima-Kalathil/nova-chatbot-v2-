import { sql } from "./db";
import { generateCode, hashCode } from "./otp";
import { sendVerificationEmail } from "./mail";

export const COOLDOWN_SECONDS = 60; // minimum gap between two emails to the same user
export const CODE_MINUTES = 10; // how long a code stays valid
export const MAX_ATTEMPTS = 5; // wrong guesses allowed per code

// Creates a new code, stores its hash and emails it.
// Returns { sent: true } or { sent: false, wait: seconds } when asked too soon.
export async function issueCode(userId, email) {
  const recent = await sql`
    SELECT EXTRACT(EPOCH FROM (now() - last_sent_at))::float AS secs
    FROM email_codes WHERE user_id = ${userId}`;
  if (recent.length > 0) {
    const wait = Math.ceil(COOLDOWN_SECONDS - recent[0].secs);
    if (wait > 0) return { sent: false, wait };
  }

  const code = generateCode();
  const hash = hashCode(userId, code);
  await sql`
    INSERT INTO email_codes (user_id, code_hash, expires_at, attempts, last_sent_at)
    VALUES (${userId}, ${hash}, now() + interval '10 minutes', 0, now())
    ON CONFLICT (user_id) DO UPDATE SET
      code_hash = EXCLUDED.code_hash,
      expires_at = EXCLUDED.expires_at,
      attempts = 0,
      last_sent_at = now()`;

  try {
    await sendVerificationEmail(email, code, CODE_MINUTES);
  } catch (err) {
    // Sending failed: allow an immediate retry.
    await sql`UPDATE email_codes SET last_sent_at = now() - interval '1 day' WHERE user_id = ${userId}`;
    throw err;
  }
  return { sent: true };
}
