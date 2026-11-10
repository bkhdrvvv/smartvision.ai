import "server-only";
import { db } from "./db";
import { featureDicts } from "./i18n/features";
import { dictionaries, fmt, isLocale, type Dict, type Locale } from "./i18n";
import { sendText, telegramToOrg } from "./telegram";
import { notifyUsers } from "./notify";

const localeOf = (d: Dict) => (Object.entries(dictionaries).find(([, v]) => v === d)?.[0] ?? "uz") as Locale;

/** Tashkent wall clock: { day "YYYY-MM-DD", minutes since midnight, weekday 0=Sunday } */
export function tashkentNow(now = new Date()) {
  const tk = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  return { day: now.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }), min: tk.getHours() * 60 + tk.getMinutes(), weekday: tk.getDay() };
}
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hm = (d: Date) => d.toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });
const dayStart = (day: string) => new Date(`${day}T00:00:00+05:00`);

/** Runs once per flag; returns true the first time (so two cron ticks never send twice). */
async function once(key: string) {
  try {
    await db.setting.create({ data: { key, value: new Date().toISOString() } });
    return true;
  } catch {
    return false;
  }
}

/**
 * School: at the customer's "absent list" time (default 09:00, Mon–Sat) the owner and helpers get
 * the absent and late students on Telegram (also an in-app notification).
 */
export async function absentReports(now = new Date()) {
  const t = tashkentNow(now);
  if (t.weekday === 0) return "sunday";
  const orgs = await db.organization.findMany({ where: { blockedAt: null, demo: false, students: { some: {} } }, select: { id: true, name: true, schoolStart: true, absentReportAt: true } });
  let sent = 0;
  for (const o of orgs) {
    if (t.min < toMin(o.absentReportAt)) continue;
    if (!(await once(`absent:${o.id}:${t.day}`))) continue;
    const students = await db.student.findMany({ where: { organizationId: o.id, kind: "STUDENT" }, include: { attendance: { where: { day: t.day } } }, orderBy: [{ group: "asc" }, { name: "asc" }] });
    const start = toMin(o.schoolStart);
    const absent = students.filter((s) => !s.attendance.length);
    const late = students.filter((s) => s.attendance.length && toMin(hm(s.attendance[0].firstSeenAt)) > start);
    const line = (s: (typeof students)[number], time?: Date) => `• ${s.name}${s.group ? ` (${s.group})` : ""}${time ? ` — ${hm(time)}` : ""}`;
    const text = (l: Locale) => {
      const m = featureDicts[l].more;
      return `${fmt(m.absentTitle, { d: t.day })}\n\n${fmt(m.absentBody, {
        n: absent.length, a: absent.map((s) => line(s)).join("\n") || m.none,
        m: late.length, l: late.map((s) => line(s, s.attendance[0].firstSeenAt)).join("\n") || m.none,
      })}`;
    };
    const users = await db.user.findMany({ where: { organizationId: o.id, orgRole: { in: ["OWNER", "MEMBER"] } }, select: { id: true, locale: true, telegramChatId: true } });
    for (const u of users) {
      const l = (isLocale(u.locale) ? u.locale : "uz") as Locale;
      if (u.telegramChatId) await sendText(u.telegramChatId, text(l)).catch(() => {});
      await db.notification.create({ data: { userId: u.id, kind: "SYSTEM", title: fmt(featureDicts[l].more.absentTitle, { d: t.day }).replace(/^📋 /, ""), body: text(l).split("\n").slice(2).join("\n").slice(0, 900) } });
    }
    sent++;
  }
  return `absent lists ${sent}`;
}

/**
 * On the 1st of the month (from 10:00): every parent who linked Telegram gets last month's attendance of their child —
 * days present, times late, school days absent (Mon–Sat).
 */
export async function parentMonthly(now = new Date()) {
  const t = tashkentNow(now);
  const [Y, M, D] = t.day.split("-").map(Number);
  if (D !== 1 || t.min < 10 * 60) return "not the 1st";
  if (!(await once(`parents:${Y}-${M}`))) return "already sent";
  const first = new Date(Date.UTC(M === 1 ? Y - 1 : Y, M === 1 ? 11 : M - 2, 1));
  const days: string[] = [];
  for (let d = new Date(first); d.getUTCMonth() === first.getUTCMonth(); d = new Date(d.getTime() + 86400_000)) if (d.getUTCDay() !== 0) days.push(d.toISOString().slice(0, 10));
  const monthName = (l: Locale) => first.toLocaleDateString({ uz: "uz-UZ", ru: "ru-RU", en: "en-US" }[l], { month: "long", year: "numeric", timeZone: "UTC" });
  const kids = await db.student.findMany({ where: { kind: "STUDENT", parentChats: { isEmpty: false } }, include: { organization: { select: { schoolStart: true, blockedAt: true } }, attendance: { where: { day: { in: days } } } } });
  let sent = 0;
  for (const k of kids) {
    if (k.organization.blockedAt) continue;
    const late = k.attendance.filter((a) => hm(a.firstSeenAt) > k.organization.schoolStart).length;
    const text = fmt(featureDicts.uz.y.parentMonthly, { n: k.name, m: monthName("uz"), a: k.attendance.length, l: late, x: Math.max(0, days.length - k.attendance.length) });
    for (const chat of k.parentChats) await sendText(chat, text).catch(() => {});
    sent++;
  }
  return `parents ${sent}`;
}

/**
 * Holidays (New Year, 8 March, Navruz, Independence Day, Teachers' Day) from 10:00: a 15% coupon valid 3 days,
 * sent to every customer owner (in-app + Telegram). Once per holiday.
 */
export async function holidayCoupons(now = new Date()) {
  const t = tashkentNow(now);
  const md = t.day.slice(5);
  if (!(md in featureDicts.uz.z.holidays) || t.min < 10 * 60) return "no holiday";
  if (!(await once(`holiday:${t.day}`))) return "already sent";
  const code = `BAYRAM${t.day.slice(2, 4)}${md.replace("-", "")}`; // e.g. BAYRAM260321
  const expiresAt = new Date(dayStart(t.day).getTime() + 3 * 86400_000 - 1000);
  await db.coupon.upsert({ where: { code }, create: { code, percentOff: 15, expiresAt }, update: { percentOff: 15, active: true, expiresAt } });
  const owners = await db.user.findMany({ where: { role: "CUSTOMER", orgRole: "OWNER", organization: { blockedAt: null, demo: false } }, select: { id: true } });
  await notifyUsers(owners.map((u) => u.id), "SUBSCRIPTION", (d) => {
    const z = featureDicts[localeOf(d)].z;
    return { title: fmt(z.holidayTitle, { h: z.holidays[md as keyof typeof z.holidays] }), body: fmt(z.holidayBody, { c: code }) };
  }, "info", "/dashboard/subscription");
  return `holiday ${code} → ${owners.length}`;
}

/** 30 days after the first paid (or trial) start: one "rate us" request, unless the customer already wrote a review. */
export async function askReviews(now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 86400_000);
  const orgs = await db.organization.findMany({
    where: { blockedAt: null, demo: false, reviews: { none: {} }, payments: { some: { status: "APPROVED", reviewedAt: { lte: cutoff } } } },
    select: { id: true, users: { where: { orgRole: "OWNER" }, select: { id: true } } },
    take: 50,
  });
  let n = 0;
  for (const o of orgs) {
    if (!(await once(`askreview:${o.id}`))) continue;
    await notifyUsers(o.users.map((u) => u.id), "SYSTEM", (d) => {
      const z = featureDicts[localeOf(d)].z;
      return { title: z.reviewTitle, body: z.reviewBody };
    }, "info", "/dashboard/support");
    n++;
  }
  return `review asks ${n}`;
}

/** Every evening at 20:00: a short "how was today" message on Telegram for customers who keep it on. */
export async function dailySummaries(now = new Date()) {
  const t = tashkentNow(now);
  if (t.min < 20 * 60) return "not yet 20:00";
  if (!(await once(`daily:${t.day}`))) return "already sent";
  const from = dayStart(t.day);
  const orgs = await db.organization.findMany({ where: { dailySummary: true, blockedAt: null, demo: false, users: { some: { telegramChatId: { not: null } } } }, select: { id: true, name: true } });
  for (const o of orgs) {
    const [sev, cars, kids] = await Promise.all([
      db.event.groupBy({ by: ["severity"], where: { organizationId: o.id, occurredAt: { gte: from } }, _count: { _all: true } }),
      db.event.count({ where: { organizationId: o.id, type: "VEHICLE", occurredAt: { gte: from } } }),
      db.attendance.count({ where: { day: t.day, student: { organizationId: o.id } } }),
    ]);
    const n = (s: string) => sev.find((x) => x.severity === s)?._count._all ?? 0;
    const total = sev.reduce((a, x) => a + x._count._all, 0);
    await telegramToOrg(o.id, (l) => {
      const m = featureDicts[l].more;
      return fmt(m.daily, { o: o.name, e: total, w: n("WARNING") + n("CRITICAL"), v: cars, s: kids, ok: n("CRITICAL") ? m.needLook : m.allGood });
    }).catch(() => {});
  }
  return `daily ${orgs.length}`;
}
