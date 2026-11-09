import Link from "next/link";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/format";
import { Panel } from "@/components/dash/Shell";

const tkDayStart = (d = new Date()) => new Date(d.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }) + "T00:00:00+05:00");
const ALERT_TYPES_IGNORED = ["CAMERA_STATUS"] as const;

/** «Bugun xavfsizmi?» — one big light: red = unreviewed critical event today, yellow = warnings / offline cameras, green = calm. */
export async function SafetyLight({ orgId }: { orgId: string }) {
  const { f } = await getDict();
  const x = f.x;
  const since = tkDayStart();
  const [crit, warn, cams] = await Promise.all([
    db.event.count({ where: { organizationId: orgId, occurredAt: { gte: since }, severity: "CRITICAL", resolved: false, type: { notIn: [...ALERT_TYPES_IGNORED] } } }),
    db.event.count({ where: { organizationId: orgId, occurredAt: { gte: since }, severity: "WARNING", resolved: false } }),
    db.camera.findMany({ where: { organizationId: orgId }, select: { status: true, lastSeenAt: true, deviceId: true } }),
  ]);
  const offline = cams.filter((c) => c.deviceId && (c.status === "OFFLINE" || !c.lastSeenAt || Date.now() - c.lastSeenAt.getTime() > 5 * 60_000)).length;
  const level = crit ? "red" : warn || offline ? "yellow" : "green";
  const reasons = [crit && fmt(x.rCritical, { n: crit }), warn && fmt(x.rWarning, { n: warn }), offline && fmt(x.rOffline, { n: offline })].filter(Boolean) as string[];
  const I = level === "red" ? ShieldAlert : level === "yellow" ? ShieldQuestion : ShieldCheck;
  const tone = { red: "border-rose-500/50 bg-rose-500/10 text-rose-200", yellow: "border-amber-400/50 bg-amber-400/10 text-amber-100", green: "border-emerald-400/50 bg-emerald-400/10 text-emerald-100" }[level];
  const dot = { red: "bg-rose-500 shadow-[0_0_30px_6px_rgba(244,63,94,.55)]", yellow: "bg-amber-400 shadow-[0_0_30px_6px_rgba(251,191,36,.5)]", green: "bg-emerald-400 shadow-[0_0_30px_6px_rgba(52,211,153,.5)]" }[level];
  return (
    <div className={cn("mb-5 flex flex-wrap items-center gap-5 rounded-[20px] border p-5", tone)}>
      <span className={cn("grid h-16 w-16 shrink-0 place-items-center rounded-full text-ink-950", dot)}><I size={30} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold uppercase tracking-[0.18em] opacity-80">{x.safetyTitle}</div>
        <div className="font-display text-[26px] font-extrabold leading-tight">{level === "red" ? x.red : level === "yellow" ? x.yellow : x.green}</div>
        <div className="mt-1 text-[13.5px] opacity-90">{reasons.length ? reasons.join(" · ") : x.rOk}</div>
      </div>
      {level !== "green" && <Link href={crit || warn ? "/dashboard/events" : "/dashboard/cameras"} className="btn btn-ghost">{x.open}</Link>}
    </div>
  );
}

/** Hour-of-day bars for people (entries / persons) and cars over the last 7 days. */
export async function BusyHours({ orgId }: { orgId: string }) {
  const { f } = await getDict();
  const x = f.x;
  const rows = await db.event.findMany({
    where: { organizationId: orgId, occurredAt: { gte: new Date(Date.now() - 7 * 86400_000) }, type: { in: ["PERSON", "ENTRY", "VEHICLE"] } },
    select: { type: true, occurredAt: true },
    take: 50_000,
  });
  const people = new Array(24).fill(0), cars = new Array(24).fill(0);
  for (const r of rows) {
    const h = Number(r.occurredAt.toLocaleString("en-US", { timeZone: "Asia/Tashkent", hour: "2-digit", hour12: false })) % 24;
    (r.type === "VEHICLE" ? cars : people)[h]++;
  }
  const max = Math.max(1, ...people.map((p, i) => p + cars[i]));
  const peak = people.map((p, i) => p + cars[i]).reduce((b, v, i, a) => (v > a[b] ? i : b), 0);
  return (
    <Panel title={x.busyTitle} sub={rows.length ? fmt(x.busyPeak, { h: `${String(peak).padStart(2, "0")}:00–${String((peak + 1) % 24).padStart(2, "0")}:00` }) : undefined}>
      <div className="flex h-44 items-end gap-[3px]">
        {people.map((p, h) => (
          <div key={h} className="group relative flex h-full flex-1 flex-col justify-end" title={`${h}:00 · ${x.people}: ${p} · ${x.cars}: ${cars[h]}`}>
            <div className="w-full rounded-t-sm bg-cyan-400/80" style={{ height: `${(cars[h] / max) * 100}%` }} />
            <div className="w-full bg-brand-500" style={{ height: `${(p / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10.5px] text-fg-dim">{[0, 6, 12, 18, 23].map((h) => <span key={h}>{h}:00</span>)}</div>
      <div className="mt-3 flex gap-4 text-[12.5px] text-fg-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> {x.people}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cyan-400" /> {x.cars}</span>
      </div>
    </Panel>
  );
}

/** This week vs last week (events, warnings, people, cars). */
export async function WeekCompare({ orgId }: { orgId: string }) {
  const { f } = await getDict();
  const x = f.x;
  const now = Date.now(), W = 7 * 86400_000;
  const count = (from: number, to: number, extra: object = {}) => db.event.count({ where: { organizationId: orgId, occurredAt: { gte: new Date(from), lt: new Date(to) }, ...extra } });
  const kinds = [
    { label: x.events, extra: {} },
    { label: x.alerts, extra: { severity: { in: ["WARNING", "CRITICAL"] } } },
    { label: x.people, extra: { type: { in: ["PERSON", "ENTRY"] } } },
    { label: x.cars, extra: { type: "VEHICLE" } },
  ];
  const rows = await Promise.all(kinds.map(async (k) => ({ label: k.label, a: await count(now - W, now, k.extra), b: await count(now - 2 * W, now - W, k.extra) })));
  return (
    <Panel title={x.weekTitle}>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => {
          const pct = r.b ? Math.round(((r.a - r.b) / r.b) * 100) : r.a ? 100 : 0;
          const txt = pct === 0 ? x.same : pct < 0 ? fmt(x.less, { p: -pct }) : fmt(x.more, { p: pct });
          return (
            <div key={r.label} className="rounded-2xl border border-line p-4">
              <div className="text-[13px] text-fg-muted">{r.label}</div>
              <div className="mt-1 flex items-baseline gap-2"><span className="font-display text-[28px] font-extrabold">{r.a}</span><span className="text-[13px] text-fg-dim">← {r.b}</span></div>
              <div className={cn("text-[13px] font-semibold", pct < 0 ? "text-emerald-300" : pct > 0 ? "text-amber-300" : "text-fg-dim")}>{txt}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-fg-dim">{x.thisWeek} ← {x.lastWeek}</p>
    </Panel>
  );
}

/** Movement heatmap per camera (grid sent by the Edge agent), drawn over the live picture when there is one. */
export async function Heatmaps({ orgId }: { orgId: string }) {
  const { f } = await getDict();
  const x = f.x;
  const cams = await db.camera.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, heat: true } });
  return (
    <Panel title={x.heatTitle} sub={x.heatLead}>
      <div className="grid gap-4 lg:grid-cols-2">
        {cams.map((c) => {
          const grid = Array.isArray(c.heat) && (c.heat as number[]).length === 576 ? (c.heat as number[]) : null;
          const max = grid ? Math.max(1, ...grid) : 1;
          return (
            <div key={c.id}>
              <div className="mb-2 text-[13px] font-semibold">{c.name}</div>
              <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-[#05070d]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/cameras/${c.id}/stream`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
                {grid ? (
                  <div className="absolute inset-0 grid grid-cols-[repeat(32,1fr)] grid-rows-[repeat(18,1fr)]">
                    {grid.map((v, i) => {
                      const k = v / max;
                      const hue = 240 - 240 * k; // blue → red
                      return <span key={i} style={{ background: k > 0.02 ? `hsla(${hue},95%,55%,${0.15 + k * 0.55})` : "transparent", filter: "blur(6px)" }} />;
                    })}
                  </div>
                ) : (
                  <div className="absolute inset-0 grid place-items-center p-6 text-center text-[13px] text-fg-dim">{x.heatEmpty}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
