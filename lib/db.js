import { neon } from "@neondatabase/serverless";

// DATABASE_URL is added automatically when you connect Neon in Vercel -> Storage.
// If a prefix was used (for example STORAGE_DATABASE_URL), it is found automatically.
function findDbUrl() {
  const direct = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (direct) return direct;
  const name = Object.keys(process.env).find(
    (n) => /(DATABASE_URL|POSTGRES_URL|STORAGE_URL)$/.test(n) && !/(UNPOOLED|NON_POOLING)/.test(n)
  );
  return name ? process.env[name] : "postgres://missing:missing@localhost/missing";
}
export const sql = neon(findDbUrl());

let ready;

// Creates the tables the first time the server needs them (safe to run many times).
export function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      // Email verification: accounts that already existed stay verified (default true when the
      // column is first added); new accounts are created as not verified.
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true`;
      await sql`ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false`;
      await sql`CREATE TABLE IF NOT EXISTS email_codes (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      // Logging out ends every older session of that user (token revocation).
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_after TIMESTAMPTZ NOT NULL DEFAULT 'epoch'`;
      // Request counters shared by every server instance (used for rate limiting).
      await sql`CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INT NOT NULL,
        window_start TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`;
      // One active password-reset code per user (separate from the sign-up verification code).
      await sql`CREATE TABLE IF NOT EXISTS password_resets (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`ALTER TABLE chats ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false`;
      await sql`CREATE TABLE IF NOT EXISTS messages (
        id BIGSERIAL PRIMARY KEY,
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      // Ties a verification code to the browser that proved the password (blocks pre-account takeover).
      await sql`ALTER TABLE email_codes ADD COLUMN IF NOT EXISTS nonce TEXT`;
      await sql`CREATE INDEX IF NOT EXISTS chats_user_idx ON chats (user_id, updated_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS messages_chat_idx ON messages (chat_id, id)`;
    })().catch((err) => {
      ready = undefined;
      throw err;
    });
  }
  return ready;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
