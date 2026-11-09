import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { CouponForm, PlanRow } from "@/components/dash/AdminForms";
import { ActionButton } from "@/components/dash/ClientBits";
import { toggleCoupon } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { cn } from "@/lib/format";

export default async function PlansPage() {
  await requireAdmin();
  const { d } = await getDict();
  const [plans, coupons] = await Promise.all([db.plan.findMany({ orderBy: [{ service: "asc" }, { priceMonthly: "asc" }] }), db.coupon.findMany({ orderBy: { createdAt: "desc" } })]);
  const p = d.dash.adminPlans;
  return (
    <>
      <Topbar crumb={`Admin / ${d.dash.menu.plans}`} title={p.title} />
      <PageBody>
        <Panel>
          {plans.map((pl) => (
            <PlanRow key={pl.id} plan={{ id: pl.id, label: `${d.solutions[pl.service.toLowerCase() as "school"].name} · ${d.pricing.tiers[pl.tier]}`, priceMonthly: pl.priceMonthly, maxCameras: pl.maxCameras, recommended: pl.recommended, active: pl.active }} />
          ))}
        </Panel>
        <Panel title={p.coupons}>
          <CouponForm />
          <div className="mt-5 overflow-x-auto"><table className="tbl w-full min-w-[420px]">
            <thead><tr><th>{p.code}</th><th>{p.percent}</th><th>{p.uses}</th><th>{d.common.status}</th></tr></thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono font-semibold">{c.code}</td>
                  <td>{c.percentOff}%</td>
                  <td>{c.redemptions}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</td>
                  <td><ActionButton action={toggleCoupon.bind(null, c.id)} className={cn("chip cursor-pointer", c.active ? "chip-ok" : "")}>{c.active ? d.common.active : "—"}</ActionButton></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Panel>
      </PageBody>
    </>
  );
}
