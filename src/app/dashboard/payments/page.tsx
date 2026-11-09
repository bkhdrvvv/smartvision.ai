import Link from "next/link";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { chipFor } from "@/components/dash/Bits";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n";
import { cn, longDate, money } from "@/lib/format";

export default async function PaymentsPage() {
  const user = await requireCustomer();
  const { d, locale } = await getDict();
  const rows = await db.payment.findMany({ where: { organizationId: user.organization.id }, orderBy: { createdAt: "desc" }, include: { subscription: { include: { plan: true } } } });
  const p = d.dash.paymentsPage;
  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${d.dash.menu.payments}`} title={p.title} demo={user.organization.demo} />
      <PageBody>
        <Panel>
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[720px]">
              <thead><tr><th>{p.reference}</th><th>{d.dash.adminPay.planLabel}</th><th>{p.period}</th><th>{p.amount}</th><th>{d.common.status}</th><th>{p.receipt}</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-[13px]">{r.reference}</td>
                    <td>{d.pricing.tiers[r.subscription.plan.tier]}</td>
                    <td className="text-fg-muted">{longDate(r.periodStart, intlLocale[locale])} — {longDate(r.periodEnd, intlLocale[locale])}</td>
                    <td className="font-semibold">{money(r.amount)} <span className="text-fg-dim">{d.common.uzs}</span></td>
                    <td><span className={cn("chip", chipFor(r.status))}>{d.dash.status[r.status]}</span></td>
                    <td>{r.receiptKey ? <a href={`/api/receipts/${r.id}`} target="_blank" className="text-brand-400 hover:underline">{r.receiptName}</a> : r.status === "AWAITING_PAYMENT" ? <Link href="/dashboard/subscription" className="text-warn-soft hover:underline">{d.dash.subscriptionPage.upload}</Link> : "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-fg-dim">{d.common.noData}</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
