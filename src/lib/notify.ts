import "server-only";
import { db } from "./db";
import { dictionaries, fmt, isLocale, type Dict, type Locale } from "./i18n";
import type { NotificationKind } from "@prisma/client";

/*
 * Delivery channels
 *  - in-app notification (always)
 *  - email: SMTP via nodemailer when SMTP_HOST is set, otherwise kept in the Outbox table (Admin → Outbox)
 *  - SMS:   Eskiz.uz when ESKIZ_EMAIL / ESKIZ_PASSWORD are set, otherwise Outbox
 * Every message is logged in Outbox with its delivery status.
 */
export function mailStatus() {
  return { email: !!process.env.SMTP_HOST, sms: !!(process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD) };
}

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const siteUrl = (path: string) => `${SITE()}${path.startsWith("/") ? path : `/${path}`}`;

type Mailer = { sendMail: (o: Record<string, unknown>) => Promise<unknown> };
let transport: Mailer | null | undefined;
async function mailer(): Promise<Mailer | null> {
  if (transport !== undefined) return transport;
  if (!process.env.SMTP_HOST) return (transport = null);
  const nodemailer = await import("nodemailer");
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  }) as unknown as Mailer;
  return transport;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function htmlMail(title: string, text: string, link?: { href: string; label: string }) {
  return `<!doctype html><html><body style="margin:0;background:#070b16;font-family:Inter,Arial,sans-serif;color:#f1f5ff">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<div style="font-weight:700;letter-spacing:.08em">SMARTVISION <span style="color:#5b9dff">AI</span></div>
<div style="margin-top:20px;background:#0d1324;border:1px solid #1f2a44;border-radius:16px;padding:24px">
<h2 style="margin:0 0 12px;font-size:20px">${esc(title)}</h2>
<p style="margin:0;color:#94a3c4;line-height:1.6;white-space:pre-line">${esc(text)}</p>
${link ? `<p style="margin:24px 0 0"><a href="${esc(link.href)}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${esc(link.label)}</a></p><p style="margin:16px 0 0;font-size:12px;color:#5f6c8a;word-break:break-all">${esc(link.href)}</p>` : ""}
</div></div></body></html>`;
}

export async function sendEmail(to: string, subject: string, text: string, link?: { href: string; label: string }) {
  const body = link ? `${text}\n\n${link.label}: ${link.href}` : text;
  const row = await db.outbox.create({ data: { channel: "EMAIL", to, subject, body, status: "QUEUED" } });
  const m = await mailer();
  if (!m) return db.outbox.update({ where: { id: row.id }, data: { status: "OUTBOX_ONLY" } });
  try {
    await m.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text: body, html: htmlMail(subject, text, link) });
    return db.outbox.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date() } });
  } catch (e) {
    return db.outbox.update({ where: { id: row.id }, data: { status: "FAILED", error: String((e as Error).message).slice(0, 300) } });
  }
}

let eskizToken: { t: string; exp: number } | null = null;
async function eskiz() {
  if (eskizToken && eskizToken.exp > Date.now()) return eskizToken.t;
  const fd = new FormData();
  fd.set("email", process.env.ESKIZ_EMAIL!);
  fd.set("password", process.env.ESKIZ_PASSWORD!);
  const r = await fetch("https://notify.eskiz.uz/api/auth/login", { method: "POST", body: fd });
  const j = (await r.json()) as { data?: { token?: string } };
  if (!j.data?.token) throw new Error("Eskiz login failed");
  eskizToken = { t: j.data.token, exp: Date.now() + 20 * 86400000 };
  return eskizToken.t;
}

export async function sendSms(phone: string, text: string) {
  const to = phone.replace(/\D/g, "");
  const row = await db.outbox.create({ data: { channel: "SMS", to, body: text, status: "QUEUED" } });
  if (!mailStatus().sms) return db.outbox.update({ where: { id: row.id }, data: { status: "OUTBOX_ONLY" } });
  try {
    const fd = new FormData();
    fd.set("mobile_phone", to);
    fd.set("message", text.slice(0, 600));
    fd.set("from", process.env.ESKIZ_FROM || "4546");
    const r = await fetch("https://notify.eskiz.uz/api/message/sms/send", { method: "POST", body: fd, headers: { Authorization: `Bearer ${await eskiz()}` } });
    if (!r.ok) throw new Error(`Eskiz ${r.status}`);
    return db.outbox.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date() } });
  } catch (e) {
    return db.outbox.update({ where: { id: row.id }, data: { status: "FAILED", error: String((e as Error).message).slice(0, 300) } });
  }
}

type Text = (d: Dict) => { title: string; body: string };

/**
 * Notify users in their own language: in-app always; email / SMS depending on `level` and each user's preferences.
 *  level "info"     → in-app only
 *  level "important"→ in-app + email
 *  level "critical" → in-app + email + SMS (if the user enabled SMS)
 */
export async function notifyUsers(userIds: string[], kind: NotificationKind, text: Text, level: "info" | "important" | "critical" = "info", link?: string) {
  if (!userIds.length) return;
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, phone: true, locale: true, notifyEmail: true, notifySms: true, emailVerifiedAt: true, telegramChatId: true } });
  const dictOf = (l: string) => dictionaries[(isLocale(l) ? l : "uz") as Locale];
  await db.notification.createMany({ data: users.map((u) => ({ userId: u.id, kind, ...text(dictOf(u.locale)) })) });
  // Telegram for every level (camera alerts are sent separately with their photo and buttons — not repeated here)
  if (kind !== "EVENT" && users.some((u) => u.telegramChatId)) {
    const { sendText } = await import("./telegram");
    for (const u of users) {
      if (!u.telegramChatId) continue;
      const t = text(dictOf(u.locale));
      await sendText(u.telegramChatId, `🔔 ${t.title}\n${t.body}${link ? `\n${siteUrl(link)}` : ""}`).catch(() => {});
    }
  }
  if (level === "info") return;
  for (const u of users) {
    const d = dictOf(u.locale);
    const t = text(d);
    if (u.notifyEmail && u.emailVerifiedAt) await sendEmail(u.email, t.title, t.body, link ? { href: siteUrl(link), label: d.common.open } : undefined).catch(() => {});
    if (level === "critical" && u.notifySms && u.phone) await sendSms(u.phone, `SMARTVISION: ${t.title}. ${t.body}`).catch(() => {});
  }
}

export const tf = (key: keyof Dict["dash"]["notify"], bodyKey: keyof Dict["dash"]["notify"], vars: Record<string, string | number> = {}): Text => (d) => ({
  title: fmt(d.dash.notify[key], vars),
  body: fmt(d.dash.notify[bodyKey], vars),
});
