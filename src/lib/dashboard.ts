import "server-only";
import { db } from "./db";

const DAY = 86400000;

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export { getActiveSubscription, getExpiredSubscription } from "./subscription";

export async function getLatestSubscription(orgId: string) {
  return db.subscription.findFirst({
    where: { organizationId: orgId, status: { notIn: ["CANCELLED"] } },
    include: { plan: true, payments: { orderBy: { createdAt: "desc" } }, history: { orderBy: { createdAt: "asc" } }, coupon: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Events + alerts per day for the last `days` days */
export async function eventsByDay(orgId: string, days: number) {
  const from = startOfDay(new Date(Date.now() - (days - 1) * DAY));
  const rows = await db.event.findMany({ where: { organizationId: orgId, occurredAt: { gte: from } }, select: { occurredAt: true, severity: true } });
  const buckets = Array.from({ length: days }, (_, i) => ({ date: new Date(from.getTime() + i * DAY), a: 0, b: 0 }));
  for (const r of rows) {
    const i = Math.floor((startOfDay(r.occurredAt).getTime() - from.getTime()) / DAY);
    if (buckets[i]) {
      buckets[i].a++;
      if (r.severity !== "INFO") buckets[i].b++;
    }
  }
  return buckets;
}

export async function eventsByCategory(orgId: string, days: number) {
  const from = startOfDay(new Date(Date.now() - (days - 1) * DAY));
  const g = await db.event.groupBy({ by: ["type"], where: { organizationId: orgId, occurredAt: { gte: from } }, _count: { _all: true } });
  return g.map((x) => ({ type: x.type, count: x._count._all }));
}

export async function todayCounts(orgId: string) {
  const t = startOfDay();
  const y = new Date(t.getTime() - DAY);
  const [today, yesterday] = await Promise.all([
    db.event.count({ where: { organizationId: orgId, occurredAt: { gte: t } } }),
    db.event.count({ where: { organizationId: orgId, occurredAt: { gte: y, lt: t } } }),
  ]);
  return { today, yesterday };
}
