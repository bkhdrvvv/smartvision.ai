import "server-only";
import { db } from "./db";
import { featureDicts } from "./i18n/features";
import { dictionaries, fmt, isLocale, type Locale } from "./i18n";
import { sendEmail, siteUrl } from "./notify";
import { telegramToOrg } from "./telegram";

const DAY = 86400_000;

/** Monday 08:00+ (Tashkent): last week's summary for every customer who keeps it on. Runs from the 10-minute cron, once per week. */
export async function weeklyReports(now = new Date()) {
  const tk = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  if (tk.getDay() !== 1 || tk.getHours() < 8) return "not monday morning";
  const week = tk.toLocaleDateString("en-CA"); // the Monday
  const flag = `weekly:${week}`;
  if (await db.setting.findUnique({ where: { key: flag } })) return "already sent";
  await db.setting.create({ data: { key: flag, value: new Date().toISOString() } });

  const from = new Date(now.getTime() - 7 * DAY);
  const period = `${from.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" })} – ${now.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" })}`;
  const orgs = await db.organization.findMany({ where: { weeklyReport: true, blockedAt: null, demo: false }, include: { users: { where: { orgRole: "OWNER" } }, cameras: { select: { status: true } } } });
  let sent = 0;
  for (const o of orgs) {
    const sev = await db.event.groupBy({ by: ["severity"], where: { organizationId: o.id, occurredAt: { gte: from } }, _count: { _all: true } });
    const n = (s: string) => sev.find((x) => x.severity === s)?._count._all ?? 0;
    const total = sev.reduce((a, x) => a + x._count._all, 0);
    if (!total && !o.cameras.length) continue;
    const vars = { o: o.name, p: period, e: total, w: n("WARNING"), c: n("CRITICAL"), k: o.cameras.length, on: o.cameras.filter((c) => c.status !== "OFFLINE").length };
    const text = (l: Locale) => fmt(featureDicts[l].tg.weekly, vars);
    await telegramToOrg(o.id, text).catch(() => {});
    for (const u of o.users) {
      if (!u.notifyEmail || !u.emailVerifiedAt) continue;
      const l = (isLocale(u.locale) ? u.locale : "uz") as Locale;
      await sendEmail(u.email, `${featureDicts[l].weekly.title} — ${o.name}`, text(l), { href: siteUrl("/dashboard/analytics"), label: dictionaries[l].common.open }).catch(() => {});
    }
    sent++;
  }
  return `sent ${sent}`;
}
