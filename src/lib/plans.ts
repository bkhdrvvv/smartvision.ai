import "server-only";
import { db } from "./db";
import type { PlanDTO } from "@/components/site/Pricing";

export async function getPlans(): Promise<PlanDTO[]> {
  try {
    const rows = await db.plan.findMany({ where: { active: true }, orderBy: { priceMonthly: "asc" } });
    return rows.map((p) => ({ id: p.id, service: p.service, tier: p.tier, maxCameras: p.maxCameras, priceMonthly: p.priceMonthly, features: p.features, recommended: p.recommended }));
  } catch (e) {
    console.error("[plans] database unavailable", e);
    return [];
  }
}

export function minPrices(plans: PlanDTO[]) {
  const min = (s: PlanDTO["service"]) => Math.min(...plans.filter((p) => p.service === s).map((p) => p.priceMonthly), Infinity);
  const f = (n: number) => (Number.isFinite(n) ? n : 0);
  return { school: f(min("SCHOOL")), home: f(min("HOME")), farm: f(min("FARM")) };
}
