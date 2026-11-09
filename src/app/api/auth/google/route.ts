import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { OAUTH_COOKIE, sessionCookieOptions, signOauth } from "@/lib/session";
import { googleEnabled, safeNext } from "@/lib/login";
import { siteUrl } from "@/lib/notify";
import { clientIp, hit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Start "Sign in with Google" (OAuth 2.0 authorization code flow with PKCE + state). */
export async function GET(req: NextRequest) {
  if (!googleEnabled()) return NextResponse.redirect(siteUrl("/login?error=google_off"));
  if (!hit(`google:${await clientIp()}`, 30, 15 * 60_000)) return NextResponse.redirect(siteUrl("/login?error=too_many"));
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const sp = req.nextUrl.searchParams;
  const plan = (sp.get("plan") ?? "").replace(/[^\w-]/g, "").slice(0, 40);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: siteUrl("/api/auth/google/callback"),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, await signOauth({ state, verifier, next: safeNext(sp.get("next"), ""), plan }), { ...sessionCookieOptions, maxAge: 600 });
  return res;
}
