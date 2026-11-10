import { randomBytes } from "crypto";
import { sql } from "./db";
import { generateCode, hashCode } from "./otp";
import { sendVerificationEmail, sendResetEmail } from "./mail";

export const COOLDOWN_SECONDS = 60; // minimum gap between two emails to the same user
export const CODE_MINUTES = 10; // how long a code stays valid
export const MAX_ATTEMPTS = 5; // wrong guesses allowed per code

// Creates a code, stores its hash and emails it.
//  bind = true  -> the caller just proved the password (sign-up or login): make a new "nonce"
//                  that only that browser receives, so only it can complete the verification.
//  bind = false -> resend: keep the existing nonce.
// Returns { sent, wait?, mailError?, nonce }.
export async function issueCode(userId, email, { bind = false } = {}) {
  const existing = await sql`
    SELECT EXTRACT(EPOCH FROM (now() - last_sent_at))::float AS secs, nonce
    FROM email_codes WHERE user_id = ${userId}`;
  const row = existing[0];
  const freshNonce = randomBytes(16).toString("hex");
  const nonce = bind ? freshNonce : row?.nonce || freshNonce;

  if (row) {
    const wait = Math.ceil(COOLDOWN_SECONDS - row.secs);
    if (wait > 0) {
      // Too soon for a new email: the code from the last one is still valid.
      if (bind) await sql`UPDATE email_codes SET nonce = ${nonce} WHERE user_id = ${userId}`;
      return { sent: false, wait, nonce };
    }
  }

  const code = generateCode();
  const hash = hashCode(userId, code);
  await sql`
    INSERT INTO email_codes (user_id, code_hash, expires_at, attempts, last_sent_at, nonce)
    VALUES (${userId}, ${hash}, now() + interval '10 minutes', 0, now(), ${nonce})
    ON CONFLICT (user_id) DO UPDATE SET
      code_hash = EXCLUDED.code_hash,
      expires_at = EXCLUDED.expires_at,
      attempts = 0,
      last_sent_at = now(),
      nonce = EXCLUDED.nonce`;

  try {
    await sendVerificationEmail(email, code, CODE_MINUTES);
  } catch (err) {
    console.error("Verification email error:", err?.message);
    // Sending failed: allow an immediate retry.
    await sql`UPDATE email_codes SET last_sent_at = now() - interval '1 day' WHERE user_id = ${userId}`;
    return { sent: false, mailError: true, nonce };
  }
  return { sent: true, nonce };
}

// Password reset: creates a code, stores its hash and emails it (once per 60 seconds per user).
// Returns { sent, wait?, mailError? }.
export async function issueResetCode(userId, email) {
  const existing = await sql`
    SELECT EXTRACT(EPOCH FROM (now() - last_sent_at))::float AS secs
    FROM password_resets WHERE user_id = ${userId}`;
  if (existing[0]) {
    const wait = Math.ceil(COOLDOWN_SECONDS - existing[0].secs);
    if (wait > 0) return { sent: false, wait };
  }

  const code = generateCode();
  const hash = hashCode(`reset:${userId}`, code);
  await sql`
    INSERT INTO password_resets (user_id, code_hash, expires_at, attempts, last_sent_at)
    VALUES (${userId}, ${hash}, now() + interval '10 minutes', 0, now())
    ON CONFLICT (user_id) DO UPDATE SET
      code_hash = EXCLUDED.code_hash,
      expires_at = EXCLUDED.expires_at,
      attempts = 0,
      last_sent_at = now()`;

  try {
    await sendResetEmail(email, code, CODE_MINUTES);
  } catch (err) {
    console.error("Reset email error:", err?.message);
    await sql`UPDATE password_resets SET last_sent_at = now() - interval '1 day' WHERE user_id = ${userId}`;
    return { sent: false, mailError: true };
  }
  return { sent: true };
}
