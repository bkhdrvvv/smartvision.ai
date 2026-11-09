"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit, requireAdmin, requireCustomer, getCurrentUser } from "@/lib/auth";
import { botLink, botToken, sendText, setBotToken, userLinkCode } from "@/lib/telegram";
import { deleteFace, saveFace } from "@/lib/faces";
import { askCustomerAi } from "@/lib/customerAi";
import { planFeatures } from "@/lib/plan";
import { aiConfigured, type ChatTurn } from "@/lib/adminAi";
import { createAuthToken } from "@/lib/authTokens";
import { sendEmail, siteUrl } from "@/lib/notify";
import { hit } from "@/lib/ratelimit";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import type { ActionResult } from "./customer";

/* ───── roles inside a customer organization ───── */
async function requireRole(...roles: string[]) {
  const u = await requireCustomer();
  if (!roles.includes(u.orgRole)) throw new Error("forbidden");
  return u;
}
const editor = () => requireRole("OWNER", "MEMBER");
const owner = () => requireRole("OWNER");

/* ───── Telegram ───── */
/** Deep link that links the signed-in user's Telegram (customer or admin). */
export async function telegramConnectLink(): Promise<{ url?: string; error?: string }> {
  const u = await getCurrentUser();
  if (!u) return { error: "auth" };
  if (!(await botToken())) return { error: "no_bot" };
  const url = await botLink(`u_${await userLinkCode(u.id)}`);
  return url ? { url } : { error: "no_bot" };
}

export async function telegramStatus(): Promise<{ linked: boolean; name: string | null }> {
  const u = await getCurrentUser();
  return { linked: !!u?.telegramChatId, name: u?.telegramName ?? null };
}

export async function telegramDisconnect() {
  const u = await getCurrentUser();
  if (!u) return;
  if (u.telegramChatId) await sendText(u.telegramChatId, "🔕").catch(() => {});
  await db.user.update({ where: { id: u.id }, data: { telegramChatId: null, telegramName: null } });
  revalidatePath("/dashboard/settings");
  revalidatePath("/admin/settings");
}

/* ───── guard mode ───── */
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export async function saveGuard(_: ActionResult, form: FormData): Promise<ActionResult> {
  const u = await editor();
  const p = z.object({ mode: z.enum(["auto", "custom", "always", "off"]), from: HHMM, to: HHMM }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "invalid" };
  await db.organization.update({ where: { id: u.organization.id }, data: { guardMode: p.data.mode, guardFrom: p.data.from, guardTo: p.data.to } });
  await audit(u.id, "org.guard", u.organization.id, p.data);
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/* ───── speaker warning ───── */
export async function setSpeaker(enabled: boolean, verified?: boolean) {
  const u = await editor();
  await db.organization.update({
    where: { id: u.organization.id },
    data: { speakerEnabled: enabled, ...(verified === true && { speakerVerifiedAt: new Date() }), ...((!enabled || verified === false) && { speakerVerifiedAt: null }) },
  });
  revalidatePath("/dashboard", "layout");
}

export async function setWeekly(on: boolean) {
  const u = await editor();
  await db.organization.update({ where: { id: u.organization.id }, data: { weeklyReport: on } });
  revalidatePath("/dashboard/settings");
}

/* ───── team ───── */
export async function inviteMember(_: ActionResult, form: FormData): Promise<ActionResult> {
  const u = await owner();
  const { f, locale } = await getDict();
  if (!hit(`invite:${u.id}`, 10, 60 * 60_000)) return { error: "too_many" };
  if (!(await planFeatures(u.organization.id)).has("team")) return { error: "plan" };
  const p = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), role: z.enum(["MEMBER", "VIEWER"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "invalid" };
  if (await db.user.findUnique({ where: { email: p.data.email } })) return { error: f.team.exists };
  const member = await db.user.create({
    data: {
      email: p.data.email, name: p.data.name, orgRole: p.data.role, organizationId: u.organization.id, locale,
      passwordHash: await bcrypt.hash(randomBytes(24).toString("base64url"), 10),
      termsAcceptedAt: null,
    },
  });
  const raw = await createAuthToken(member.id, "RESET_PASSWORD");
  // an invitation stays valid for 3 days (a normal reset link: 1 hour)
  await db.authToken.updateMany({ where: { userId: member.id, kind: "RESET_PASSWORD", usedAt: null }, data: { expiresAt: new Date(Date.now() + 72 * 3600_000) } });
  await sendEmail(member.email, f.team.mailSubject, fmt(f.team.mailText, { n: u.name, o: u.organization.name }), { href: siteUrl(`/reset-password?t=${raw}`), label: f.team.mailBtn });
  await audit(u.id, "team.invite", member.id, { email: member.email, role: p.data.role });
  revalidatePath("/dashboard/settings");
  return { ok: true, message: f.team.invited };
}

export async function removeMember(userId: string) {
  const u = await owner();
  if (userId === u.id) return;
  const m = await db.user.findFirst({ where: { id: userId, organizationId: u.organization.id } });
  if (!m || m.orgRole === "OWNER") return;
  await db.user.delete({ where: { id: m.id } });
  await audit(u.id, "team.remove", m.id, { email: m.email });
  revalidatePath("/dashboard/settings");
}

/* ───── students (school attendance) ───── */
export async function addStudent(_: ActionResult, form: FormData): Promise<ActionResult> {
  const u = await editor();
  const { f } = await getDict();
  const p = z.object({ name: z.string().trim().min(2).max(80), group: z.string().trim().max(20).optional() }).safeParse({ name: form.get("name"), group: form.get("group") || undefined });
  if (!p.success) return { error: "invalid" };
  if ((await db.student.count({ where: { organizationId: u.organization.id } })) >= 2000) return { error: "limit" };
  const file = form.get("photo");
  let photoKey: string | null = null;
  if (file instanceof File && file.size > 0) {
    photoKey = await saveFace(Buffer.from(await file.arrayBuffer()));
    if (!photoKey) return { error: f.students.badPhoto };
  }
  const kind = form.get("kind") === "TEACHER" ? "TEACHER" : "STUDENT";
  await db.student.create({ data: { organizationId: u.organization.id, name: p.data.name, group: p.data.group, kind, photoKey, parentCode: randomBytes(9).toString("base64url") } });
  revalidatePath("/dashboard/students");
  return { ok: true };
}

export async function removeStudent(id: string) {
  const u = await editor();
  const s = await db.student.findFirst({ where: { id, organizationId: u.organization.id } });
  if (!s) return;
  if (s.photoKey) await deleteFace(s.photoKey);
  await db.student.delete({ where: { id: s.id } });
  revalidatePath("/dashboard/students");
}

/* ───── forbidden zone ───── */
export async function saveZone(cameraId: string, points: [number, number][] | null, field: "zone" | "pen" = "zone"): Promise<ActionResult> {
  const u = await editor();
  const cam = await db.camera.findFirst({ where: { id: cameraId, organizationId: u.organization.id } });
  if (!cam) return { error: "not_found" };
  if (!(await planFeatures(u.organization.id)).has(field === "pen" ? "animalPen" : "zone")) return { error: "plan" };
  const ok = points === null || (Array.isArray(points) && points.length >= 3 && points.length <= 20 && points.every((p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number" && v >= 0 && v <= 1)));
  if (!ok) return { error: "invalid" };
  const clean = points?.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
  await db.camera.update({ where: { id: cam.id }, data: field === "pen" ? { pen: clean ?? Prisma.DbNull } : { zone: clean ?? Prisma.DbNull } });
  await audit(u.id, "camera.zone", cam.id, { points: clean?.length ?? 0 });
  revalidatePath("/dashboard/cameras");
  return { ok: true };
}

/* ───── customer AI assistant ───── */
export async function askCustomer(history: ChatTurn[]): Promise<{ text?: string; error?: string }> {
  const u = await requireCustomer();
  if (!aiConfigured()) return { error: "not_configured" };
  if (!hit(`cai:${u.id}`, 40, 60 * 60_000)) return { error: "too_many" };
  const turns = (Array.isArray(history) ? history : [])
    .filter((t) => (t?.role === "user" || t?.role === "assistant") && typeof t.text === "string" && t.text.trim())
    .slice(-16)
    .map((t) => ({ role: t.role, text: t.text.slice(0, 4000) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return { error: "empty" };
  return askCustomerAi(u.organization.id, turns);
}

/* ───── licence plate lists ───── */
const cleanPlate = (p: unknown) => String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

export async function addPlate(_: ActionResult, form: FormData): Promise<ActionResult> {
  const u = await editor();
  const plate = cleanPlate(form.get("plate"));
  const kind = form.get("kind") === "BLACK" ? "BLACK" : "WHITE";
  const note = String(form.get("note") ?? "").trim().slice(0, 80) || null;
  if (plate.length < 4) return { error: "invalid" };
  if (!(await planFeatures(u.organization.id)).has("plateLists")) return { error: "plan" };
  await db.plateListItem.upsert({ where: { organizationId_plate: { organizationId: u.organization.id, plate } }, create: { organizationId: u.organization.id, plate, kind, note }, update: { kind, ...(note && { note }) } });
  await audit(u.id, "plates.list", plate, { kind });
  revalidatePath("/dashboard/plates");
  return { ok: true };
}

export async function removePlate(plate: string) {
  const u = await editor();
  await db.plateListItem.deleteMany({ where: { organizationId: u.organization.id, plate: cleanPlate(plate) } });
  revalidatePath("/dashboard/plates");
}

export async function setUnknownPlateAlert(on: boolean) {
  const u = await editor();
  await db.organization.update({ where: { id: u.organization.id }, data: { unknownPlateAlert: on } });
  revalidatePath("/dashboard/plates");
}

export async function setDaily(on: boolean) {
  const u = await editor();
  await db.organization.update({ where: { id: u.organization.id }, data: { dailySummary: on } });
  revalidatePath("/dashboard/settings");
}

export async function saveSchoolTimes(_: ActionResult, form: FormData): Promise<ActionResult> {
  const u = await editor();
  const p = z.object({ start: HHMM, report: HHMM, end: HHMM }).safeParse({ start: form.get("start"), report: form.get("report"), end: form.get("end") || "14:00" });
  if (!p.success) return { error: "invalid" };
  await db.organization.update({ where: { id: u.organization.id }, data: { schoolStart: p.data.start, absentReportAt: p.data.report, schoolEnd: p.data.end } });
  revalidatePath("/dashboard/students");
  return { ok: true };
}

/* ───── false alarm → this camera becomes a little less sensitive ───── */
export async function markFalseAlarm(eventId: string): Promise<ActionResult> {
  const u = await editor();
  const e = await db.event.findFirst({ where: { id: eventId, organizationId: u.organization.id }, include: { camera: true } });
  if (!e) return { error: "not_found" };
  if (!e.falseAlarm) {
    await db.event.update({ where: { id: e.id }, data: { falseAlarm: true, resolved: true } });
    if (e.camera) await db.camera.update({ where: { id: e.camera.id }, data: { minConf: Math.min(0.75, Math.round((e.camera.minConf + 0.04) * 100) / 100) } });
    await audit(u.id, "event.false_alarm", e.id, { camera: e.cameraId });
  }
  revalidatePath("/dashboard/events");
  return { ok: true };
}

export async function resetSensitivity(cameraId: string) {
  const u = await editor();
  await db.camera.updateMany({ where: { id: cameraId, organizationId: u.organization.id }, data: { minConf: 0.4 } });
  revalidatePath("/dashboard/cameras");
}

/* ───── admin: bot token, promo banner, test ───── */
export async function saveBotToken(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const { f } = await getDict();
  const token = String(form.get("token") ?? "").trim();
  if (form.get("remove") === "1") {
    await setBotToken(null);
    await audit(admin.id, "telegram.remove");
    revalidatePath("/admin/settings");
    return { ok: true };
  }
  if (!/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(token)) return { error: f.bot.bad };
  const r = await setBotToken(token);
  await audit(admin.id, "telegram.token", undefined, { ok: r.ok });
  revalidatePath("/admin/settings");
  return r.ok ? { ok: true, message: fmt(f.bot.ok, { u: r.username }) } : { error: f.bot.bad };
}

export async function botTest(): Promise<ActionResult> {
  const u = await getCurrentUser();
  const { f } = await getDict();
  if (!u?.telegramChatId) return { error: f.bot.testNoChat };
  const r = await sendText(u.telegramChatId, f.tg.test);
  return r ? { ok: true, message: f.bot.testSent } : { error: f.bot.bad };
}

export async function savePromo(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = z.object({
    text: z.string().trim().max(200),
    link: z.string().trim().max(300).regex(/^(https?:\/\/|\/)[^\s"'<>]*$/).or(z.literal("")),
    until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  }).safeParse({ text: form.get("text") ?? "", link: form.get("link") ?? "", until: form.get("until") ?? "" });
  if (!p.success) return { error: "invalid" };
  for (const [k, v] of Object.entries(p.data)) {
    const key = `promo:${k}`;
    await db.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
  }
  await audit(admin.id, "promo.update", undefined, p.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
