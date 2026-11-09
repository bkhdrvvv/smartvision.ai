import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { AreaChart, BarList } from "@/components/dash/Charts";
import { RangeTabs } from "@/components/dash/ClientBits";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventsByDay } from "@/lib/dashboard";
import { getDict } from "@/lib/i18n/server";
import { fmt, intlLocale } from "@/lib/i18n";
import { shortDate } from "@/lib/format";
import { BusyHours, Heatmaps, WeekCompare } from "@/components/dash/Insights";
import { PlanLock } from "@/components/dash/PlanLock";
import { planFeatures } from "@/lib/plan";

const RANGES = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 } as const;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireCustomer();
  const { d, locale } = await getDict();
  const org = user.organization;
  const { range: r } = await searchParams;
  const range = (r && r in RANGES ? r : "30d") as keyof typeof RANGES;
  const days = RANGES[range];
  const from = new Date(Date.now() - days * 86400000);
  const [byDay, rows, perCam] = await Promise.all([
    eventsByDay(org.id, days),
    db.event.findMany({ where: { organizationId: org.id, occurredAt: { gte: from } }, select: { occurredAt: true } }),
    db.event.groupBy({ by: ["cameraId"], where: { organizationId: org.id, occurredAt: { gte: from } }, _count: { _all: true } }),
  ]);
  const cams = await db.camera.findMany({ where: { organizationId: org.id } });
  const feats = await planFeatures(org.id);
  const hours = Array.from({ length: 24 }, () => 0);
  for (const e of rows) hours[e.occurredAt.getHours()]!++;
  const hRange = hours.slice(6, 21);
  const peak = hours.indexOf(Math.max(...hours));
  const camRows = perCam.map((p) => ({ name: cams.find((c) => c.id === p.cameraId)?.name ?? "—", n: p._count._all })).sort((a, b) => b.n - a.n);
  const maxCam = Math.max(1, ...camRows.map((c) => c.n));

  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${d.dash.menu.analytics}`} title={d.dash.analyticsPage.title} demo={org.demo} />
      <PageBody>
        <Panel title={d.dash.eventsByDay} sub={fmt(d.dash.allCamerasLast, { n: days })} action={<RangeTabs value={range} options={Object.keys(RANGES)} />}>
          <AreaChart data={byDay.map((b) => ({ label: shortDate(b.date, intlLocale[locale]), a: b.a, b: b.b }))} labels={{ a: d.dash.events, b: d.dash.alerts }} />
        </Panel>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title={d.dash.analyticsPage.busiest} sub={`${d.dash.analyticsPage.peak}: ${String(peak).padStart(2, "0")}:00`}>
            <BarList values={hRange} labels={hRange.map((_, i) => String(i + 6))} highlightLast={false} />
          </Panel>
          <Panel title={d.dash.analyticsPage.perCamera}>
            <ul className="space-y-3">
              {camRows.map((c) => (
                <li key={c.name}>
                  <div className="mb-1 flex justify-between text-sm"><span>{c.name}</span><span className="font-semibold">{c.n}</span></div>
                  <div className="h-2 overflow-hidden rounded bg-white/5"><div className="h-full rounded bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${(c.n / maxCam) * 100}%` }} /></div>
                </li>
              ))}
              {camRows.length === 0 && <li className="text-sm text-fg-dim">{d.common.noData}</li>}
            </ul>
          </Panel>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {feats.has("busyHours") ? <BusyHours orgId={org.id} /> : <PlanLock service={org.service} feature="busyHours" />}
          <WeekCompare orgId={org.id} />
        </div>
        <div className="mt-5">{feats.has("heatmap") ? <Heatmaps orgId={org.id} /> : <PlanLock service={org.service} feature="heatmap" />}</div>
      </PageBody>
    </>
  );
}
