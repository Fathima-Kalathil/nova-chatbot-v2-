import { sql, ensureSchema } from "./db";

// Counts requests per key in the database, so the limit holds across all server instances.
// Returns true when the caller is over the limit (fixed time window).
export async function limited(key, limit, windowMs) {
  try {
    await ensureSchema();
    const secs = windowMs / 1000;
    const k = String(key).slice(0, 200);
    const rows = await sql`
      INSERT INTO rate_limits (key, count, window_start) VALUES (${k}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.window_start < now() - (${secs}::float8 * interval '1 second')
                     THEN 1 ELSE rate_limits.count + 1 END,
        window_start = CASE WHEN rate_limits.window_start < now() - (${secs}::float8 * interval '1 second')
                            THEN now() ELSE rate_limits.window_start END
      RETURNING count`;
    return rows[0].count > limit;
  } catch (err) {
    console.error("Rate limit error:", err?.message);
    return false; // if the limiter itself fails, do not block real users
  }
}

// The client IP as seen by the hosting proxy. The last entry is the one added by our own proxy,
// so a visitor cannot make up their own by sending an X-Forwarded-For header.
export function clientIp(req) {
  const parts = (req.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || req.headers.get("x-real-ip") || "unknown";
}
