import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { enforceSubscriptions } from "@/lib/subscription";
import { dailyBackup } from "@/lib/backup";
import { weeklyReports } from "@/lib/weekly";
import { absentReports, dailySummaries, parentMonthly } from "@/lib/daily";

export const dynamic = "force-dynamic";

/** Background jobs, called every 10 minutes by src/instrumentation.ts (only with the internal key). */
export async function POST(req: Request) {
  const want = createHash("sha256").update(`${process.env.AUTH_SECRET}:cron`).digest();
  const got = Buffer.from(req.headers.get("x-cron-key") ?? "", "hex");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return new NextResponse("forbidden", { status: 403 });

  const out: Record<string, unknown> = {};
  // subscription expiry + "3 days left" reminders + old face snapshots — even when nobody opens the site
  await enforceSubscriptions(true).then(() => (out.subscriptions = "ok")).catch((e) => (out.subscriptions = String(e)));
  await dailyBackup().then((f) => (out.backup = f ?? "already today")).catch((e) => (out.backup = String(e)));
  await weeklyReports().then((r) => (out.weekly = r)).catch((e) => (out.weekly = String(e)));
  await absentReports().then((r) => (out.absent = r)).catch((e) => (out.absent = String(e)));
  await dailySummaries().then((r) => (out.daily = r)).catch((e) => (out.daily = String(e)));
  await parentMonthly().then((r) => (out.parents = r)).catch((e) => (out.parents = String(e)));
  return NextResponse.json(out);
}
