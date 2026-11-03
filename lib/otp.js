import { createHmac, randomInt, timingSafeEqual } from "crypto";

// A random 6-digit code such as "042917".
export function generateCode() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

// We never store the code itself, only a keyed hash of it.
export function hashCode(userId, code) {
  return createHmac("sha256", process.env.AUTH_SECRET || "")
    .update(`${userId}:${code}`)
    .digest("hex");
}

export function codeMatches(userId, code, storedHash) {
  const a = Buffer.from(hashCode(userId, String(code)), "hex");
  const b = Buffer.from(String(storedHash), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
