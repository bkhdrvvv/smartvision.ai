import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { audit } from "./auth";
import { PENDING_2FA_COOKIE, SESSION_COOKIE, SIGNUP_COOKIE, sessionCookieOptions, signPending2fa, signSession } from "./session";
import { tokenVersion, twoFactor } from "./security";

type U = { id: string; role: "CUSTOMER" | "ADMIN"; organizationId: string | null };

export function safeNext(n: unknown, fallback: string) {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}

export async function isBlocked(user: Pick<U, "role" | "organizationId">) {
  if (user.role === "ADMIN" || !user.organizationId) return false;
  const o = await db.organization.findUnique({ where: { id: user.organizationId }, select: { blockedAt: true } });
  return !!o?.blockedAt;
}

/** Issue the session cookie (after every check passed) and return where to go. */
export async function issueSession(user: U, nextRaw: unknown, how: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ uid: user.id, role: user.role, org: user.organizationId, tv: await tokenVersion(user.id) }), sessionCookieOptions);
  jar.delete(PENDING_2FA_COOKIE);
  jar.delete(SIGNUP_COOKIE);
  await audit(user.id, "auth.login", undefined, { how });
  const home = user.role === "ADMIN" ? "/admin" : "/dashboard";
  const next = safeNext(nextRaw, home);
  return user.role === "ADMIN" ? (next.startsWith("/admin") ? next : home) : next.startsWith("/admin") ? home : next;
}

/**
 * First factor done (password, email code or Google). Blocked → refuse; 2FA on → ask for the code;
 * otherwise sign in.
 */
export async function afterFirstFactor(user: U, nextRaw: unknown, how: string): Promise<{ blocked: true } | { need2fa: true } | { url: string }> {
  if (await isBlocked(user)) {
    await audit(user.id, "auth.login_blocked", undefined, { how });
    return { blocked: true };
  }
  if (await twoFactor.secret(user.id)) {
    (await cookies()).set(PENDING_2FA_COOKIE, await signPending2fa(user.id), { ...sessionCookieOptions, maxAge: 300 });
    return { need2fa: true };
  }
  return { url: await issueSession(user, nextRaw, how) };
}

/** Is Google sign-in configured? (button hidden otherwise) */
export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
