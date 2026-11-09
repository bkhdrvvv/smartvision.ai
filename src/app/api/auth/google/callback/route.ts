import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { OAUTH_COOKIE, SIGNUP_COOKIE, sessionCookieOptions, signSignup, verifyOauth } from "@/lib/session";
import { afterFirstFactor, googleEnabled } from "@/lib/login";
import { siteUrl } from "@/lib/notify";

export const dynamic = "force-dynamic";

type GoogleUser = { sub: string; email?: string; email_verified?: boolean; name?: string };

const fail = (code: string) => NextResponse.redirect(siteUrl(`/login?error=${code}`));

/** Google redirects back here with ?code&state. */
export async function GET(req: NextRequest) {
  if (!googleEnabled()) return fail("google_off");
  const jar = await cookies();
  const saved = await verifyOauth(jar.get(OAUTH_COOKIE)?.value);
  jar.delete(OAUTH_COOKIE);
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return fail("google_cancel"); // the user pressed "Cancel" at Google
  const code = sp.get("code");
  if (!saved || !code || sp.get("state") !== saved.state) return fail("google");

  // exchange the code (server-to-server, with the client secret and the PKCE verifier)
  let profile: GoogleUser;
  try {
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: siteUrl("/api/auth/google/callback"),
        grant_type: "authorization_code",
        code_verifier: saved.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tok.ok) throw new Error(`token ${tok.status}: ${await tok.text()}`);
    const { access_token } = (await tok.json()) as { access_token: string };
    // profile straight from Google over TLS with our fresh access token
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(10_000) });
    if (!info.ok) throw new Error(`userinfo ${info.status}`);
    profile = (await info.json()) as GoogleUser;
  } catch (e) {
    console.error("[google]", e);
    return fail("google");
  }
  const email = profile.email?.trim().toLowerCase();
  if (!profile.sub || !email || profile.email_verified !== true) return fail("google_unverified");

  // 1) already linked  2) same (Google-verified) email → link  3) new → sign-up form with the proven email
  let user = await db.user.findUnique({ where: { googleId: profile.sub } });
  if (!user) {
    const byEmail = await db.user.findUnique({ where: { email } });
    if (byEmail) {
      user = await db.user.update({ where: { id: byEmail.id }, data: { googleId: profile.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date() } });
      await audit(user.id, "auth.google_linked");
    }
  }
  if (!user) {
    jar.set(SIGNUP_COOKIE, await signSignup({ email, gid: profile.sub, name: profile.name?.slice(0, 80) }), { ...sessionCookieOptions, maxAge: 30 * 60 });
    return NextResponse.redirect(siteUrl(saved.plan ? `/register?plan=${encodeURIComponent(saved.plan)}` : "/register"));
  }

  const r = await afterFirstFactor(user, saved.next, "google");
  if ("blocked" in r) return fail("blocked");
  if ("need2fa" in r) return NextResponse.redirect(siteUrl(`/login?step=2fa${saved.next ? `&next=${encodeURIComponent(saved.next)}` : ""}`));
  return NextResponse.redirect(siteUrl(r.url));
}
