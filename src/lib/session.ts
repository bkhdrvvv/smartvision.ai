// Edge-safe session helpers (used by middleware and server code)
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sv_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  uid: string;
  role: "CUSTOMER" | "ADMIN";
  org: string | null;
  /** token version — must match the user's current one (bumped on password change) */
  tv?: number;
};

export const PENDING_2FA_COOKIE = "sv_2fa";

/** Short-lived proof that the password step succeeded; the 2FA code finishes the login. */
export async function signPending2fa(uid: string) {
  return new SignJWT({ uid, p2fa: true }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(key());
}

export async function verifyPending2fa(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.p2fa === true ? String(payload.uid) : null;
  } catch {
    return null;
  }
}

/**
 * Proof for the sign-up form that the email belongs to the visitor: either a correct email code
 * or a Google account (then gid + name come from Google and no password is needed).
 */
export const SIGNUP_COOKIE = "sv_signup";
export type SignupProof = { email: string; gid?: string; name?: string };

export async function signSignup(p: SignupProof) {
  return new SignJWT({ ...p, su: true }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30m").sign(key());
}

export async function verifySignup(token: string | undefined): Promise<SignupProof | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.su !== true || typeof payload.email !== "string") return null;
    return { email: payload.email, gid: typeof payload.gid === "string" ? payload.gid : undefined, name: typeof payload.name === "string" ? payload.name : undefined };
  } catch {
    return null;
  }
}

/** OAuth round-trip state (CSRF state + PKCE verifier + where to go afterwards), 10 minutes */
export const OAUTH_COOKIE = "sv_oauth";
export async function signOauth(p: { state: string; verifier: string; next: string; plan: string }) {
  return new SignJWT({ ...p, oa: true }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(key());
}
export async function verifyOauth(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.oa !== true) return null;
    return { state: String(payload.state), verifier: String(payload.verifier), next: String(payload.next ?? ""), plan: String(payload.plan ?? "") };
  } catch {
    return null;
  }
}

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (min 32 chars)");
  return new TextEncoder().encode(s);
}

/** Admins are signed out after 12 hours (customers stay signed in for 7 days). */
export const ADMIN_MAX_AGE = 60 * 60 * 12;
export const maxAgeFor = (role: string) => (role === "ADMIN" ? ADMIN_MAX_AGE : MAX_AGE);

export async function signSession(p: SessionPayload) {
  return new SignJWT(p)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeFor(p.role)}s`)
    .sign(key());
}

/** Cookie options for a session of this role (the cookie lives exactly as long as the token). */
export const sessionCookieFor = (role: string) => ({ ...sessionCookieOptions, maxAge: maxAgeFor(role) });

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.p2fa || payload.su || payload.oa || typeof payload.role !== "string") return null; // helper tokens are never a session
    return { uid: String(payload.uid), role: payload.role as SessionPayload["role"], org: (payload.org as string) ?? null, tv: Number(payload.tv) || 0 };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  // Secure cookies only over HTTPS: on plain http (e.g. http://192.168.1.7:3000 from a phone in the same Wi-Fi)
  // browsers silently drop Secure cookies and sign-in would never stick. Behind a domain with HTTPS this is on.
  secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
  path: "/",
  maxAge: MAX_AGE,
};
