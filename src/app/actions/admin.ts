"use server";

import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requireAdmin } from "@/lib/auth";
import { discounted, maskCard, nextReference } from "@/lib/payments";
import { getSettings, SETTING_DEFAULTS } from "@/lib/settings";
import type { ActionResult } from "./customer";
import { dictionaries, fmt, type Dict } from "@/lib/i18n";
import { featureDicts } from "@/lib/i18n/features";
import { notifyUsers } from "@/lib/notify";
import { activateTrial, TRIAL_DAYS } from "@/lib/trial";
import bcrypt from "bcryptjs";
import { bumpTokenVersion } from "@/lib/security";
import { sendResetEmail } from "@/lib/authTokens";

const DAY = 86400000;

type N = Dict["dash"]["notify"];
/** Notification text is resolved per recipient in their own interface language */
async function notifyOrg(orgId: string, kind: "PAYMENT" | "SUBSCRIPTION", title: keyof N, body: keyof N | string, vars: Record<string, string> = {}) {
  const users = await db.user.findMany({ where: { organizationId: orgId }, select: { id: true } });
  // in-app + email, each user in their own language
  await notifyUsers(
    users.map((u) => u.id),
    kind,
    (dict) => {
      const n = dict.dash.notify;
      return { title: fmt(n[title], vars), body: body in n ? fmt(n[body as keyof N], vars) : body };
    },
    "important",
    "/dashboard/subscription",
  );
}

/** Invite-a-friend: the first paid payment of a referred customer gives the referrer a one-time 20% coupon. */
async function rewardReferrer(orgId: string, amount: number) {
  if (amount <= 0) return;
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { referredById: true, referralRewardedAt: true } });
  if (!org?.referredById || org.referralRewardedAt) return;
  const claimed = await db.organization.updateMany({ where: { id: orgId, referralRewardedAt: null }, data: { referralRewardedAt: new Date() } });
  if (!claimed.count) return;
  const code = `DOST-${randomBytes(3).toString("hex").toUpperCase()}`;
  await db.coupon.create({ data: { code, percentOff: 20, maxRedemptions: 1, expiresAt: new Date(Date.now() + 180 * DAY) } });
  await db.setting.create({ data: { key: `refcoupon:${org.referredById}:${code}`, value: orgId } });
  const users = await db.user.findMany({ where: { organizationId: org.referredById }, select: { id: true } });
  await notifyUsers(users.map((u) => u.id), "SUBSCRIPTION", (dict) => {
    const f = featureDicts[(Object.entries(dictionaries).find(([, v]) => v === dict)?.[0] ?? "uz") as keyof typeof featureDicts].referral;
    return { title: f.rewardTitle, body: fmt(f.rewardBody, { c: code }) };
  }, "important", "/dashboard/referral");
}

/* ───── Subscription requests ───── */
export async function approveRequest(subId: string) {
  const admin = await requireAdmin();
  const sub = await db.subscription.findUnique({ where: { id: subId }, include: { plan: true, coupon: true } });
  if (!sub || sub.status !== "REQUESTED") return;
  const s = await getSettings();
  const start = new Date();
  await db.$transaction([
    db.subscription.update({ where: { id: subId }, data: { status: "AWAITING_PAYMENT", approvedAt: new Date(), history: { createMany: { data: [{ status: "APPROVED" }, { status: "AWAITING_PAYMENT" }] } } } }),
    db.payment.create({
      data: {
        reference: await nextReference(), organizationId: sub.organizationId, subscriptionId: sub.id,
        amount: discounted(sub.plan.priceMonthly, sub.coupon?.percentOff), status: "AWAITING_PAYMENT",
        periodStart: start, periodEnd: new Date(start.getTime() + 30 * DAY), paidToCard: maskCard(s.paymentCard),
      },
    }),
  ]);
  await notifyOrg(sub.organizationId, "SUBSCRIPTION", "requestApproved", "requestApprovedBody");
  await audit(admin.id, "subscription.approve", subId);
  revalidatePath("/admin", "layout");
}

export async function rejectRequest(subId: string) {
  const admin = await requireAdmin();
  const sub = await db.subscription.findUnique({ where: { id: subId } });
  if (!sub || sub.status !== "REQUESTED") return;
  await db.subscription.update({ where: { id: subId }, data: { status: "REJECTED", history: { create: { status: "REJECTED" } } } });
  await notifyOrg(sub.organizationId, "SUBSCRIPTION", "requestRejected", "requestRejectedBody");
  await audit(admin.id, "subscription.reject", subId);
  revalidatePath("/admin", "layout");
}

/**
 * Start a customer's one-time free trial (7 days) on their behalf. Same rule as the customer button:
 * once per organization / phone number, never extendable — after it the subscription is paid only.
 */
export async function grantTrial(orgId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const r = await activateTrial(orgId, null, admin.id);
  if (!r.ok) return { error: r.error };
  await notifyOrg(orgId, "SUBSCRIPTION", "trialStarted", "trialStartedBody", { n: String(TRIAL_DAYS), d: r.end.toISOString().slice(0, 10) });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/* ───── Customer management ───── */
const customerSchema = z.object({
  orgName: z.string().trim().min(2).max(120),
  orgPhone: z.string().trim().regex(/^\+?[0-9 ()-]{9,20}$/).optional().or(z.literal("")),
  service: z.enum(["SCHOOL", "HOME", "FARM"]),
  userName: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
});

export async function updateCustomer(orgId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = customerSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: `invalid: ${Object.keys(p.error.flatten().fieldErrors).join(", ")}` };
  const user = await db.user.findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } });
  if (!user) return { error: "not_found" };
  const clash = await db.user.findFirst({ where: { email: p.data.email, id: { not: user.id } } });
  if (clash) return { error: "email_taken" };
  await db.organization.update({ where: { id: orgId }, data: { name: p.data.orgName, phone: p.data.orgPhone || null, service: p.data.service } });
  await db.user.update({
    where: { id: user.id },
    data: { name: p.data.userName, email: p.data.email, ...(p.data.email !== user.email && { emailVerifiedAt: null }) },
  });
  await audit(admin.id, "customer.update", orgId);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Reset a customer's password. mode "link" emails a reset link; mode "temp" returns a one-time temporary password. */
export async function adminResetPassword(userId: string, mode: "link" | "temp"): Promise<ActionResult> {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.role === "ADMIN") return { error: "not_found" };
  if (mode === "link") {
    await sendResetEmail(user);
    await audit(admin.id, "customer.reset_link", userId);
    return { ok: true, message: "link_sent" };
  }
  const temp = randomBytes(9).toString("base64url"); // 12 chars
  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(temp, 12) } });
  await bumpTokenVersion(userId); // old sessions end
  await audit(admin.id, "customer.temp_password", userId);
  return { ok: true, message: temp };
}

export async function adminSignOutUser(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await bumpTokenVersion(userId);
  await audit(admin.id, "customer.signout_all", userId);
  return { ok: true };
}

export async function adminVerifyEmail(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await audit(admin.id, "customer.email_verified", userId);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Block (or unblock) a customer: no sign-in, every session ends, Edge devices are rejected. Data is kept. */
export async function setCustomerBlocked(orgId: string, blocked: boolean, reason = ""): Promise<ActionResult> {
  const admin = await requireAdmin();
  const org = await db.organization.findUnique({ where: { id: orgId }, include: { users: { select: { id: true } } } });
  if (!org) return { error: "not_found" };
  await db.organization.update({ where: { id: orgId }, data: blocked ? { blockedAt: new Date(), blockReason: reason.trim().slice(0, 300) || null } : { blockedAt: null, blockReason: null } });
  if (blocked) for (const u of org.users) await bumpTokenVersion(u.id);
  await audit(admin.id, blocked ? "customer.block" : "customer.unblock", orgId, { name: org.name, reason: reason || undefined });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Permanently delete a customer organization (users, cameras, events, payments cascade). Requires typing its name. */
export async function deleteCustomer(orgId: string, confirmName: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const org = await db.organization.findUnique({ where: { id: orgId }, include: { events: { where: { snapshotKey: { not: null } }, select: { snapshotKey: true } }, payments: { where: { receiptKey: { not: null } }, select: { receiptKey: true } } } });
  if (!org) return { error: "not_found" };
  if (confirmName.trim() !== org.name) return { error: "name_mismatch" };
  // private files first (receipts, face snapshots), then the rows
  const { deleteSnapshot } = await import("@/lib/storage");
  for (const e of org.events) await deleteSnapshot(e.snapshotKey!);
  const { unlink } = await import("node:fs/promises");
  const { join, basename } = await import("node:path");
  for (const p of org.payments) await unlink(join(process.cwd(), "uploads", basename(p.receiptKey!))).catch(() => {});
  const chatFiles = await db.ticketMessage.findMany({ where: { ticket: { organizationId: orgId }, fileKey: { not: null } }, select: { fileKey: true } });
  const { deleteChatFile } = await import("@/lib/chat");
  for (const f of chatFiles) await deleteChatFile(f.fileKey!);
  await db.user.deleteMany({ where: { organizationId: orgId } });
  await db.organization.delete({ where: { id: orgId } });
  await audit(admin.id, "customer.delete", orgId, { name: org.name });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/* ───── Payment verification ───── */
export async function startReview(paymentId: string) {
  const admin = await requireAdmin();
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: { subscription: true } });
  if (!p || p.status !== "RECEIPT_SUBMITTED") return;
  await db.$transaction([
    db.payment.update({ where: { id: paymentId }, data: { status: "UNDER_REVIEW", reviewedById: admin.id } }),
    db.subscription.update({ where: { id: p.subscriptionId }, data: { status: p.subscription.status === "ACTIVE" ? "ACTIVE" : "UNDER_REVIEW", history: { create: { status: "UNDER_REVIEW" } } } }),
  ]);
  await audit(admin.id, "payment.review", paymentId);
  revalidatePath("/admin", "layout");
}

export async function decidePayment(paymentId: string, decision: "approve" | "reject", note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: { subscription: true } });
  if (!p || !["RECEIPT_SUBMITTED", "UNDER_REVIEW"].includes(p.status)) return { error: "invalid_state" };
  if (!p.receiptKey && decision === "approve") return { error: "no_receipt" };

  if (decision === "approve") {
    const nowMs = Date.now();
    const curEnd = p.subscription.currentPeriodEnd?.getTime() ?? 0;
    const wasActive = p.subscription.status === "ACTIVE" && curEnd > nowMs;
    // still running → add 30 days on top of the remaining days; expired / new → 30 days from approval
    const start = wasActive ? p.subscription.currentPeriodStart ?? new Date(nowMs) : new Date(nowMs);
    const end = new Date((wasActive ? curEnd : nowMs) + 30 * DAY);
    await db.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: p.id }, data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: admin.id, adminNote: null, periodStart: wasActive ? new Date(curEnd) : start, periodEnd: end } });
      // retire other active subscription of this org (upgrade path)
      await tx.subscription.updateMany({ where: { organizationId: p.organizationId, status: "ACTIVE", id: { not: p.subscriptionId } }, data: { status: "CANCELLED" } });
      await tx.subscription.update({ where: { id: p.subscriptionId }, data: { status: "ACTIVE", currentPeriodStart: start, currentPeriodEnd: end, history: { create: { status: "ACTIVE" } } } });
      if (p.subscription.couponId && !wasActive) await tx.coupon.update({ where: { id: p.subscription.couponId }, data: { redemptions: { increment: 1 } } });
    });
    await notifyOrg(p.organizationId, "PAYMENT", "paymentApproved", "paymentApprovedBody", { r: p.reference, d: end.toISOString().slice(0, 10) });
    await rewardReferrer(p.organizationId, p.amount).catch((e) => console.error("[referral]", e));
  } else {
    const clean = note.trim().slice(0, 500);
    await db.$transaction([
      db.payment.update({ where: { id: p.id }, data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: admin.id, adminNote: clean || null } }),
      db.subscription.update({ where: { id: p.subscriptionId }, data: { status: p.subscription.status === "ACTIVE" ? "ACTIVE" : "AWAITING_PAYMENT", history: { create: { status: "REJECTED", note: clean || null } } } }),
    ]);
    await notifyOrg(p.organizationId, "PAYMENT", "paymentRejected", clean || p.reference);
  }
  await audit(admin.id, `payment.${decision}`, p.id, { note });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/* ───── Plans & coupons ───── */
export async function updatePlan(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = z.object({ id: z.string(), priceMonthly: z.coerce.number().int().min(0).max(100_000_000), maxCameras: z.coerce.number().int().min(1).max(256), recommended: z.string().optional(), active: z.string().optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "invalid" };
  await db.plan.update({ where: { id: p.data.id }, data: { priceMonthly: p.data.priceMonthly, maxCameras: p.data.maxCameras, recommended: p.data.recommended === "on", active: p.data.active === "on" } });
  await audit(admin.id, "plan.update", p.data.id, p.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createCoupon(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,24}$/), percentOff: z.coerce.number().int().min(1).max(100), maxRedemptions: z.coerce.number().int().min(1).optional().or(z.literal("").transform(() => undefined)) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "invalid" };
  if (await db.coupon.findUnique({ where: { code: p.data.code } })) return { error: "exists" };
  await db.coupon.create({ data: { code: p.data.code, percentOff: p.data.percentOff, maxRedemptions: p.data.maxRedemptions ?? null } });
  await audit(admin.id, "coupon.create", p.data.code);
  revalidatePath("/admin/plans");
  return { ok: true };
}

export async function toggleCoupon(id: string) {
  const admin = await requireAdmin();
  const c = await db.coupon.findUnique({ where: { id } });
  if (!c) return;
  await db.coupon.update({ where: { id }, data: { active: !c.active } });
  await audit(admin.id, "coupon.toggle", id);
  revalidatePath("/admin/plans");
}

/* ───── Edge devices ───── */
export async function registerDevice(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const p = z.object({ serial: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,32}$/), organizationId: z.string().min(1) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "invalid" };
  if (await db.edgeDevice.findUnique({ where: { serial: p.data.serial } })) return { error: "exists" };
  const token = randomBytes(32).toString("base64url");
  await db.edgeDevice.create({ data: { serial: p.data.serial, organizationId: p.data.organizationId, tokenHash: createHash("sha256").update(token).digest("hex") } });
  await audit(admin.id, "device.register", p.data.serial);
  revalidatePath("/admin/devices");
  return { ok: true, message: token };
}

export async function rotateDeviceToken(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const token = randomBytes(32).toString("base64url");
  await db.edgeDevice.update({ where: { id }, data: { tokenHash: createHash("sha256").update(token).digest("hex") } });
  await audit(admin.id, "device.rotate", id);
  revalidatePath("/admin/devices");
  return { ok: true, message: token };
}

/* ───── Settings & messages ───── */
export async function updateSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  for (const key of Object.keys(SETTING_DEFAULTS)) {
    const v = form.get(key);
    if (typeof v === "string" && v.trim().length > 0 && v.length < 200) await db.setting.upsert({ where: { key }, update: { value: v.trim() }, create: { key, value: v.trim() } });
  }
  await audit(admin.id, "settings.update");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleMessage(id: string) {
  await requireAdmin();
  const m = await db.contactMessage.findUnique({ where: { id } });
  if (m) await db.contactMessage.update({ where: { id }, data: { handled: !m.handled } });
  revalidatePath("/admin/messages");
}
