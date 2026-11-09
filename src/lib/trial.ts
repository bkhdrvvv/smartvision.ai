import "server-only";
import { db } from "./db";
import { nextReference } from "./payments";

export const TRIAL_DAYS = 7;
const TRIAL_NOTE = "trial-7d";
const DAY = 86400000;

const phoneKey = (p?: string | null) => (p ?? "").replace(/\D/g, "").slice(-9); // last 9 digits: 90 123 45 67

/**
 * One free 7-day trial per customer — ever. "Customer" = the organization AND its phone number,
 * so registering a new account with the same phone does not unlock a second trial.
 */
export async function trialUsed(orgId: string): Promise<boolean> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { phone: true } });
  if (!org) return true;
  const own = await db.subscriptionEvent.count({ where: { note: { startsWith: "trial" }, subscription: { organizationId: orgId } } });
  if (own > 0) return true;
  const key = phoneKey(org.phone);
  if (key.length < 9) return false;
  // same phone on another organization that already used its trial
  const others = await db.subscriptionEvent.findMany({
    where: { note: { startsWith: "trial" } },
    select: { subscription: { select: { organization: { select: { phone: true } } } } },
    take: 5000,
  });
  return others.some((e) => phoneKey(e.subscription.organization.phone) === key);
}

/** Org ids (among the given) that already used their trial — for admin lists */
export async function trialUsedSet(orgIds: string[]): Promise<Set<string>> {
  const rows = await db.subscriptionEvent.findMany({
    where: { note: { startsWith: "trial" }, subscription: { organizationId: { in: orgIds } } },
    select: { subscription: { select: { organizationId: true } } },
  });
  return new Set(rows.map((r) => r.subscription.organizationId));
}

export type TrialResult = { ok: true; end: Date } | { ok: false; error: "used" | "active" | "no_plan" | "not_found" };

/**
 * Start the one-time trial. Uses the customer's open request if there is one, otherwise creates a
 * subscription for `planId`. After 7 days the normal expiry flow applies: renew = paid only.
 */
export async function activateTrial(orgId: string, planId: string | null, actorId: string | null): Promise<TrialResult> {
  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) return { ok: false, error: "not_found" };
  if (await trialUsed(orgId)) return { ok: false, error: "used" };
  const now = Date.now();
  if (await db.subscription.findFirst({ where: { organizationId: orgId, status: "ACTIVE", currentPeriodEnd: { gt: new Date(now) } } }))
    return { ok: false, error: "active" };

  let sub = await db.subscription.findFirst({
    where: { organizationId: orgId, status: { in: ["REQUESTED", "APPROVED", "AWAITING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!sub) {
    const plan = planId
      ? await db.plan.findFirst({ where: { id: planId, active: true, service: org.service } })
      : await db.plan.findFirst({ where: { active: true, service: org.service, recommended: true } });
    if (!plan) return { ok: false, error: "no_plan" };
    sub = await db.subscription.create({ data: { organizationId: orgId, planId: plan.id, status: "REQUESTED", history: { create: { status: "REQUESTED" } } } });
  }

  const start = new Date(now);
  const end = new Date(now + TRIAL_DAYS * DAY);
  const reference = await nextReference(); // outside the transaction (single-connection pool)
  const subId = sub.id;
  await db.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { subscriptionId: subId, status: "AWAITING_PAYMENT" } });
    await tx.subscription.update({
      where: { id: subId },
      data: { status: "ACTIVE", approvedAt: new Date(), currentPeriodStart: start, currentPeriodEnd: end, history: { create: { status: "ACTIVE", note: TRIAL_NOTE } } },
    });
    await tx.payment.create({
      data: { reference, organizationId: orgId, subscriptionId: subId, amount: 0, status: "APPROVED", periodStart: start, periodEnd: end, paidToCard: "—", reviewedAt: new Date(), reviewedById: actorId, adminNote: `Free trial · ${TRIAL_DAYS} days (one-time)` },
    });
  });
  await db.auditLog.create({ data: { userId: actorId, action: "subscription.trial", target: subId, meta: { orgId, days: TRIAL_DAYS } } });
  return { ok: true, end };
}
