import Link from "next/link";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { money } from "@/lib/format";
import { Panel } from "@/components/dash/Shell";

const DAY = 86400_000;

/** Customers who may leave: no sign-in for 14+ days, cameras silent for 3+ days, or ending within 7 days with no renewal. */
export async function ChurnRisk() {
  const { f } = await getDict();
  const x = f.x;
  const now = Date.now();
  const orgs = await db.organization.findMany({
    where: { demo: false, blockedAt: null },
    include: {
      users: { select: { id: true } },
      cameras: { select: { lastSeenAt: true } },
      subscriptions: { where: { status: { in: ["ACTIVE", "REQUESTED", "APPROVED", "AWAITING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW"] } }, select: { status: true, currentPeriodEnd: true } },
    },
  });
  const logins = await db.auditLog.groupBy({ by: ["userId"], where: { action: "auth.login" }, _max: { createdAt: true } });
  const lastLogin = new Map(logins.map((l) => [l.userId, l._max.createdAt]));
  const rows: { id: string; name: string; why: string[] }[] = [];
  for (const o of orgs) {
    const why: string[] = [];
    const ll = Math.max(0, ...o.users.map((u) => lastLogin.get(u.id)?.getTime() ?? o.createdAt.getTime()));
    const dLogin = Math.floor((now - ll) / DAY);
    if (dLogin >= 14) why.push(fmt(x.churnNoLogin, { n: dLogin }));
    const seen = Math.max(0, ...o.cameras.map((c) => c.lastSeenAt?.getTime() ?? 0));
    if (o.cameras.length && seen && now - seen > 3 * DAY) why.push(fmt(x.churnOffline, { n: Math.floor((now - seen) / DAY) }));
    const active = o.subscriptions.find((s) => s.status === "ACTIVE" && s.currentPeriodEnd);
    const renewing = o.subscriptions.some((s) => s.status !== "ACTIVE");
    if (active && !renewing && active.currentPeriodEnd!.getTime() - now < 7 * DAY) why.push(fmt(x.churnEnding, { n: Math.max(0, Math.ceil((active.currentPeriodEnd!.getTime() - now) / DAY)) }));
    if (why.length) rows.push({ id: o.id, name: o.name, why });
  }
  return (
    <Panel title={x.churnTitle} sub={x.churnLead}>
      {rows.length === 0 ? (
        <p className="text-fg-dim">{x.churnNone}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <Link href={`/admin/customers/${r.id}`} className="font-semibold hover:underline">{r.name}</Link>
              <span className="flex flex-wrap gap-1.5">{r.why.map((w) => <span key={w} className="chip chip-warn">{w}</span>)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Approved payments per month (6 months) + next month forecast from active subscriptions. */
export async function Revenue() {
  const { f } = await getDict();
  const x = f.x;
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const pays = await db.payment.findMany({ where: { status: "APPROVED", amount: { gt: 0 }, reviewedAt: { gte: months[0] } }, select: { amount: true, reviewedAt: true } });
  const sums = months.map((m, i) => {
    const end = i < 5 ? months[i + 1] : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return pays.filter((p) => p.reviewedAt! >= m && p.reviewedAt! < end).reduce((a, p) => a + p.amount, 0);
  });
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1), nextEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const subs = await db.subscription.findMany({ where: { status: "ACTIVE", currentPeriodEnd: { gte: new Date(), lt: nextEnd } }, include: { plan: true } });
  const forecast = subs.filter((s) => s.currentPeriodEnd! >= new Date()).reduce((a, s) => a + s.plan.priceMonthly, 0);
  const max = Math.max(1, ...sums, forecast);
  const label = (d: Date) => d.toLocaleDateString("ru-RU", { month: "short" });
  return (
    <Panel title={x.revTitle}>
      <div className="flex h-44 items-end gap-3">
        {sums.map((s, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] text-fg-dim">{s ? money(s) : ""}</span>
            <div className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400" style={{ height: `${(s / max) * 100}%`, minHeight: s ? 4 : 1 }} />
            <span className="text-[11px] text-fg-muted">{label(months[i])}</span>
          </div>
        ))}
        <div className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[11px] text-violet-300">{money(forecast)}</span>
          <div className="w-full rounded-t-md border-2 border-dashed border-violet-400/70 bg-violet-500/15" style={{ height: `${(forecast / max) * 100}%`, minHeight: 4 }} />
          <span className="text-[11px] text-violet-300">{label(nextStart)}*</span>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] text-fg-dim">* {x.forecast}: <b className="text-fg">{money(forecast)} {x.som}</b> — {x.forecastNote}</p>
    </Panel>
  );
}
