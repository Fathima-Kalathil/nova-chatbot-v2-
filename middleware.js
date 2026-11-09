import { NextResponse } from "next/server";

// Extra protection against cross-site request forgery (CSRF): browsers always send an Origin header
// with POST/PATCH/DELETE requests, so a request coming from another website is refused.
// (Login itself is still checked inside every API route, not here.)
export function middleware(req) {
  const method = req.method;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const origin = req.headers.get("origin");
    const site = req.headers.get("sec-fetch-site");
    let sameOrigin = true;
    if (origin) {
      try {
        sameOrigin = new URL(origin).host === req.headers.get("host");
      } catch {
        sameOrigin = false;
      }
    }
    if (!sameOrigin || site === "cross-site") {
      return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
