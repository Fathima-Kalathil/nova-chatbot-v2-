import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { sql, ensureSchema } from "./db";

const COOKIE = "nova_session";
const VERIFY_COOKIE = "nova_verify";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function authConfigured() {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16);
}

function key() {
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export async function createSession(userId) {
  const token = await new SignJWT({ uid: String(userId), purpose: "session", t: Date.now() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key());
  const jar = await cookies();
  jar.set(COOKIE, token, cookieOptions(MAX_AGE));
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
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.purpose && payload.purpose !== "session") return null; // e.g. a verification ticket
    await ensureSchema();
    const rows = await sql`
      SELECT id, name, email, email_verified,
             (EXTRACT(EPOCH FROM sessions_valid_after) * 1000)::float8 AS valid_after_ms
      FROM users WHERE id = ${payload.uid}`;
    const u = rows[0];
    if (!u || !u.email_verified) return null;
    const issuedMs = payload.t ?? (payload.iat || 0) * 1000;
    if (issuedMs < u.valid_after_ms) return null; // the user logged out after this token was made
    return { id: u.id, name: u.name, email: u.email };
  } catch {
    return null;
  }
}

// Logging out also cancels every older token of this user, so a copied cookie stops working.
export async function revokeSessions(userId) {
  await sql`UPDATE users SET sessions_valid_after = to_timestamp(${Date.now() / 1000}::float8) WHERE id = ${userId}`;
}

// ----- verification ticket: proves which browser started the email verification -----
export async function setVerifyTicket(userId, nonce) {
  const token = await new SignJWT({ uid: String(userId), nonce, purpose: "verify" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30m")
    .sign(key());
  const jar = await cookies();
  jar.set(VERIFY_COOKIE, token, cookieOptions(60 * 30));
}

export async function readVerifyTicket() {
  try {
    const jar = await cookies();
    const token = jar.get(VERIFY_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.purpose !== "verify" || !payload.nonce) return null;
    return { uid: String(payload.uid), nonce: String(payload.nonce) };
  } catch {
    return null;
  }
}

export async function clearVerifyTicket() {
  const jar = await cookies();
  jar.delete(VERIFY_COOKIE);
}
