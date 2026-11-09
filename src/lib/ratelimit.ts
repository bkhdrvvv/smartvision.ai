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

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "local").trim();
}
