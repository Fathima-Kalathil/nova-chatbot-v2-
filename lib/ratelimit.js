// Simple in-memory limiter (resets when the server restarts; fine for a small demo).
const store = new Map();

export function limited(key, limit, windowMs) {
  const now = Date.now();
  const recent = (store.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    store.set(key, recent);
    return true;
  }
  recent.push(now);
  store.set(key, recent);
  return false;
}

export function clientIp(req) {
  return (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
}
