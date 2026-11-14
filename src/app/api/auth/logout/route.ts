import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { revokeSessionToken } from "@/lib/auth";

/**
 * Clears a stale/invalid session and returns to login (avoids redirect loops).
 * CSRF guard: another website can't sign a user out by embedding this URL — a cross-site request
 * only clears the cookie when the session is already invalid. Normal sign-out uses the POST server action.
 */
export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  const crossSite = req.headers.get("sec-fetch-site") === "cross-site";
  const cookie = req.headers.get("cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (crossSite && (await verifySession(cookie))) return NextResponse.redirect(new URL("/", req.url));
  await revokeSessionToken(cookie); // same-site sign-out link: the token dies on the server too
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
