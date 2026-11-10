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
    // week highlights: people, cars and the busiest day
    const rows = await db.event.findMany({ where: { organizationId: o.id, occurredAt: { gte: from }, type: { in: ["PERSON", "ENTRY", "VEHICLE"] } }, select: { type: true, occurredAt: true }, take: 50_000 });
    const perDay = new Array(7).fill(0);
    for (const r of rows) perDay[new Date(r.occurredAt.toLocaleString("en-US", { timeZone: "Asia/Tashkent" })).getDay()]++;
    const busiest = perDay.indexOf(Math.max(...perDay));
    const people = rows.filter((r) => r.type !== "VEHICLE").length, cars = rows.length - people;
    // camera health: which cameras dropped out / were covered most often this week
    const drops = await db.event.groupBy({ by: ["cameraId"], where: { organizationId: o.id, occurredAt: { gte: from }, type: { in: ["CAMERA_STATUS", "CAMERA_HEALTH", "TAMPER"] }, cameraId: { not: null } }, _count: { _all: true } });
    const names = new Map((await db.camera.findMany({ where: { id: { in: drops.map((x) => x.cameraId!) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
    const worst = drops.sort((a, b) => b._count._all - a._count._all).slice(0, 3).map((x) => `${names.get(x.cameraId!) ?? "?"} (${x._count._all})`).join(", ");
    const health = (l: Locale) => (!o.cameras.length ? "" : worst ? fmt(featureDicts[l].z.camHealth, { l: worst }) : featureDicts[l].z.camHealthOk);
    const text = (l: Locale) => fmt(featureDicts[l].tg.weekly, vars) + (rows.length ? fmt(featureDicts[l].y.weeklyExtra, { p: people, v: cars, d: featureDicts[l].y.days[busiest] }) : "") + health(l);
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
