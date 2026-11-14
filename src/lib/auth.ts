import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";
import { tokenVersion, twoFactor } from "./security";

/**
 * Verified session with role & organization re-read from the database (once per request).
 * The JWT alone is not trusted for authorization: a demoted / deleted user or a user moved to
 * another organization loses access immediately instead of when the 7-day token expires.
 */
const getSessionRaw = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const s = await verifySession(token);
  if (!s) return null;
  const u = await db.user.findUnique({ where: { id: s.uid }, select: { id: true, role: true, organizationId: true, organization: { select: { blockedAt: true } } } }).catch(() => null);
  if (!u) return null;
  // customer account blocked by an admin → every session ends at once
  if (u.role !== "ADMIN" && u.organization?.blockedAt) return null;
  // signed out everywhere (e.g. password changed on another device) → this token is no longer valid
  if ((s.tv ?? 0) !== (await tokenVersion(u.id))) return null;
  // this very token was signed out ("Sign out" pressed) → a copied cookie is dead too
  if (s.jti && (await db.setting.findUnique({ where: { key: `revoked:${s.jti}` }, select: { key: true } }))) return null;
  return { uid: u.id, role: u.role, org: u.organizationId } as const;
});

/** "Sign out": kill this session token on the server (not only in the browser). Other devices stay signed in. */
export async function revokeSessionToken(token: string | undefined) {
  const s = (await verifySession(token)) as (Awaited<ReturnType<typeof verifySession>> & { exp?: number }) | null;
  if (!s?.jti) return;
  const until = new Date(((s.exp ?? 0) * 1000) || Date.now() + 8 * 86400_000).toISOString();
  await db.setting.upsert({ where: { key: `revoked:${s.jti}` }, create: { key: `revoked:${s.jti}`, value: until }, update: { value: until } }).catch(() => {});
}

/** Forget revoked tokens that have expired anyway (keeps the table small). */
export async function purgeRevokedTokens() {
  const rows = await db.setting.findMany({ where: { key: { startsWith: "revoked:" } }, select: { key: true, value: true } });
  const now = new Date().toISOString();
  const old = rows.filter((r) => r.value < now).map((r) => r.key);
  if (old.length) await db.setting.deleteMany({ where: { key: { in: old } } });
  return old.length;
}

/** Is this an admin who already turned on two-step sign-in? (admin powers need it) */
export const adminReady = cache(async (uid: string) => !!(await twoFactor.secret(uid)));

/**
 * Session for data access (API routes, pages). An admin without 2FA gets nothing here: until two-step
 * sign-in is on, the account can only open /secure/2fa (which uses getCurrentUser).
 */
export const getSession = cache(async () => {
  const s = await getSessionRaw();
  if (s?.role === "ADMIN" && !(await adminReady(s.uid))) return null;
  return s;
});

export const getCurrentUser = cache(async () => {
  const s = await getSessionRaw();
  if (!s) return null;
  return db.user.findUnique({
    where: { id: s.uid },
    include: { organization: true },
  });
});

export async function requireCustomer() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");
  if (user.role === "ADMIN") redirect("/admin");
  if (!user.organization) redirect("/api/auth/logout");
  return user as typeof user & { organization: NonNullable<typeof user.organization> };
}

/**
 * Admin only. Two-step sign-in is mandatory for admins: until the authenticator app is set up,
 * every admin page and action sends them to /secure/2fa (the only thing they can do).
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");
  // A non-admin only gets here by forging a server-action call (pages under /admin are a 404 in middleware).
  // Send them to the sign-out route handler: no page is rendered for the answer, so it returns at once.
  // (notFound(), an error or a redirect to a page made Next re-render inside the forged call and the request
  // never finished — each one held server memory, so a customer could wear the server down.)
  if (user.role !== "ADMIN") {
    await audit(user.id, "security.forged_admin_action").catch(() => {});
    redirect("/api/auth/logout");
  }
  if (!(await adminReady(user.id))) redirect("/secure/2fa");
  return user;
}

export async function audit(userId: string | null, action: string, target?: string, meta?: object) {
  await db.auditLog.create({ data: { userId, action, target, meta: meta as never } });
}
