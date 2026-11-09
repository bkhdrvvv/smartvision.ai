import Link from "next/link";
import { ArrowRight, Cctv, Download, Plus, Server, ShieldCheck, Wallet, Wifi, WifiOff, ScanFace, Flame, Users, CircleDollarSign, GraduationCap, House, Sprout } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { AreaChart, Donut, Spark } from "@/components/dash/Charts";
import { CamStatusChip, CATEGORY_COLOR, EventThumb, KpiCard, Meter, SeverityChip } from "@/components/dash/Bits";
import { ActionButton, RangeTabs } from "@/components/dash/ClientBits";
import { markAllRead, renewAndGo } from "@/app/actions/customer";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventsByCategory, eventsByDay, getActiveSubscription, todayCounts } from "@/lib/dashboard";
import { getDict } from "@/lib/i18n/server";
import { fmt, intlLocale } from "@/lib/i18n";
import { ago, daysLeft, eventTime, longDate, money, shortDate } from "@/lib/format";
import { SafetyLight } from "@/components/dash/Insights";

const RANGES = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 } as const;

export default async function Overview({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireCustomer();
  const { d, locale } = await getDict();
  const org = user.organization;
  const { range: r } = await searchParams;
  const range = (r && r in RANGES ? r : "14d") as keyof typeof RANGES;
  const days = RANGES[range];

  const [cams, sub, counts, byDay, byCat, recent, notes, device] = await Promise.all([
    db.camera.findMany({ where: { organizationId: org.id }, orderBy: { code: "asc" } }),
    getActiveSubscription(org.id),
    todayCounts(org.id),
    eventsByDay(org.id, days),
    eventsByCategory(org.id, days),
    db.event.findMany({ where: { organizationId: org.id }, orderBy: { occurredAt: "desc" }, take: 4, include: { camera: true } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.edgeDevice.findFirst({ where: { organizationId: org.id } }),
  ]);

  const online = cams.filter((c) => c.status === "ONLINE").length;
  const offline = cams.filter((c) => c.status === "OFFLINE");
  const left = daysLeft(sub?.currentPeriodEnd);
  const used = sub ? 1 - left / 30 : 0;
  const hour = new Date().getHours();
  const greet = hour < 12 ? d.dash.greeting.morning : hour < 18 ? d.dash.greeting.afternoon : d.dash.greeting.evening;
  const total = byCat.reduce((s, c) => s + c.count, 0);
  const merged = new Map<string, number>();
  for (const c of byCat) {
    const k = c.type === "EXIT" ? "ENTRY" : c.type === "UNKNOWN_PERSON" ? "PERSON" : c.type;
    merged.set(k, (merged.get(k) ?? 0) + c.count);
  }
  const parts = [...merged.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: k === "ENTRY" ? `${d.dash.categories.ENTRY} / ${d.dash.categories.EXIT.toLowerCase()}` : d.dash.categories[k as keyof typeof d.dash.categories], value: v, color: CATEGORY_COLOR[k] ?? "#64748b" }));
  const diff = counts.today - counts.yesterday;
  const heartbeatOk = device?.lastHeartbeat && Date.now() - device.lastHeartbeat.getTime() < 5 * 60000;
  const SvcIcon = { SCHOOL: GraduationCap, HOME: House, FARM: Sprout }[org.service];
  const noteIcon = { CAMERA: Flame, EVENT: Users, PAYMENT: CircleDollarSign, SUBSCRIPTION: Wallet, SYSTEM: ShieldCheck } as const;
  const noteTint = { CAMERA: "#ef4444", EVENT: "#f59e0b", PAYMENT: "#10b981", SUBSCRIPTION: "#5b9dff", SYSTEM: "#5b9dff" } as const;
  const spark = byDay.slice(-8).map((b) => b.a);

  return (
    <>
      <Topbar
        crumb={`${d.nav.dashboard} / ${d.dash.menu.overview}`}
        title={`${greet}, ${org.name}`}
        demo={org.demo}
        chip={
          sub ? (
            <span className="chip chip-ok hidden !h-11 !rounded-xl !px-4 !text-[14px] md:inline-flex">
              <ShieldCheck size={15} /> {d.solutions[org.service.toLowerCase() as "school"].name} · {d.pricing.tiers[sub.plan.tier]} · {d.common.active}
            </span>
          ) : (
            <Link href="/dashboard/subscription" className="chip chip-warn hidden !h-11 !rounded-xl !px-4 md:inline-flex">{d.dash.kpi.noSub}</Link>
          )
        }
      />
      <PageBody>
        <SafetyLight orgId={org.id} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
          <KpiCard icon={Cctv} tint="#5b9dff" value={cams.length} label={d.dash.kpi.totalCameras} foot={fmt(d.dash.kpi.ofAllowed, { n: sub?.plan.maxCameras ?? 0 })}>
            <Meter value={sub ? cams.length / sub.plan.maxCameras : 0} color="#5b9dff" />
          </KpiCard>
          <KpiCard icon={Wifi} tint="#10b981" value={online} label={d.dash.kpi.onlineCameras} foot={fmt(d.dash.kpi.uptime, { n: cams.length ? Math.round((online / cams.length) * 100) : 0 })}>
            <Meter value={cams.length ? online / cams.length : 0} color="#10b981" />
          </KpiCard>
          <KpiCard icon={WifiOff} tint="#ef4444" value={offline.length} label={d.dash.kpi.offlineCameras} foot={offline[0] ? `${offline[0].name} · ${ago(offline[0].lastSeenAt ?? new Date(), d)}` : d.dash.kpi.allOnline}>
            <Meter value={cams.length ? offline.length / cams.length : 0} color="#ef4444" />
          </KpiCard>
          <KpiCard icon={ScanFace} tint="#8b7bff" value={counts.today} label={d.dash.kpi.todayEvents} foot={fmt(d.dash.kpi.vsYesterday, { n: `${diff >= 0 ? "+" : ""}${diff}` })}>
            <Spark values={spark} color="#8b7bff" />
          </KpiCard>
          <KpiCard icon={Wallet} tint="#5b9dff" value={sub ? d.pricing.tiers[sub.plan.tier] : "—"} label={d.dash.kpi.subscription} right={sub && <span className="chip chip-blue">{d.common.active}</span>} foot={sub ? fmt(d.dash.kpi.daysLeft, { n: left }) : d.dash.kpi.noSub}>
            <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${Math.round(used * 100)}%` }} /></div>
          </KpiCard>
          <KpiCard icon={Server} tint={heartbeatOk ? "#10b981" : "#ef4444"} value={device ? (heartbeatOk ? d.common.online : d.common.offline) : "—"} label={d.dash.kpi.localServer} foot={device ? (device.cpu != null ? `CPU ${device.cpu}% · GPU ${device.gpu ?? 0}%` : device.serial) : d.dash.edge.none}>
            {device?.cpu != null && <Meter value={device.cpu / 100} color="#10b981" />}
          </KpiCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.75fr_1fr]">
          <Panel
            title={d.dash.eventsByDay}
            sub={fmt(d.dash.allCamerasLast, { n: days })}
            action={
              <div className="flex flex-wrap items-center justify-end gap-4">
                <span className="hidden items-center gap-4 text-[13px] text-fg-muted sm:flex">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-400" /> {d.dash.events}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-400" /> {d.dash.alerts}</span>
                </span>
                <RangeTabs value={range} options={Object.keys(RANGES)} />
              </div>
            }
          >
            <AreaChart
              data={byDay.map((b) => ({ label: shortDate(b.date, intlLocale[locale]), sub: b.date.toLocaleDateString(intlLocale[locale], { month: "short", day: "numeric", weekday: "long" }), a: b.a, b: b.b }))}
              labels={{ a: d.dash.events, b: d.dash.alerts }}
            />
          </Panel>
          <Panel
            title={d.dash.byCategory}
            sub={fmt(d.dash.distribution, { n: days })}
            action={<a href={`/api/reports/events?days=${days}`} className="btn btn-ghost btn-sm"><Download size={14} /> {d.common.csv}</a>}
          >
            <div className="grid items-center gap-6 sm:grid-cols-[1fr_1.1fr] xl:grid-cols-1 2xl:grid-cols-[1fr_1.1fr]">
              <Donut parts={parts} total={total} caption={fmt(d.dash.eventsShort, { n: days })} />
              <ul className="space-y-3">
                {parts.map((p) => (
                  <li key={p.key} className="flex items-center gap-3 text-[14px]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
                    <span className="flex-1 text-fg-muted">{p.label}</span>
                    <span className="font-bold">{total ? Math.round((p.value / total) * 100) : 0}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr_1fr]">
          <Panel title={d.dash.recentEvents} sub={d.dash.liveFromEdge} action={<Link href="/dashboard/events" className="btn btn-ghost btn-sm">{d.common.viewAll} <ArrowRight size={14} /></Link>}>
            <ul className="divide-y divide-line border-t border-line">
              {recent.length === 0 && <li className="py-6 text-sm text-fg-dim">{d.common.noData}</li>}
              {recent.map((e) => (
                <li key={e.id} className="flex items-center gap-4 py-3.5">
                  <EventThumb type={e.type} severity={e.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{d.dash.eventTitles[e.type]}</div>
                    <div className="truncate text-[13px] text-fg-dim">{e.camera ? `${e.camera.name} · ${e.camera.code}` : "—"}</div>
                    <div className="text-[13px] text-fg-dim">{d.dash.confidence} {e.confidence ? e.confidence.toFixed(2) : "—"}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <SeverityChip s={e.type === "ENTRY" ? "ENTRY" : e.severity} resolved={e.resolved} label={e.resolved ? d.dash.severity.RESOLVED : e.type === "ENTRY" ? d.dash.categories.ENTRY : d.dash.severity[e.severity]} />
                    <span className="whitespace-nowrap text-[13px] text-fg-dim">{eventTime(e.occurredAt, d)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={d.dash.cameraHealth} sub={fmt(d.dash.camerasEdge, { n: cams.length, m: device ? 1 : 0 })} action={<Link href="/dashboard/cameras" className="btn btn-ghost btn-sm"><Plus size={14} /> {d.common.add}</Link>}>
            <ul className="divide-y divide-line border-t border-line">
              {cams.length === 0 && <li className="py-6 text-sm text-fg-dim">{d.common.noData}</li>}
              {cams.map((c) => {
                const tone = c.status === "ONLINE" ? "#10b981" : c.status === "WEAK" ? "#f59e0b" : "#ef4444";
                return (
                  <li key={c.id} className="flex items-center gap-3 py-3.5">
                    <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${tone}1f`, color: tone }}><Cctv size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{c.name}</div>
                      <div className="text-[13px] text-fg-dim">{c.code}</div>
                    </div>
                    <div className="hidden h-1.5 w-14 overflow-hidden rounded bg-white/10 sm:block"><div className="h-full rounded" style={{ width: `${c.signal}%`, background: tone }} /></div>
                    <CamStatusChip s={c.status} label={c.status === "ONLINE" ? d.common.online : c.status === "WEAK" ? d.common.weak : d.common.offline} />
                  </li>
                );
              })}
            </ul>
          </Panel>

          <div className="space-y-5">
            {sub ? (
              <section className="card card-hl !rounded-[20px] bg-[radial-gradient(80%_80%_at_100%_0%,rgba(124,92,255,.25),transparent_60%)] p-6">
                <div className="flex items-center justify-between">
                  <span className="chip chip-blue uppercase tracking-wider"><SvcIcon size={13} /> {d.solutions[org.service.toLowerCase() as "school"].name}</span>
                  <span className="chip chip-ok">{d.common.active}</span>
                </div>
                <div className="mt-5 font-display text-[30px] font-extrabold tracking-tight">{d.pricing.tiers[sub.plan.tier]} {d.dash.plan}</div>
                <div className="text-[15px] text-fg-muted">{fmt(d.dash.camerasMonth, { n: sub.plan.maxCameras, p: money(sub.plan.priceMonthly) })}</div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${Math.round(used * 100)}%` }} /></div>
                <div className="mt-2 flex justify-between text-[14px]">
                  <span className="text-fg-dim">{fmt(d.dash.renews, { d: longDate(sub.currentPeriodEnd!, intlLocale[locale]) })}</span>
                  <span className="font-semibold">{fmt(d.dash.kpi.daysLeft, { n: left })}</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <form action={renewAndGo}>
                    <button className="btn btn-primary">{d.dash.renew}</button>
                  </form>
                  {sub.plan.tier !== "PRO" && <Link href="/dashboard/subscription#plans" className="btn btn-ghost">{d.dash.upgrade}</Link>}
                </div>
              </section>
            ) : (
              <Panel title={d.dash.kpi.noSub}><Link href="/dashboard/subscription" className="btn btn-primary">{d.dash.subscriptionPage.choose}</Link></Panel>
            )}
            <Panel title={d.dash.latestNotifications} action={<ActionButton action={markAllRead} className="text-[13px] text-fg-dim hover:text-fg">{d.common.markAllRead}</ActionButton>}>
              <ul className="divide-y divide-line border-t border-line">
                {notes.length === 0 && <li className="py-6 text-sm text-fg-dim">{d.common.noData}</li>}
                {notes.map((n) => {
                  const I = noteIcon[n.kind];
                  const t = noteTint[n.kind];
                  return (
                    <li key={n.id} className="flex items-center gap-4 py-3.5">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${t}1f`, color: t }}><I size={18} /></span>
                      <div className="min-w-0">
                        <div className={n.read ? "font-medium text-fg-muted" : "font-semibold"}>{n.title}</div>
                        <div className="truncate text-[13px] text-fg-dim">{n.body} · {ago(n.createdAt, d)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
