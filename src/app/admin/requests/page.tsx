import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { chipFor } from "@/components/dash/Bits";
import { ActionButton } from "@/components/dash/ClientBits";
import { TrialButton } from "@/components/dash/AdminForms";
import { trialUsedSet } from "@/lib/trial";
import { approveRequest, rejectRequest } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { ago, cn, money } from "@/lib/format";
import { discounted } from "@/lib/payments";

export default async function RequestsPage() {
  await requireAdmin();
  const { d } = await getDict();
  const rows = await db.subscription.findMany({ where: { status: { in: ["REQUESTED", "REJECTED"] } }, include: { organization: true, plan: true, coupon: true }, orderBy: { requestedAt: "desc" }, take: 100 });
  const r = d.dash.adminRequests;
  const trialSet = await trialUsedSet([...new Set(rows.map((s) => s.organizationId))]);
  return (
    <>
      <Topbar crumb={`Admin / ${d.dash.menu.requests}`} title={r.title} />
      <PageBody>
        <Panel>
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[760px]">
              <thead><tr><th>{d.dash.adminPay.customer}</th><th>{d.dash.adminPay.servicePlan}</th><th>{d.dash.paymentsPage.amount}</th><th>{r.requestedAt}</th><th>{d.common.status}</th><th /></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold">{s.organization.name}</td>
                    <td>{d.solutions[s.plan.service.toLowerCase() as "school"].name} · {d.pricing.tiers[s.plan.tier]}</td>
                    <td className="font-semibold">{money(discounted(s.plan.priceMonthly, s.coupon?.percentOff))} {d.common.uzs}{s.coupon && <span className="ml-2 chip chip-violet">{s.coupon.code} −{s.coupon.percentOff}%</span>}</td>
                    <td className="text-fg-muted">{ago(s.requestedAt, d)}</td>
                    <td><span className={cn("chip", chipFor(s.status))}>{d.dash.status[s.status]}</span></td>
                    <td className="text-right">
                      {s.status === "REQUESTED" && (
                        <div className="flex justify-end gap-2">
                          <ActionButton action={rejectRequest.bind(null, s.id)} className="btn btn-bad btn-sm">{r.reject}</ActionButton>
                          <TrialButton orgId={s.organizationId} used={trialSet.has(s.organizationId)} />
                          <ActionButton action={approveRequest.bind(null, s.id)} className="btn btn-ok btn-sm">{r.approve}</ActionButton>
                        </div>
                      )}
                    </td>
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
