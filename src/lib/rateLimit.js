// Simple in-memory rate limiter — Map of ip → list of request timestamps.
// Resets on server restart, which is fine for a single-instance deployment.
// For multi-instance (e.g. Vercel serverless), swap this out for a Redis-backed
// solution like `@upstash/ratelimit`. The interface stays identical.

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000; // 15-minute sliding window
const MAX_ATTEMPTS = 10;           // max login attempts per window per IP

// Returns true if the request is allowed, false if it should be blocked (429).
export function checkRateLimit(ip) {
  const key = ip || "unknown";
  const now = Date.now();

  // Drop timestamps outside the current window
  const recent = (attempts.get(key) || []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_ATTEMPTS) {
    return false; // blocked
  }

  recent.push(now);
  attempts.set(key, recent);
  return true; // allowed
}
