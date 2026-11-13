"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { audit, requireCustomer } from "@/lib/auth";
import { cameraSchema } from "@/lib/validators";
import { getActiveSubscription, getExpiredSubscription } from "@/lib/dashboard";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { maskCard, nextReference } from "@/lib/payments";
import { periodAmount, periodDays, toMonths } from "@/lib/billing";
import { activateTrial, TRIAL_DAYS } from "@/lib/trial";
import { notifyUsers, tf } from "@/lib/notify";
import { z } from "zod";

export type ActionResult = { ok?: boolean; error?: string; message?: string } | undefined;

export async function markAllRead() {
  const u = await requireCustomer();
  await db.notification.updateMany({ where: { userId: u.id, read: false }, data: { read: true } });
  revalidatePath("/dashboard", "layout");
}

export async function resolveEvent(id: string) {
  const u = await requireCustomer();
  await db.event.updateMany({ where: { id, organizationId: u.organization.id }, data: { resolved: true } });
  revalidatePath("/dashboard/events");
}

export async function addCamera(_: ActionResult, form: FormData): Promise<ActionResult> {
  const u = await requireCustomer();
  if (!["OWNER", "MEMBER"].includes(u.orgRole)) return { error: "forbidden" }; // team members: see Settings → Team
  const { d } = await getDict();
  const parsed = cameraSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: d.common.error };
  const sub = await getActiveSubscription(u.organization.id);
  if (!sub) return { error: d.dash.camerasPage.noSub };
  const count = await db.camera.count({ where: { organizationId: u.organization.id } });
  const max = sub.plan.maxCameras;
  if (count >= max) return { error: fmt(d.dash.camerasPage.limit, { n: max }) };
  const device = await db.edgeDevice.findFirst({ where: { organizationId: u.organization.id } });
  const v = parsed.data;
  if (await db.camera.findFirst({ where: { organizationId: u.organization.id, code: v.code } })) return { error: fmt(d.dash.camerasPage.codeTaken, { c: v.code }) };
  await db.camera.create({
    data: {
      organizationId: u.organization.id, deviceId: device?.id, name: v.name, code: v.code, location: v.location || null, protocol: v.protocol,
      sourceUrl: v.sourceUrl || null, streamUrl: v.streamUrl || null, scene: v.scene, status: "OFFLINE", signal: 0,
    },
  });
  await audit(u.id, "camera.create", v.code);
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function updateCamera(_: ActionResult, form: FormData): Promise<ActionResult> {
  const u = await requireCustomer();
  if (!["OWNER", "MEMBER"].includes(u.orgRole)) return { error: "forbidden" }; // team members: see Settings → Team
  const { d } = await getDict();
  const id = String(form.get("id") ?? "");
  const parsed = cameraSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: d.common.error };
  const cam = await db.camera.findFirst({ where: { id, organizationId: u.organization.id } });
  if (!cam) return { error: d.common.error };
  const v = parsed.data;
  const clash = await db.camera.findFirst({ where: { organizationId: u.organization.id, code: v.code, id: { not: id } } });
  if (clash) return { error: fmt(d.dash.camerasPage.codeTaken, { c: v.code }) };
  await db.camera.update({
    where: { id },
    data: { name: v.name, code: v.code, location: v.location || null, protocol: v.protocol, sourceUrl: v.sourceUrl || null, streamUrl: v.streamUrl || null, scene: v.scene },
  });
  await audit(u.id, "camera.update", id);
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function removeCamera(id: string) {
  const u = await requireCustomer();
  if (!["OWNER", "MEMBER"].includes(u.orgRole)) return; // team members: see Settings → Team
  await db.camera.deleteMany({ where: { id, organizationId: u.organization.id } });
  await audit(u.id, "camera.delete", id);
  revalidatePath("/dashboard", "layout");
}

/** Customer requests a plan → admin must approve */
export async function requestPlan(_: ActionResult, form: FormData): Promise<ActionResult> {
  const u = await requireCustomer();
  if (!["OWNER"].includes(u.orgRole)) return { error: "forbidden" }; // team members: see Settings → Team
  const { d } = await getDict();
  const planId = String(form.get("planId") ?? "");
  const code = String(form.get("coupon") ?? "").trim().toUpperCase();
  const months = toMonths(form.get("months"));
  const plan = await db.plan.findFirst({ where: { id: planId, active: true, service: u.organization.service } });
  if (!plan) return { error: d.common.error };
  let couponId: string | undefined;
  if (code) {
    const c = await validCoupon(code);
    if (!c) return { error: d.dash.subscriptionPage.couponBad };
    couponId = c.id;
  }
  const pending = await db.subscription.findFirst({ where: { organizationId: u.organization.id, status: { in: ["REQUESTED", "APPROVED", "AWAITING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW"] } } });
  if (pending) {
    // replace a not-yet-paid request instead of stacking requests
    if (["REQUESTED", "APPROVED", "AWAITING_PAYMENT"].includes(pending.status)) {
      await db.subscription.update({ where: { id: pending.id }, data: { status: "CANCELLED" } });
      await db.payment.deleteMany({ where: { subscriptionId: pending.id, status: "AWAITING_PAYMENT" } });
    } else return { error: d.dash.subscriptionPage.pendingApproval };
  }
  const sub = await db.subscription.create({
    data: { organizationId: u.organization.id, planId: plan.id, couponId, months, status: "REQUESTED", history: { create: { status: "REQUESTED" } } },
  });
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await notifyUsers(admins.map((a) => a.id), "SUBSCRIPTION", tf("newRequest", "newRequestBody", { o: u.organization.name, p: `${plan.service} · ${plan.tier}` }), "important", "/admin/requests");
  await audit(u.id, "subscription.request", sub.id);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: d.dash.subscriptionPage.requested };
}

/** Customer starts their one-time 7-day free trial for the chosen plan */
export async function startTrial(planId: string): Promise<ActionResult> {
  const u = await requireCustomer();
  if (!["OWNER"].includes(u.orgRole)) return { error: "forbidden" }; // team members: see Settings → Team
  const { d } = await getDict();
  // anti-abuse: a free trial needs a confirmed email (in addition to the one-trial-per-phone rule)
  if (!u.emailVerifiedAt) return { error: d.dash.trial.verifyFirst };
  const r = await activateTrial(u.organization.id, planId, u.id);
  if (!r.ok) return { error: r.error === "used" ? d.dash.trial.used : r.error === "active" ? d.dash.trial.active : d.common.error };
  await db.notification.create({
    data: { userId: u.id, kind: "SUBSCRIPTION", title: d.dash.notify.trialStarted, body: fmt(d.dash.notify.trialStartedBody, { n: TRIAL_DAYS, d: r.end.toISOString().slice(0, 10) }) },
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: fmt(d.dash.notify.trialStartedBody, { n: TRIAL_DAYS, d: r.end.toISOString().slice(0, 10) }) };
}

async function validCoupon(code: string) {
  const c = await db.coupon.findUnique({ where: { code } });
  if (!c || !c.active) return null;
  if (c.expiresAt && c.expiresAt < new Date()) return null;
  if (c.maxRedemptions !== null && c.redemptions >= c.maxRedemptions) return null;
  return c;
}

export async function checkCoupon(code: string) {
  await requireCustomer();
  const c = await validCoupon(code.trim().toUpperCase());
  return c ? { percentOff: c.percentOff } : null;
}

/** Renew: creates a new payment for the next period on the active subscription */
export async function renewSubscription(): Promise<ActionResult> {
  const u = await requireCustomer();
  if (!["OWNER"].includes(u.orgRole)) return { error: "forbidden" }; // team members: see Settings → Team
  const { d } = await getDict();
  const sub = (await getActiveSubscription(u.organization.id)) ?? (await getExpiredSubscription(u.organization.id));
  if (!sub) return { error: d.dash.kpi.noSub };
  const open = await db.payment.findFirst({ where: { subscriptionId: sub.id, status: { in: ["AWAITING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW", "REJECTED"] } } });
  if (!open) {
    const s = await getSettings();
    // renew early → continue right after the current period; renew after expiry → start today
    const end = sub.currentPeriodEnd?.getTime() ?? 0;
    const start = new Date(Math.max(Date.now(), end));
    await db.payment.create({
      data: { reference: await nextReference(), organizationId: u.organization.id, subscriptionId: sub.id, amount: periodAmount(sub.plan.priceMonthly, sub.plan.tier, sub.months), status: "AWAITING_PAYMENT", periodStart: start, periodEnd: new Date(start.getTime() + periodDays(sub.months) * 86400000), paidToCard: maskCard(s.paymentCard) },
    });
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function renewAndGo() {
  await renewSubscription();
  redirect("/dashboard/subscription");
}

export async function updateNotifyPrefs(prefs: { email: boolean; sms: boolean }): Promise<ActionResult> {
  const u = await requireCustomer();
  const { d } = await getDict();
  await db.user.update({ where: { id: u.id }, data: { notifyEmail: !!prefs.email, notifySms: !!prefs.sms && !!u.phone } });
  return { ok: true, message: d.common.saved };
}

const profileSchema = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().max(20).optional(), orgName: z.string().trim().min(2).max(120) });

export async function updateProfile(_: ActionResult, form: FormData): Promise<ActionResult> {
  const u = await requireCustomer();
  const { d } = await getDict();
  const p = profileSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: d.common.error };
  await db.user.update({ where: { id: u.id }, data: { name: p.data.name, phone: p.data.phone || null } });
  await db.organization.update({ where: { id: u.organization.id }, data: { name: p.data.orgName } });
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: d.common.saved };
}


/** Night Vision mode of one camera (Pro plan). Customers: their own cameras; admins: any. The Edge agent picks it up within ~15 s. */
export async function setCameraNightMode(cameraId: string, mode: "auto" | "on" | "off"): Promise<ActionResult> {
  if (!["auto", "on", "off"].includes(mode)) return { error: "invalid" };
  const { adminReady, getCurrentUser } = await import("@/lib/auth");
  const u = await getCurrentUser();
  if (!u || (u.role === "ADMIN" && !(await adminReady(u.id)))) return { error: "unauthorized" };
  const cam = await db.camera.findUnique({ where: { id: cameraId }, select: { id: true, organizationId: true } });
  if (!cam || (u.role !== "ADMIN" && cam.organizationId !== u.organizationId)) return { error: "not_found" };
  const sub = await getActiveSubscription(cam.organizationId);
  if (!sub?.plan.features.includes("nightVision")) return { error: "pro_only" };
  await db.camera.update({ where: { id: cam.id }, data: { nightMode: mode, ...(mode === "off" && { nightActive: false }) } });
  await audit(u.id, "camera.night_mode", cam.id, { mode });
  revalidatePath("/dashboard/live");
  return { ok: true };
}