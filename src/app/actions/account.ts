"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { audit, getCurrentUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { SESSION_COOKIE, sessionCookieFor, signSession } from "@/lib/session";
import { bumpTokenVersion, twoFactor } from "@/lib/security";
import { newSecret, otpauthUrl, verifyTotp } from "@/lib/totp";
import { hit } from "@/lib/ratelimit";

export type AccountResult = { ok?: boolean; error?: string; message?: string; secret?: string; url?: string; qr?: string } | undefined;

/** Re-issue this device's session with the new token version so only *other* devices are signed out. */
async function reissue(user: { id: string; role: "CUSTOMER" | "ADMIN"; organizationId: string | null }, tv: number) {
  (await cookies()).set(SESSION_COOKIE, await signSession({ uid: user.id, role: user.role, org: user.organizationId, tv }), sessionCookieFor(user.role));
}

export async function changePassword(_: AccountResult, form: FormData): Promise<AccountResult> {
  const u = await getCurrentUser();
  const { d } = await getDict();
  if (!u) return { error: d.common.error };
  if (!hit(`pwchange:${u.id}`, 5, 15 * 60_000)) return { error: d.auth.tooMany };
  const cur = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const next2 = String(form.get("next2") ?? next);
  if (next.length < 8) return { error: d.auth.passwordMin };
  if (next !== next2) return { error: d.auth.passwordMismatch };
  if (!(await bcrypt.compare(cur, u.passwordHash))) return { error: d.auth.wrongCurrent };
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  const tv = await bumpTokenVersion(u.id); // every other device is signed out
  await reissue(u, tv);
  await audit(u.id, "auth.password_change");
  return { ok: true, message: d.auth.passwordChanged };
}

/** Sign out on all other devices (e.g. a lost phone) */
export async function signOutEverywhere(): Promise<AccountResult> {
  const u = await getCurrentUser();
  const { d } = await getDict();
  if (!u) return { error: d.common.error };
  await reissue(u, await bumpTokenVersion(u.id));
  await audit(u.id, "auth.signout_everywhere");
  return { ok: true, message: d.auth.signedOutOthers };
}

/* ───── 2FA (authenticator app) ───── */
export async function start2fa(): Promise<AccountResult> {
  const u = await getCurrentUser();
  const { d, f } = await getDict();
  if (!u) return { error: d.common.error };
  if (await twoFactor.secret(u.id)) return { error: f.z.already2fa };
  const secret = newSecret();
  await twoFactor.setPending(u.id, secret);
  const url = otpauthUrl(secret, u.email);
  // QR made here on the server (the secret never goes to any outside service): scan it with the phone app
  const { toString } = await import("qrcode");
  const qr = await toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b1226", light: "#ffffff" } });
  return { ok: true, secret, url, qr };
}

export async function confirm2fa(code: string): Promise<AccountResult> {
  const u = await getCurrentUser();
  const { d } = await getDict();
  if (!u) return { error: d.common.error };
  if (!hit(`2fa-setup:${u.id}`, 10, 15 * 60_000)) return { error: d.auth.tooMany };
  const pending = await twoFactor.pending(u.id);
  if (!pending || !verifyTotp(pending, code)) return { error: d.auth.codeInvalid };
  await twoFactor.enable(u.id, pending);
  await reissue(u, await bumpTokenVersion(u.id)); // sessions opened without 2FA end now
  await audit(u.id, "auth.2fa_enabled");
  return { ok: true, message: d.auth.twofaOn };
}

export async function disable2fa(code: string): Promise<AccountResult> {
  const u = await getCurrentUser();
  const { d } = await getDict();
  if (!u) return { error: d.common.error };
  if (!hit(`2fa-setup:${u.id}`, 10, 15 * 60_000)) return { error: d.auth.tooMany };
  const secret = await twoFactor.secret(u.id);
  if (!secret || !verifyTotp(secret, code)) return { error: d.auth.codeInvalid };
  await twoFactor.disable(u.id);
  await audit(u.id, "auth.2fa_disabled");
  return { ok: true, message: d.auth.twofaOff };
}

/** The signed-in user accepts the current Terms of Use + Privacy Policy (consent to personal data processing). */
export async function acceptTerms() {
  const { getCurrentUser } = await import("@/lib/auth");
  const { LEGAL_VERSION } = await import("@/lib/legal");
  const u = await getCurrentUser();
  if (!u) return;
  await db.user.update({ where: { id: u.id }, data: { termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION } });
  await audit(u.id, "legal.accept", undefined, { version: LEGAL_VERSION });
}
