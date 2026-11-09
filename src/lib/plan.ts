import "server-only";
import { db } from "./db";
import { getActiveSubscription } from "./subscription";

const ORDER = ["START", "STANDARD", "PRO"] as const;

/**
 * Feature keys the customer's current plan includes. "everythingStart" / "everythingStandard" are expanded
 * with the lower plans of the same service. No active subscription → empty set.
 */
export async function planFeatures(orgId: string): Promise<Set<string>> {
  const sub = await getActiveSubscription(orgId);
  if (!sub) return new Set();
  const out = new Set(sub.plan.features);
  const idx = ORDER.indexOf(sub.plan.tier as (typeof ORDER)[number]);
  if (idx > 0) {
    const lower = await db.plan.findMany({ where: { service: sub.plan.service, tier: { in: ORDER.slice(0, idx) as unknown as ("START" | "STANDARD")[] } } });
    for (const p of lower) for (const f of p.features) out.add(f);
  }
  return out;
}

/** Which plan of the customer's service first includes a feature (for the "available in …" notice). */
export async function planFor(service: "SCHOOL" | "HOME" | "FARM", feature: string) {
  const plans = await db.plan.findMany({ where: { service, active: true } });
  for (const tier of ORDER) if (plans.find((p) => p.tier === tier)?.features.includes(feature)) return tier;
  return "PRO" as const;
}
