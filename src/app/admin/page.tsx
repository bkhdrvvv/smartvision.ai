import Link from "next/link";
import { ChurnRisk, Revenue } from "@/components/dash/AdminInsights";
import { ArrowRight, Cctv, Server, Users, Wallet } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { KpiCard, chipFor } from "@/components/dash/Bits";
import { AreaChart } from "@/components/dash/Charts";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n";
import { ago, cn, money, shortDate } from "@/lib/format";

export default async function AdminOverview() {
  await requireAdmin();
  const { d, f, locale } = await getDict();
  const since = new Date(Date.now() - 5 * 60000);
  const [orgs, active, cams, devices, devOnline, requests, messages, approved] = await Promise.all([
    db.organization.count(),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.camera.count(),
    db.edgeDevice.count(),
    db.edgeDevice.count({ where: { lastHeartbeat: { gte: since } } }),
    db.subscription.findMany({ where: { status: { in: ["REQUESTED", "AWAITING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW"] } }, include: { organization: true, plan: true }, orderBy: { updatedAt: "desc" }, take: 6 }),
    db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 4 }),
    db.payment.findMany({ where: { status: "APPROVED", reviewedAt: { gte: new Date(Date.now() - 180 * 86400000) } }, select: { amount: true, reviewedAt: true, periodStart: true, periodEnd: true } }),
  ]);
  // revenue per month (last 6)
  const months = Array.from({ length: 6 }, (_, i) => { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() - (5 - i)); return x; });
  // a = monthly payments, b = yearly payments (365-day periods), in thousands
  const isYear = (p: (typeof approved)[number]) => p.periodEnd.getTime() - p.periodStart.getTime() > 60 * 86400000;
  const revenue = months.map((mo) => {
    const inMonth = approved.filter((p) => p.reviewedAt && p.reviewedAt.getMonth() === mo.getMonth() && p.reviewedAt.getFullYear() === mo.getFullYear());
    const sum = (xs: typeof inMonth) => Math.round(xs.reduce((s, p) => s + p.amount, 0) / 1000);
    return { label: mo.toLocaleDateString(intlLocale[locale], { month: "short" }), a: sum(inMonth.filter((p) => !isYear(p))), b: sum(inMonth.filter(isYear)) };
  });
  const o = d.dash.adminOverview;

  return (
    <>
      <Topbar crumb="Admin" title={o.title} />
      <PageBody>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard icon={Users} tint="#5b9dff" value={orgs} label={o.customers} />
          <KpiCard icon={Wallet} tint="#10b981" value={active} label={o.activeSubs} />
          <KpiCard icon={Cctv} tint="#8b7bff" value={cams} label={o.cameras} />
          <KpiCard icon={Server} tint="#22d3ee" value={`${devOnline}/${devices}`} label={o.devicesOnline} />
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <Panel title={`${d.dash.adminPay.revenue.replace("{m}", "")} (K ${d.common.uzs})`}>
            <AreaChart data={revenue} labels={{ a: f.bill.monthly, b: f.bill.yearly }} />
            <div className="mt-2 flex gap-5 text-[13px] text-fg-muted">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#5b9dff]" /> {f.bill.monthly}</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#8b7bff]" /> {f.bill.yearly}</span>
            </div>
          </Panel>
          <Panel title={o.latestRequests} action={<Link href="/admin/requests" className="btn btn-ghost btn-sm">{d.common.viewAll} <ArrowRight size={14} /></Link>}>
            <ul className="divide-y divide-line border-t border-line">
              {requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div><div className="font-semibold">{r.organization.name}</div><div className="text-[13px] text-fg-dim">{r.plan.service} · {d.pricing.tiers[r.plan.tier]} · {money(r.plan.priceMonthly)}</div></div>
                  <span className={cn("chip", chipFor(r.status))}>{d.dash.status[r.status]}</span>
                </li>
              ))}
              {requests.length === 0 && <li className="py-6 text-sm text-fg-dim">{d.common.noData}</li>}
            </ul>
          </Panel>
        </div>
        <Panel title={o.messages} action={<Link href="/admin/messages" className="btn btn-ghost btn-sm">{d.common.viewAll}</Link>}>
          <ul className="divide-y divide-line border-t border-line">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div><span className="font-semibold">{m.name}</span> <span className="text-fg-dim">· {m.phone}</span><div className="text-sm text-fg-muted">{m.message}</div></div>
                <span className="text-xs text-fg-dim">{shortDate(m.createdAt)} · {ago(m.createdAt, d)}</span>
              </li>
            ))}
            {messages.length === 0 && <li className="py-6 text-sm text-fg-dim">{d.common.noData}</li>}
          </ul>
        </Panel>
        <div className="mt-5 grid gap-5 xl:grid-cols-2"><Revenue /><ChurnRisk /></div>
      </PageBody>
    </>
  );
}
