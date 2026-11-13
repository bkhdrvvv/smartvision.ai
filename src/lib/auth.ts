import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
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
  return { uid: u.id, role: u.role, org: u.organizationId } as const;
});

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
  if (user.role !== "ADMIN") notFound();
  if (!(await adminReady(user.id))) redirect("/secure/2fa");
  return user;
}

export async function audit(userId: string | null, action: string, target?: string, meta?: object) {
  await db.auditLog.create({ data: { userId, action, target, meta: meta as never } });
}
