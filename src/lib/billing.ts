// Monthly vs yearly billing. Yearly = 12 months minus a fixed discount that grows with the plan tier
// (up to 50 000 UZS on PRO). A coupon only discounts the first month, as before.
export type Tier = "START" | "STANDARD" | "PRO";
export type Months = 1 | 12;

export const YEAR_OFF: Record<Tier, number> = { START: 20_000, STANDARD: 35_000, PRO: 50_000 };

export const toMonths = (v: unknown): Months => (Number(v) === 12 ? 12 : 1);
export const periodDays = (m: number) => (m === 12 ? 365 : 30);
export const yearPrice = (monthly: number, tier: Tier) => Math.max(0, monthly * 12 - YEAR_OFF[tier]);

/** Amount to pay for one billing period (coupon % applies to the first month only). */
export function periodAmount(monthly: number, tier: Tier, months: number, couponPct?: number | null) {
  const first = couponPct ? Math.round((monthly * (100 - couponPct)) / 100) : monthly;
  return months === 12 ? Math.max(0, first + monthly * 11 - YEAR_OFF[tier]) : first;
}
