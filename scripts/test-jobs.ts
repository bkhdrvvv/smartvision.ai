// Dry-run of the scheduled jobs with a fake "now" (run: node --conditions=react-server --import tsx scripts/test-jobs.ts).
// Cleans up what it creates (coupon, once-flags) so the real runs still happen on the real dates.
import { db } from "@/lib/db";
import { askReviews, holidayCoupons } from "@/lib/daily";
import { weeklyReports } from "@/lib/weekly";

async function main() {
  const out: Record<string, unknown> = {};
  out.notHoliday = await holidayCoupons(new Date("2026-11-10T06:00:00Z"));
  const t0 = new Date();
  out.holiday = await holidayCoupons(new Date("2026-03-21T06:00:00Z")); // Navruz 11:00 Tashkent
  out.holidayAgain = await holidayCoupons(new Date("2026-03-21T07:00:00Z"));
  const c = await db.coupon.findUnique({ where: { code: "BAYRAM260321" } });
  out.coupon = c && { pct: c.percentOff, expires: c.expiresAt?.toISOString() };
  out.holidayNote = (await db.notification.findFirst({ where: { createdAt: { gte: t0 }, title: { contains: "Navro" } } }))?.title;
  // clean: the real Navruz 2026 is in the past anyway, but leave nothing behind
  await db.coupon.deleteMany({ where: { code: "BAYRAM260321" } });
  await db.setting.deleteMany({ where: { key: "holiday:2026-03-21" } });
  await db.notification.deleteMany({ where: { createdAt: { gte: t0 }, title: { contains: "Navro" } } });

  out.reviews = await askReviews();
  // weekly report for a future Monday (flag removed afterwards so next Monday's real report still goes out)
  out.weekly = await weeklyReports(new Date("2026-11-16T04:00:00Z"));
  await db.setting.deleteMany({ where: { key: "weekly:2026-11-16" } });
  console.log(JSON.stringify(out, null, 1));
  await db.$disconnect();
}
main();
