import "server-only";
import { headers } from "next/headers";

/**
 * Small fixed-window rate limiter (in memory, per server process).
 * Good enough for one Node instance; put Redis / a gateway limit in front when running several.
 */
const buckets = new Map<string, { n: number; reset: number }>();

export function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 50_000) for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
    return true;
  }
  b.n++;
  return b.n <= limit;
}

/**
 * The visitor's IP for rate limits. X-Forwarded-For / X-Real-IP are written by the *client* unless a proxy
 * overwrites them, so a password guesser could send a new fake IP with every try and never hit the limit.
 * They are trusted only with TRUST_PROXY=1, i.e. behind nginx that sets `X-Real-IP $remote_addr`
 * (then the right-most X-Forwarded-For entry — added by our own proxy — is used, never the client's).
 * Without a proxy every request counts as one source: limits stay strict instead of becoming bypassable.
 */
export async function clientIp() {
  if (process.env.TRUST_PROXY !== "1") return "direct";
  const h = await headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const chain = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain.at(-1) ?? "direct";
}
