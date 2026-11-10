import Link from "next/link";
import type { EventType } from "@prisma/client";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n";
import { PrintButton } from "@/components/dash/PrintButton";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { f } = await getDict();
  return { title: f.z.report.title };
}

const PEOPLE: EventType[] = ["PERSON", "ENTRY", "STUDENT", "UNKNOWN_PERSON"];

/** One-page monthly summary on white paper — the browser's "Save as PDF" makes the PDF (nothing is generated on the server). */
export default async function MonthReport({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireCustomer();
  const { d, f, locale } = await getDict();
  const r = f.z.report;
  const org = user.organization;
  const nowTk = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }).slice(0, 7);
  const { m: q } = await searchParams;
  const m = q && /^\d{4}-(0[1-9]|1[0-2])$/.test(q) ? q : nowTk;
  const [Y, M] = m.split("-").map(Number);
  const from = new Date(`${m}-01T00:00:00+05:00`);
  const nextM = M === 12 ? `${Y + 1}-01` : `${Y}-${String(M + 1).padStart(2, "0")}`;
  const prevM = M === 1 ? `${Y - 1}-12` : `${Y}-${String(M - 1).padStart(2, "0")}`;
  const to = new Date(`${nextM}-01T00:00:00+05:00`);
  const where = { organizationId: org.id, occurredAt: { gte: from, lt: to } };

  const [bySev, byType, byCam, rows, att] = await Promise.all([
    db.event.groupBy({ by: ["severity"], where, _count: { _all: true } }),
    db.event.groupBy({ by: ["type"], where, _count: { _all: true } }),
    db.event.groupBy({ by: ["cameraId"], where, _count: { _all: true } }),
    db.event.findMany({ where, select: { occurredAt: true }, take: 100_000 }),
    db.attendance.count({ where: { student: { organizationId: org.id }, day: { gte: `${m}-01`, lt: `${nextM}-01` } } }),
  ]);
  const cams = new Map((await db.camera.findMany({ where: { organizationId: org.id }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const sev = (s: string) => bySev.find((x) => x.severity === s)?._count._all ?? 0;
  const total = bySev.reduce((a, x) => a + x._count._all, 0);
  const typeN = (ts: EventType[]) => byType.filter((x) => ts.includes(x.type)).reduce((a, x) => a + x._count._all, 0);
  const daysIn = new Date(Date.UTC(Y, M, 0)).getUTCDate();
  const perDay = new Array(daysIn).fill(0);
  for (const e of rows) perDay[Number(e.occurredAt.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }).slice(8, 10)) - 1]++;
  const maxDay = Math.max(1, ...perDay);
  const monthName = from.toLocaleDateString(intlLocale[locale], { month: "long", year: "numeric", timeZone: "Asia/Tashkent" });
  const kpis = [
    { k: r.events, v: total },
    { k: r.warn, v: sev("WARNING") },
    { k: r.crit, v: sev("CRITICAL") },
    { k: r.people, v: typeN(PEOPLE) },
    { k: r.cars, v: typeN(["VEHICLE"]) },
    { k: r.attendance, v: att },
  ];

  return (
    <div className="min-h-dvh bg-slate-100 py-8 text-slate-900 print:bg-white print:py-0">
      <div className="mx-auto mb-5 flex max-w-[820px] flex-wrap items-center gap-2 px-4 print:hidden">
        <Link href="/dashboard/reports" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold">← {r.back}</Link>
        <Link href={`/report/month?m=${prevM}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px]">‹ {r.prev}</Link>
        {m < nowTk && <Link href={`/report/month?m=${nextM}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px]">{r.next} ›</Link>}
        <div className="ml-auto [&_.btn]:!border-slate-300 [&_.btn]:!bg-slate-900 [&_.btn]:!text-white"><PrintButton label={r.print} /></div>
      </div>

      <article className="mx-auto max-w-[820px] bg-white px-10 py-9 shadow-xl print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-blue-700">SMARTVISION AI</div>
            <h1 className="mt-1 text-[28px] font-extrabold leading-tight">{r.title} · <span className="capitalize">{monthName}</span></h1>
            <div className="mt-1 text-[14px] text-slate-600">{org.name}</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={52} height={52} className="rounded-xl" />
        </header>

        <section className="mt-6 grid grid-cols-3 gap-3">
          {kpis.map((x) => (
            <div key={x.k} className="rounded-xl border border-slate-200 p-4">
              <div className="text-[12px] text-slate-500">{x.k}</div>
              <div className="mt-1 text-[26px] font-extrabold">{x.v.toLocaleString("ru-RU")}</div>
            </div>
          ))}
        </section>

        <section className="mt-7">
          <h2 className="text-[15px] font-bold">{r.byDay}</h2>
          <div className="mt-3 flex h-28 items-end gap-[3px] border-b border-slate-300">
            {perDay.map((v, i) => <div key={i} className="flex-1 rounded-t-sm bg-blue-600 print:[print-color-adjust:exact]" style={{ height: `${Math.round((v / maxDay) * 100)}%` }} title={`${i + 1}: ${v}`} />)}
          </div>
          <div className="mt-1 flex justify-between text-[10.5px] text-slate-500"><span>1</span><span>{Math.ceil(daysIn / 2)}</span><span>{daysIn}</span></div>
        </section>

        <div className="mt-7 grid grid-cols-2 gap-6">
          <section>
            <h2 className="text-[15px] font-bold">{r.byType}</h2>
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {byType.sort((a, b) => b._count._all - a._count._all).map((x) => (
                  <tr key={x.type} className="border-b border-slate-100"><td className="py-1.5">{d.dash.eventTitles[x.type]}</td><td className="py-1.5 text-right font-semibold">{x._count._all.toLocaleString("ru-RU")}</td></tr>
                ))}
                {!byType.length && <tr><td className="py-2 text-slate-500">{r.none}</td></tr>}
              </tbody>
            </table>
          </section>
          <section>
            <h2 className="text-[15px] font-bold">{r.byCam}</h2>
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {byCam.sort((a, b) => b._count._all - a._count._all).slice(0, 12).map((x) => (
                  <tr key={x.cameraId ?? "none"} className="border-b border-slate-100"><td className="py-1.5">{(x.cameraId && cams.get(x.cameraId)) || "—"}</td><td className="py-1.5 text-right font-semibold">{x._count._all.toLocaleString("ru-RU")}</td></tr>
                ))}
                {!byCam.length && <tr><td className="py-2 text-slate-500">{r.none}</td></tr>}
              </tbody>
            </table>
          </section>
        </div>

        <footer className="mt-8 border-t border-slate-200 pt-3 text-[11px] text-slate-500">
          {r.generated}: {new Date().toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" })} · smartvision.ai
        </footer>
      </article>
    </div>
  );
}
