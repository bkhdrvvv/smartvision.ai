import "server-only";
import { db } from "./db";
import { dictionaries, fmt, type Dict, type Locale } from "./i18n";
import { featureDicts } from "./i18n/features";
import { YEAR_OFF } from "./billing";
import { money } from "./format";

const localeOf = (d: Dict) => (Object.entries(dictionaries).find(([, v]) => v === d)?.[0] ?? "uz") as Locale;
import { notifyUsers } from "./notify";
import { deleteSnapshot } from "./storage";

const DAY = 86400000;
const REMIND_DAYS = 3;
const REMINDER_NOTE = "reminder-3d";

let lastSweep = 0;
let lastRetention = 0;
/** Face / head snapshots are personal data: keep them for this many days (SNAPSHOT_RETENTION_DAYS) */
const SNAPSHOT_DAYS = Math.max(1, Number(process.env.SNAPSHOT_RETENTION_DAYS) || 30);

async function purgeOldSnapshots() {
  const cutoff = new Date(Date.now() - SNAPSHOT_DAYS * DAY);
  const old = await db.event.findMany({ where: { snapshotKey: { not: null }, occurredAt: { lt: cutoff } }, select: { id: true, snapshotKey: true }, take: 2000 });
  if (!old.length) return;
  for (const e of old) await deleteSnapshot(e.snapshotKey!);
  await db.event.updateMany({ where: { id: { in: old.map((e) => e.id) } }, data: { snapshotKey: null } });
  await db.auditLog.create({ data: { action: "snapshots.purged", meta: { count: old.length, days: SNAPSHOT_DAYS } } });
}

/**
 * Lifecycle enforcement, run lazily on every dashboard / admin / edge request (throttled to once a minute):
 *  1. ACTIVE subscriptions whose period ended → EXPIRED (+ history + notification to the customer)
 *  2. ACTIVE subscriptions ending within 3 days → one reminder notification per period
 * No cron needed; works on any host. Call with force=true from tests or a scheduler if you add one.
 */
export async function enforceSubscriptions(force = false) {
  const now = Date.now();
  if (!force && now - lastSweep < 60_000) return;
  lastSweep = now;
  if (force || now - lastRetention > 3600_000) {
    lastRetention = now;
    await purgeOldSnapshots().catch((e) => console.error("[retention]", e));
  }

  // 1. expire
  const expired = await db.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lt: new Date(now) } },
    include: { plan: true, organization: { include: { users: true } } },
  });
  for (const s of expired) {
    await db.subscription.update({ where: { id: s.id }, data: { status: "EXPIRED", history: { create: { status: "EXPIRED" } } } });
    await notifyUsers(s.organization.users.map((u) => u.id), "SUBSCRIPTION", (d) => ({ title: d.dash.expiry.expiredTitle, body: d.dash.expiry.expiredBody }), "important", "/dashboard/subscription");
    await db.auditLog.create({ data: { action: "subscription.expired", target: s.id } });
  }

  // 2. remind once per period
  const ending = await db.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { gte: new Date(now), lte: new Date(now + REMIND_DAYS * DAY) } },
    include: { plan: true, organization: { include: { users: true } }, history: { where: { note: REMINDER_NOTE }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  for (const s of ending) {
    const last = s.history[0];
    // already reminded for this period?
    if (last && s.currentPeriodStart && last.createdAt > s.currentPeriodStart) continue;
    const days = Math.max(1, Math.ceil((s.currentPeriodEnd!.getTime() - now) / DAY));
    await db.subscriptionEvent.create({ data: { subscriptionId: s.id, status: "ACTIVE", note: REMINDER_NOTE } });
    await notifyUsers(
      s.organization.users.map((u) => u.id),
      "SUBSCRIPTION",
      (d) => ({
        title: d.dash.expiry.endingTitle,
        // monthly customers also get the "go yearly and save" offer
        body: fmt(d.dash.expiry.endingBody, { p: d.pricing.tiers[s.plan.tier], n: days }) + (s.months === 12 ? "" : fmt(featureDicts[localeOf(d)].z.upsell, { n: money(YEAR_OFF[s.plan.tier]) })),
      }),
      "important",
      "/dashboard/subscription",
    );
  }
}

/** The subscription that currently grants service: ACTIVE and inside its paid period */
export async function getActiveSubscription(orgId: string) {
  await enforceSubscriptions();
  return db.subscription.findFirst({
    where: { organizationId: orgId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    include: { plan: true },
    orderBy: { currentPeriodEnd: "desc" },
  });
}

/**
 * A subscription whose paid period is over and that nothing active has replaced
 * (stays set while a renewal payment is being uploaded / reviewed) — drives the renew banner.
 */
export async function getExpiredSubscription(orgId: string) {
  const active = await getActiveSubscription(orgId);
  if (active) return null;
  return db.subscription.findFirst({
    where: { organizationId: orgId, currentPeriodEnd: { lt: new Date() }, status: { notIn: ["CANCELLED", "REJECTED"] } },
    include: { plan: true },
    orderBy: { currentPeriodEnd: "desc" },
  });
}

export async function hasService(orgId: string) {
  return !!(await getActiveSubscription(orgId));
}
