import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { EmailCodePurpose } from "@prisma/client";
import { db } from "./db";
import { sendEmail } from "./notify";
import { dictionaries, isLocale, type Locale } from "./i18n";

/** 6-digit codes sent by email: sign-up (prove the address first) and password-less sign-in. */
export const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

const hash = (email: string, purpose: EmailCodePurpose, code: string) =>
  createHash("sha256").update(`${email}:${purpose}:${code}:${process.env.AUTH_SECRET}`).digest();

/** Create a new code (older unused codes for the same email + purpose stop working) and email it. */
export async function issueEmailCode(email: string, purpose: EmailCodePurpose, locale: string) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.emailCode.updateMany({ where: { email, purpose, usedAt: null }, data: { usedAt: new Date() } });
  await db.emailCode.create({ data: { email, purpose, codeHash: hash(email, purpose, code).toString("hex"), expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000) } });
  // housekeeping: forget codes older than a day
  await db.emailCode.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86400_000) } } }).catch(() => {});
  const d = dictionaries[(isLocale(locale) ? locale : "uz") as Locale].auth;
  const subject = (purpose === "REGISTER" ? d.codeSubjectRegister : d.codeSubjectLogin).replace("{c}", code);
  await sendEmail(email, subject, d.codeBody.replace("{c}", code).replace("{m}", String(CODE_TTL_MIN)));
}

/** Check (and burn on success) the latest code. "attempts" = too many wrong tries → a new code is needed. */
export async function checkEmailCode(email: string, purpose: EmailCodePurpose, code: string): Promise<"ok" | "invalid" | "attempts"> {
  const clean = code.replace(/\D/g, "");
  const row = await db.emailCode.findFirst({ where: { email, purpose, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!row) return "invalid";
  if (row.attempts >= MAX_ATTEMPTS) return "attempts";
  const ok = clean.length === 6 && timingSafeEqual(Buffer.from(row.codeHash, "hex"), hash(email, purpose, clean));
  if (!ok) {
    const n = await db.emailCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return n.attempts >= MAX_ATTEMPTS ? "attempts" : "invalid";
  }
  // single use: only the request that flips usedAt wins (no double use under concurrency)
  const won = await db.emailCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return won.count === 1 ? "ok" : "invalid";
}
