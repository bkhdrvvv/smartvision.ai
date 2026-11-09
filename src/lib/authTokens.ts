import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { AuthTokenKind } from "@prisma/client";
import { db } from "./db";
import { sendEmail, siteUrl } from "./notify";
import { dictionaries, isLocale, type Locale } from "./i18n";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const TTL: Record<AuthTokenKind, number> = { VERIFY_EMAIL: 48 * 3600_000, RESET_PASSWORD: 60 * 60_000 };

/** Create a one-time link token (only its hash is stored). Older unused tokens of the same kind are revoked. */
export async function createAuthToken(userId: string, kind: AuthTokenKind) {
  await db.authToken.deleteMany({ where: { userId, kind, usedAt: null } });
  const raw = randomBytes(32).toString("base64url");
  await db.authToken.create({ data: { userId, kind, tokenHash: hash(raw), expiresAt: new Date(Date.now() + TTL[kind]) } });
  return raw;
}

/** Validate and burn a token. Returns the user id, or null if unknown / expired / already used. */
export async function consumeAuthToken(raw: string, kind: AuthTokenKind, peek = false) {
  if (!raw || raw.length < 20) return null;
  const t = await db.authToken.findUnique({ where: { tokenHash: hash(raw) } });
  if (!t || t.kind !== kind || t.usedAt || t.expiresAt < new Date()) return null;
  if (!peek) await db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  return t.userId;
}

const dictFor = (l: string) => dictionaries[(isLocale(l) ? l : "uz") as Locale];

export async function sendVerificationEmail(user: { id: string; email: string; name: string; locale: string }) {
  const d = dictFor(user.locale);
  const raw = await createAuthToken(user.id, "VERIFY_EMAIL");
  await sendEmail(user.email, d.auth.verifySubject, d.auth.verifyBody.replace("{n}", user.name), { href: siteUrl(`/verify-email?t=${raw}`), label: d.auth.verifyButton });
}

export async function sendResetEmail(user: { id: string; email: string; name: string; locale: string }) {
  const d = dictFor(user.locale);
  const raw = await createAuthToken(user.id, "RESET_PASSWORD");
  await sendEmail(user.email, d.auth.resetSubject, d.auth.resetBody.replace("{n}", user.name), { href: siteUrl(`/reset-password?t=${raw}`), label: d.auth.resetButton });
}
