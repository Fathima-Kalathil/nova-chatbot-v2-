import { neon } from "@neondatabase/serverless";

// DATABASE_URL is added automatically when you connect Neon in Vercel -> Storage.
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "postgres://missing:missing@localhost/missing";
export const sql = neon(url);

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
      await sql`CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS messages (
        id BIGSERIAL PRIMARY KEY,
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
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
