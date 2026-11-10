import { GraduationCap, House, Sprout, XCircle } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { CopyCard, PlanPicker, ReceiptUpload, Timeline } from "@/components/dash/SubscriptionClient";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveSubscription, getLatestSubscription } from "@/lib/dashboard";
import { renewAndGo } from "@/app/actions/customer";
import { trialUsed } from "@/lib/trial";
import { getSettings } from "@/lib/settings";
import { getDict } from "@/lib/i18n/server";
import { getPlans } from "@/lib/plans";
import { periodAmount, YEAR_OFF } from "@/lib/billing";
import { fmt, intlLocale } from "@/lib/i18n";
import { cn, longDate, money } from "@/lib/format";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.dash.menu.subscription };
}

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const user = await requireCustomer();
  const { d, f, locale } = await getDict();
  const org = user.organization;
  const { plan: pre } = await searchParams;
  const [sub, settings, allPlans] = await Promise.all([getLatestSubscription(org.id), getSettings(), getPlans()]);
  const plans = allPlans.filter((p) => p.service === org.service);
  const openPayment = sub?.payments.find((p) => ["AWAITING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW", "REJECTED"].includes(p.status));
  const activeSub = await getActiveSubscription(org.id);
  const isExpired = !activeSub && !!sub?.currentPeriodEnd && sub.currentPeriodEnd < new Date();
  // the one-time 7-day trial is offered only while nothing is active and it was never used (by this org or phone)
  const trialAvailable = !activeSub && !(await trialUsed(org.id));
  const onTrial = !!activeSub && (await db.subscriptionEvent.count({ where: { subscriptionId: activeSub.id, note: { startsWith: "trial" } } })) > 0;
  const SvcIcon = { SCHOOL: GraduationCap, HOME: House, FARM: Sprout }[org.service];
  const svcName = d.solutions[org.service.toLowerCase() as "school"].name;
  const statusForChip = openPayment ? openPayment.status : sub?.status;
  const chipCls = (s?: string) => (s === "ACTIVE" || s === "APPROVED" ? "chip-ok" : s === "REJECTED" || s === "EXPIRED" ? "chip-bad" : s === "UNDER_REVIEW" ? "chip-violet" : s === "RECEIPT_SUBMITTED" ? "chip-blue" : "chip-warn");
  const timelineStatus = openPayment && sub?.status === "ACTIVE" ? (openPayment.status === "REJECTED" ? "AWAITING_PAYMENT" : openPayment.status) : sub?.status ?? "REQUESTED";

  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${d.dash.menu.subscription}`} title={d.dash.subscriptionPage.title} demo={org.demo} />
      <PageBody>
        {!sub ? (
          <Panel title={d.dash.subscriptionPage.choose} sub={d.dash.subscriptionPage.none}>
            <PlanPicker plans={plans} preselect={pre} trialAvailable={trialAvailable} />
          </Panel>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
            <div className="space-y-5">
              <section className="card !rounded-[20px] p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex flex-wrap gap-2">
                    <span className="chip chip-blue uppercase tracking-wider"><SvcIcon size={13} /> {svcName}</span>
                    {onTrial && <span className="chip chip-violet">{d.dash.trial.badge}</span>}
                  </span>
                  <span className={cn("chip", chipCls(statusForChip))}>{d.dash.status[(statusForChip ?? "REQUESTED") as keyof typeof d.dash.status]}</span>
                </div>
                <div className="mt-4 font-display text-[30px] font-extrabold tracking-tight">{d.pricing.tiers[sub.plan.tier]} · {sub.plan.maxCameras} {d.dash.menu.cameras.toLowerCase()}</div>
                <div className="mt-1 flex justify-between text-fg-muted">
                  <span>{sub.months === 12 ? f.bill.yearTotal : d.dash.subscriptionPage.monthly}</span>
                  <span className="font-bold text-fg">
                    {/* the coupon applies to the first month only; renewals are charged the plan price */}
                    {sub.coupon && !openPayment && !sub.currentPeriodEnd && <span className="mr-2 text-sm font-normal text-fg-dim line-through">{money(periodAmount(sub.plan.priceMonthly, sub.plan.tier, sub.months))}</span>}
                    {money(openPayment?.amount ?? periodAmount(sub.plan.priceMonthly, sub.plan.tier, sub.months, sub.currentPeriodEnd ? null : sub.coupon?.percentOff))} {d.common.uzs}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-fg-muted">
                  <span>{f.bill.period}</span>
                  <span className={cn("font-semibold", sub.months === 12 ? "text-ok-soft" : "text-fg")}>{sub.months === 12 ? `${f.bill.yearBadge} · ${fmt(f.bill.save, { n: money(YEAR_OFF[sub.plan.tier]) })}` : f.bill.monthly}</span>
                </div>
                {activeSub?.currentPeriodEnd && <div className="mt-2 text-[13px] text-fg-dim">{d.dash.renews.replace("{d}", longDate(activeSub.currentPeriodEnd, intlLocale[locale]))}</div>}
                {isExpired && sub.currentPeriodEnd && (
                  <div className="mt-2 text-[13px] text-bad-soft">{d.dash.status.EXPIRED}: {longDate(sub.currentPeriodEnd, intlLocale[locale])}</div>
                )}
                {(isExpired || activeSub) && !openPayment && (
                  <form action={renewAndGo} className="mt-5">
                    <button className="btn btn-primary">{isExpired ? d.dash.expiry.renewNow : d.dash.renew}</button>
                  </form>
                )}
              </section>

              {sub.status === "REQUESTED" && <Panel title={d.dash.status.REQUESTED}><p className="text-fg-muted">{d.dash.subscriptionPage.pendingApproval}</p></Panel>}

              {openPayment && (
                <Panel title={d.dash.subscriptionPage.instructions} sub={`${openPayment.reference} · ${longDate(openPayment.periodStart, intlLocale[locale])} — ${longDate(openPayment.periodEnd, intlLocale[locale])}`}>
                  <div className="space-y-4">
                    <CopyCard card={settings.paymentCard} />
                    <p className="text-[14px] leading-relaxed text-fg-muted">{d.dash.subscriptionPage.transferText}</p>
                    {openPayment.status === "REJECTED" && (
                      <div className="flex gap-3 rounded-xl border border-bad/30 bg-bad/10 p-4 text-sm">
                        <XCircle size={18} className="shrink-0 text-bad-soft" />
                        <div><div className="font-semibold text-bad-soft">{d.dash.subscriptionPage.rejected}</div>{openPayment.adminNote && <div className="mt-1 text-fg-muted">{openPayment.adminNote}</div>}</div>
                      </div>
                    )}
                    {["AWAITING_PAYMENT", "REJECTED"].includes(openPayment.status) ? (
                      <ReceiptUpload paymentId={openPayment.id} />
                    ) : (
                      <a href={`/api/receipts/${openPayment.id}`} target="_blank" className="btn btn-ghost">{d.dash.paymentsPage.receipt}: {openPayment.receiptName}</a>
                    )}
                  </div>
                </Panel>
              )}

              <Panel title={d.dash.subscriptionPage.choose} className="scroll-mt-28" >
                <div id="plans" />
                <PlanPicker plans={plans} currentPlanId={activeSub?.planId} preselect={pre} trialAvailable={trialAvailable} />
              </Panel>
            </div>
            <Panel title={d.common.status}>
              <Timeline status={timelineStatus} history={sub.history.map((h) => ({ status: h.status, at: h.createdAt.toISOString() }))} />
            </Panel>
          </div>
        )}
      </PageBody>
    </>
  );
}
