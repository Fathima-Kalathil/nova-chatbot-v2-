import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { sql, ensureSchema } from "./db";

const COOKIE = "nova_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function authConfigured() {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16);
}

function key() {
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}

export async function createSession(userId) {
  const token = await new SignJWT({ uid: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(key());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

// Returns { id, name, email } for the logged-in user, or null.
export async function getSessionUser() {
  try {
    if (!authConfigured()) return null;
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, key());
    await ensureSchema();
    const rows = await sql`SELECT id, name, email, email_verified FROM users WHERE id = ${payload.uid}`;
    const u = rows[0];
    if (!u || !u.email_verified) return null;
    return { id: u.id, name: u.name, email: u.email };
  } catch {
    return null;
  }
}
