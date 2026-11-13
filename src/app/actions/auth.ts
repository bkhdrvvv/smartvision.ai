"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { PENDING_2FA_COOKIE, SESSION_COOKIE, SIGNUP_COOKIE, sessionCookieOptions, signSession, signSignup, verifyPending2fa, verifySignup } from "@/lib/session";
import { loginSchema, registerSchema } from "@/lib/validators";
import { getDict } from "@/lib/i18n/server";
import { fmt, isLocale, type Locale } from "@/lib/i18n";
import { featureDicts } from "@/lib/i18n/features";
import { sendEmail, siteUrl } from "@/lib/notify";
import { clientIp, hit } from "@/lib/ratelimit";
import { bumpTokenVersion, twoFactor } from "@/lib/security";
import { consumeAuthToken, sendResetEmail, sendVerificationEmail } from "@/lib/authTokens";
import { verifyTotp } from "@/lib/totp";
import { afterFirstFactor, issueSession } from "@/lib/login";
import { checkEmailCode, issueEmailCode } from "@/lib/emailCode";
import { LEGAL_VERSION } from "@/lib/legal";

export type FormState =
  | { error?: string; fields?: Record<string, string>; need2fa?: boolean; fieldErrors?: string[]; codeSent?: boolean; ok?: boolean }
  | undefined;

let dummyHash: string | undefined;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const normEmail = (v: FormDataEntryValue | null) => String(v ?? "").trim().toLowerCase().slice(0, 200);

/** Rate limits for sending a code: 1 per 45 s and 5 per hour per address, 15 per hour per IP. */
async function canSendCode(email: string) {
  const ip = await clientIp();
  if (!hit(`code-gap:${email}`, 1, 45_000)) return "wait" as const;
  if (!hit(`code-mail:${email}`, 5, 60 * 60_000) || !hit(`code-ip:${ip}`, 15, 60 * 60_000)) return "many" as const;
  return "ok" as const;
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const { d, locale } = await getDict();
  const ip = await clientIp();
  const jar = await cookies();
  const mode = form.get("resend") ? "code-send" : String(form.get("mode") ?? "password");
  const next = form.get("next");

  const finish = async (user: { id: string; role: "CUSTOMER" | "ADMIN"; organizationId: string | null }, how: string, email: string): Promise<FormState> => {
    const r = await afterFirstFactor(user, next, how);
    if ("blocked" in r) return { error: d.auth.blocked, fields: { email } };
    if ("need2fa" in r) return { need2fa: true, fields: { email } };
    redirect(r.url);
  };

  // ── step 2: authenticator code after the first factor (accounts with 2FA) ──
  const code = String(form.get("code") ?? "");
  const pendingUid = await verifyPending2fa(jar.get(PENDING_2FA_COOKIE)?.value);
  if (mode === "2fa") {
    if (!pendingUid) return { error: d.auth.codeInvalid };
    if (!hit(`2fa:${pendingUid}`, 6, 15 * 60_000)) return { error: d.auth.tooMany, need2fa: true };
    const user = await db.user.findUnique({ where: { id: pendingUid } });
    const secret = user ? await twoFactor.secret(user.id) : null;
    if (!user || !secret || !verifyTotp(secret, code)) {
      await audit(pendingUid, "auth.2fa_failed");
      return { error: d.auth.codeInvalid, need2fa: true };
    }
    redirect(await issueSession(user, next, "2fa"));
  }

  // ── sign in with a code sent to the email (no password) ──
  if (mode === "code-send" || mode === "code-verify") {
    const email = normEmail(form.get("email"));
    if (!EMAIL_RE.test(email)) return { error: d.auth.invalidEmail, fields: { email, mode: "code" } };
    if (mode === "code-send") {
      const lim = await canSendCode(email);
      if (lim !== "ok") return { error: lim === "wait" ? d.auth.codeWait : d.auth.tooMany, fields: { email, mode: "code" }, codeSent: lim === "wait" };
      const user = await db.user.findUnique({ where: { email }, select: { id: true, locale: true } });
      // same answer whether or not the account exists (no account enumeration)
      if (user) await issueEmailCode(email, "LOGIN", user.locale || locale);
      return { codeSent: true, fields: { email, mode: "code" } };
    }
    if (!hit(`code-check-ip:${ip}`, 30, 15 * 60_000)) return { error: d.auth.tooMany, codeSent: true, fields: { email, mode: "code" } };
    const r = await checkEmailCode(email, "LOGIN", code);
    if (r !== "ok") return { error: r === "attempts" ? d.auth.codeAttempts : d.auth.codeInvalid, codeSent: true, fields: { email, mode: "code" } };
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return { error: d.auth.codeInvalid, codeSent: true, fields: { email, mode: "code" } };
    if (!user.emailVerifiedAt) await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }); // the code proves the address
    return finish(user, "email_code", email);
  }

  // ── email + password ──
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: d.auth.invalid };
  const { email, password } = parsed.data;
  // Throttle per (email + IP): a stranger can't lock the real owner out from elsewhere.
  // A looser per-email limit still slows attacks spread over many IPs; plus a per-IP limit against spraying.
  if (!hit(`login:${email}|${ip}`, 8, 15 * 60_000) || !hit(`login-mail:${email}`, 20, 15 * 60_000) || !hit(`login-ip:${ip}`, 30, 15 * 60_000))
    return { error: d.auth.tooMany, fields: { email } };

  const user = await db.user.findUnique({ where: { email } });
  // compare against a dummy hash when the user doesn't exist to keep timing uniform
  dummyHash ??= await bcrypt.hash("dummy-password", 12);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !ok) {
    if (user) await audit(user.id, "auth.login_failed", undefined, { ip });
    return { error: d.auth.invalid, fields: { email } };
  }
  return finish(user, "password", email);
}

/* ───── sign-up, step 1: prove the email with a code ───── */
export async function signupEmailAction(_: FormState, form: FormData): Promise<FormState> {
  const { d, locale } = await getDict();
  const mode = form.get("resend") ? "send" : String(form.get("mode") ?? "send");
  const email = normEmail(form.get("email"));
  const plan = String(form.get("plan") ?? "");
  if (!EMAIL_RE.test(email)) return { error: d.auth.invalidEmail, fields: { email }, fieldErrors: ["email"] };

  if (mode === "send") {
    const lim = await canSendCode(email);
    if (lim !== "ok") return { error: lim === "wait" ? d.auth.codeWait : d.auth.tooMany, fields: { email }, codeSent: lim === "wait" };
    // Same answer whether or not the address is registered (nobody can probe who uses the service).
    // The real owner of an existing account gets a "you already have an account — sign in" email instead of a code.
    const existing = await db.user.findUnique({ where: { email }, select: { locale: true } });
    if (existing) {
      const z = featureDicts[(isLocale(existing.locale) ? existing.locale : locale) as Locale].z;
      await sendEmail(email, z.existsMailSubject, z.existsMailBody, { href: siteUrl("/login"), label: z.existsMailLink }).catch(() => {});
    } else await issueEmailCode(email, "REGISTER", locale);
    return { codeSent: true, fields: { email } };
  }

  if (!hit(`code-check-ip:${await clientIp()}`, 30, 15 * 60_000)) return { error: d.auth.tooMany, codeSent: true, fields: { email } };
  const r = await checkEmailCode(email, "REGISTER", String(form.get("code") ?? ""));
  if (r !== "ok") return { error: r === "attempts" ? d.auth.codeAttempts : d.auth.codeInvalid, codeSent: true, fields: { email } };
  (await cookies()).set(SIGNUP_COOKIE, await signSignup({ email }), { ...sessionCookieOptions, maxAge: 30 * 60 });
  redirect(plan ? `/register?plan=${encodeURIComponent(plan)}` : "/register");
}

/** "Wrong email" — forget the proven email (or Google profile) and start again. */
export async function cancelSignup(form: FormData) {
  (await cookies()).delete(SIGNUP_COOKIE);
  const plan = String(form.get("plan") ?? "");
  redirect(plan ? `/register?plan=${encodeURIComponent(plan)}` : "/register");
}

/* ───── sign-up, step 2: details (only with a proven email: code or Google) ───── */
export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const { d, locale } = await getDict();
  const jar = await cookies();
  const proof = await verifySignup(jar.get(SIGNUP_COOKIE)?.value);
  if (!proof) return { error: d.auth.signupExpired };
  if (!hit(`register:${await clientIp()}`, 10, 60 * 60_000)) return { error: d.auth.tooMany };

  const raw = Object.fromEntries(["name", "orgName", "phone", "service", "password", "password2", "plan"].map((k) => [k, (form.get(k) as string | null) ?? undefined]));
  const { password2: _p2, password: _p, ...keep } = raw; // never echo passwords back to the browser
  const fields = keep as Record<string, string>;
  // Google sign-ups also choose a password, so email + password works later too.
  // (Only if they leave it empty they get an unusable random one — "forgot password" can set it later.)
  const viaGoogle = !!proof.gid;
  const noPassword = viaGoogle && !raw.password && !raw.password2;
  const password = noPassword ? randomBytes(32).toString("base64url") : raw.password;
  if (!noPassword && raw.password !== raw.password2) return { error: d.auth.passwordMismatch, fields, fieldErrors: ["password2"] };

  // explicit consent to the Terms of Use, Privacy Policy and personal data processing (Law on Personal Data)
  if (form.get("terms") !== "on") return { error: d.legalUi.mustAccept, fields, fieldErrors: ["terms"] };
  const parsed = registerSchema.safeParse({ ...raw, email: proof.email, password });
  if (!parsed.success) {
    const bad = Object.keys(parsed.error.flatten().fieldErrors);
    const names: Record<string, string> = { name: d.auth.name, orgName: d.auth.orgName, email: d.auth.email, phone: `${d.auth.phone} (+998 90 123 45 67)`, service: d.auth.service, password: d.auth.passwordMin };
    return { error: fmt(d.auth.checkFields, { f: bad.map((k) => names[k] ?? k).join(", ") }), fields, fieldErrors: bad };
  }
  const v = parsed.data;
  if (await db.user.findUnique({ where: { email: v.email } })) return { error: d.auth.exists, fields };

  let user;
  try {
    const hash = await bcrypt.hash(v.password, 12);
    // invite-a-friend: ?ref=<code> was remembered in a cookie by the site
    const refCode = jar.get("sv_ref")?.value?.slice(0, 40);
    const referrer = refCode ? await db.organization.findUnique({ where: { referralCode: refCode }, select: { id: true } }) : null;
    user = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: v.orgName, service: v.service, phone: v.phone, referredById: referrer?.id ?? null } });
      return tx.user.create({
        data: { email: v.email, name: v.name, phone: v.phone, passwordHash: hash, organizationId: org.id, locale, emailVerifiedAt: new Date(), googleId: proof.gid ?? null, termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION },
      });
    });
  } catch (e) {
    // two submits at the same moment with the same email → unique constraint
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: d.auth.exists, fields };
    throw e;
  }
  jar.set(SESSION_COOKIE, await signSession({ uid: user.id, role: user.role, org: user.organizationId, tv: 0 }), sessionCookieOptions);
  jar.delete(SIGNUP_COOKIE);
  jar.delete("sv_ref");
  await audit(user.id, "auth.register", undefined, { how: viaGoogle ? "google" : "email_code" });
  redirect(v.plan ? `/dashboard/subscription?plan=${encodeURIComponent(v.plan)}` : "/dashboard");
}

/* ───── email verification ───── */
export async function resendVerification(): Promise<FormState> {
  const { d, locale } = await getDict();
  const { getCurrentUser } = await import("@/lib/auth");
  const u = await getCurrentUser();
  if (!u) return { error: d.common.error };
  if (u.emailVerifiedAt) return { ok: true, error: undefined };
  if (!hit(`verify-resend:${u.id}`, 3, 60 * 60_000)) return { error: d.auth.tooMany };
  await sendVerificationEmail({ ...u, locale });
  return { ok: true };
}

/* ───── forgot / reset password ───── */
export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const { d, locale } = await getDict();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!hit(`reset-ip:${await clientIp()}`, 10, 60 * 60_000) || !hit(`reset-mail:${email}`, 3, 60 * 60_000)) return { error: d.auth.tooMany };
  const user = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? await db.user.findUnique({ where: { email } }) : null;
  // same answer whether or not the account exists (no account enumeration)
  if (user) {
    await sendResetEmail({ ...user, locale: user.locale || locale });
    await audit(user.id, "auth.reset_requested");
  }
  return { ok: true };
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const { d } = await getDict();
  const raw = String(form.get("t") ?? "");
  const pw = String(form.get("password") ?? "");
  const pw2 = String(form.get("password2") ?? "");
  if (pw.length < 8) return { error: d.auth.passwordMin };
  if (pw !== pw2) return { error: d.auth.passwordMismatch };
  if (!hit(`reset-use:${await clientIp()}`, 20, 60 * 60_000)) return { error: d.auth.tooMany };
  const uid = await consumeAuthToken(raw, "RESET_PASSWORD");
  if (!uid) return { error: d.auth.linkInvalid };
  await db.user.update({ where: { id: uid }, data: { passwordHash: await bcrypt.hash(pw, 12), emailVerifiedAt: new Date() } }); // the link proves the email
  await bumpTokenVersion(uid); // sign out every device
  await audit(uid, "auth.password_reset");
  return { ok: true };
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
