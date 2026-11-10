import "server-only";
import { cookies, headers } from "next/headers";
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
  await loginAlert(user.id, how).catch(() => {});
  const home = user.role === "ADMIN" ? "/admin" : "/dashboard";
  const next = safeNext(nextRaw, home);
  return user.role === "ADMIN" ? (next.startsWith("/admin") ? next : home) : next.startsWith("/admin") ? home : next;
}

/** "Someone signed in to your account" on Telegram — device, address and time — so a stolen password is noticed at once. */
async function loginAlert(userId: string, how: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { telegramChatId: true, locale: true } });
  if (!u?.telegramChatId) return;
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "?";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /YaBrowser/.test(ua) ? "Yandex" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "brauzer";
  const ip = (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "—").trim();
  const at = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const way = { password: "parol", email_code: "email kod", google: "Google", "2fa": "2FA" }[how] ?? how;
  const T = {
    uz: `🔐 Akkauntingizga kirildi\n🕒 ${at}\n💻 ${br} · ${os}\n🌐 IP: ${ip}\n🔑 Usul: ${way}\n\nBu siz bo'lmasangiz — darhol saytda parolni o'zgartiring va «Boshqa barcha qurilmalardan chiqish» ni bosing.`,
    ru: `🔐 Вход в ваш аккаунт\n🕒 ${at}\n💻 ${br} · ${os}\n🌐 IP: ${ip}\n🔑 Способ: ${way}\n\nЕсли это были не вы — сразу смените пароль на сайте и нажмите «Выйти на всех устройствах».`,
    en: `🔐 New sign-in to your account\n🕒 ${at}\n💻 ${br} · ${os}\n🌐 IP: ${ip}\n🔑 Method: ${way}\n\nIf this wasn't you, change your password on the site now and press “Sign out everywhere”.`,
  } as const;
  const { sendText } = await import("./telegram");
  await sendText(u.telegramChatId, T[(u.locale as keyof typeof T) in T ? (u.locale as keyof typeof T) : "uz"]);
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
