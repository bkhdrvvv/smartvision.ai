import Link from "next/link";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { BarChart3, CheckCircle2, Clock, Download, FileText, Wallet } from "lucide-react";
import { Topbar, PageBody } from "@/components/dash/Shell";
import { chipFor } from "@/components/dash/Bits";
import { PaymentReview, type ReviewDTO } from "@/components/dash/PaymentReview";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getDict } from "@/lib/i18n/server";
import { fmt, intlLocale } from "@/lib/i18n";
import { ago, cn, initials, maskPhone, money, shortDate } from "@/lib/format";

const TABS: (PaymentStatus | "ALL")[] = ["ALL", "RECEIPT_SUBMITTED", "UNDER_REVIEW", "AWAITING_PAYMENT"];
const PER = 7;

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ tab?: string; id?: string; page?: string; month?: string }> }) {
  await requireAdmin();
  const { d, locale } = await getDict();
  const sp = await searchParams;
  const tab = (TABS.includes(sp.tab as PaymentStatus) ? sp.tab : "ALL") as (typeof TABS)[number];
  const page = Math.max(1, Number(sp.page) || 1);
  const now = new Date();
  // validate ?month=YYYY-M(M); anything else falls back to the current month
  const mm = /^(\d{4})-(\d{1,2})$/.exec(sp.month ?? "");
  const okMonth = mm && Number(mm[2]) >= 1 && Number(mm[2]) <= 12 && Number(mm[1]) >= 2000 && Number(mm[1]) <= 2100;
  const y = okMonth ? Number(mm![1]) : now.getFullYear();
  const m = okMonth ? Number(mm![2]) : now.getMonth() + 1;
  const monthStart = new Date(y!, m! - 1, 1);
  const monthEnd = new Date(y!, m!, 1);
  const monthName = monthStart.toLocaleDateString(intlLocale[locale], { month: "short" });
  const where: Prisma.PaymentWhereInput = { createdAt: { gte: monthStart, lt: monthEnd }, ...(tab !== "ALL" && { status: tab }) };

  const [rows, total, counts, approvedMonth, revenue, pendingOldest, settings] = await Promise.all([
    db.payment.findMany({ where, orderBy: [{ submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], include: { organization: true, subscription: { include: { plan: true } } }, take: PER, skip: (page - 1) * PER }),
    db.payment.count({ where }),
    db.payment.groupBy({ by: ["status"], where: { createdAt: { gte: monthStart, lt: monthEnd } }, _count: { _all: true } }),
    db.payment.count({ where: { status: "APPROVED", reviewedAt: { gte: monthStart, lt: monthEnd } } }),
    db.payment.aggregate({ where: { status: "APPROVED", reviewedAt: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
    db.payment.findFirst({ where: { status: { in: ["RECEIPT_SUBMITTED", "UNDER_REVIEW"] } }, orderBy: { submittedAt: "asc" } }),
    getSettings(),
  ]);
  const demoAny = (await db.organization.count({ where: { demo: true } })) > 0;
  const c = (s: PaymentStatus) => counts.find((x) => x.status === s)?._count._all ?? 0;
  const pending = c("RECEIPT_SUBMITTED") + c("UNDER_REVIEW");
  const allCount = counts.reduce((n, x) => n + x._count._all, 0);
  const rev = revenue._sum.amount ?? 0;
  const expenses = Number(settings.monthlyExpenses) || 0;
  const selId = sp.id ?? rows.find((r) => ["RECEIPT_SUBMITTED", "UNDER_REVIEW"].includes(r.status))?.id ?? rows[0]?.id;
  const sel = selId ? await db.payment.findUnique({ where: { id: selId }, include: { organization: true, subscription: { include: { plan: true } } } }) : null;
  const a = d.dash.adminPay;
  const M = (n: number) => (n / 1_000_000).toFixed(2);
  const href = (patch: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ tab, page: String(page), ...patch }).filter(([, v]) => v) as [string, string][])}`;

  const review: ReviewDTO | null = sel && {
    id: sel.id, reference: sel.reference, org: sel.organization.name, status: sel.status, amount: sel.amount,
    plan: `${d.solutions[sel.organization.service.toLowerCase() as "school"].name.replace("Smart ", "")} · ${d.pricing.tiers[sel.subscription.plan.tier]}`,
    period: `${shortDate(sel.periodStart, intlLocale[locale])} — ${shortDate(sel.periodEnd, intlLocale[locale])}`,
    paidTo: sel.paidToCard, adminNote: sel.adminNote,
    receipt: sel.receiptKey ? { name: sel.receiptName ?? "receipt", size: sel.receiptSize ?? 0, mime: sel.receiptMime ?? "image/png" } : null,
  };

  return (
    <>
      <Topbar
        crumb={`Admin / ${d.dash.menu.payments}`}
        title={a.title}
        demo={demoAny}
        chip={pending > 0 && <Link href={href({ tab: "RECEIPT_SUBMITTED", id: undefined, page: "1" })} className="chip chip-warn hidden !h-11 !rounded-xl !px-4 !text-[14px] md:inline-flex"><Clock size={15} /> {fmt(a.awaitingReview, { n: pending })}</Link>}
      />
      <PageBody>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-5">
          <Kpi I={Clock} tint="#f59e0b" k={a.pendingReview} v={pending} f={pendingOldest?.submittedAt ? fmt(a.oldest, { t: ago(pendingOldest.submittedAt, d) }) : "—"} />
          <Kpi I={FileText} tint="#94a3c4" k={a.awaitingPayment} v={c("AWAITING_PAYMENT")} f={a.approvedRequests} />
          <Kpi I={CheckCircle2} tint="#10b981" k={fmt(a.approvedMonth, { m: monthName })} v={approvedMonth} f={fmt(a.since, { d: shortDate(monthStart, intlLocale[locale]) })} />
          <Kpi I={Wallet} tint="#5b9dff" k={fmt(a.revenue, { m: monthName })} v={<>{M(rev)}<span className="ml-1 text-base font-medium text-fg-dim">M {d.common.uzs}</span></>} f={a.approvedOnly} />
          <Kpi I={BarChart3} tint="#8b7bff" k={fmt(a.netIncome, { m: monthName })} v={<>{M(rev - expenses)}<span className="ml-1 text-base font-medium text-fg-dim">M {d.common.uzs}</span></>} f={fmt(a.afterExpenses, { n: `${M(expenses)} M` })} />
        </div>

        <div className="grid gap-5 2xl:grid-cols-[1.5fr_1fr]">
          <section className="card min-w-0 !rounded-[20px] p-2 sm:p-4">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-2 [scrollbar-width:none] md:flex-wrap">
              {TABS.map((t) => {
                const n = t === "ALL" ? allCount : c(t);
                return (
                  <Link key={t} href={href({ tab: t, page: "1", id: undefined })} className={cn("relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-4 text-[15px]", tab === t ? "text-fg" : "text-fg-muted hover:text-fg")}>
                    {t === "ALL" ? a.all : d.dash.status[t]} <span className="rounded-md bg-white/5 px-1.5 text-[12px]">{n}</span>
                    {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-brand-400" />}
                  </Link>
                );
              })}
              <form className="ml-auto flex gap-2 py-2">
                <input type="hidden" name="tab" value={tab} />
                <input type="month" name="month" defaultValue={`${y}-${String(m).padStart(2, "0")}`} className="input !h-10 !w-auto" />
                <button className="btn btn-ghost !h-10" aria-label="Apply">→</button>
              </form>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl w-full min-w-[720px]">
                <thead><tr><th>{a.customer}</th><th>{a.servicePlan}</th><th>{d.dash.paymentsPage.amount}</th><th>{d.common.status}</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const on = r.id === selId;
                    const canReview = ["RECEIPT_SUBMITTED", "UNDER_REVIEW"].includes(r.status);
                    return (
                      <tr key={r.id} className={cn(on && "bg-brand-500/[.07] [&>td:first-child]:shadow-[inset_3px_0_0_#5b9dff]")}>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500/80 to-brand-500/80 text-[13px] font-bold">{initials(r.organization.name)}</span>
                            <div><div className="font-semibold">{r.organization.name}</div><div className="text-[13px] text-fg-dim">{maskPhone(r.organization.phone)}</div></div>
                          </div>
                        </td>
                        <td><div className="font-medium uppercase">{d.solutions[r.organization.service.toLowerCase() as "school"].name}</div><div className="text-[13px] text-fg-dim">{d.pricing.tiers[r.subscription.plan.tier]}</div></td>
                        <td className="whitespace-nowrap font-bold">{money(r.amount)} <span className="font-normal text-fg-dim">{d.common.uzs}</span></td>
                        <td><span className={cn("chip", chipFor(r.status))}>{d.dash.status[r.status]}</span><div className="mt-1 text-[12px] text-fg-dim">{ago(r.submittedAt ?? r.createdAt, d)}</div></td>
                        <td className="text-right"><Link href={href({ id: r.id })} scroll={false} className="btn btn-ghost btn-sm">{canReview ? d.common.review : d.common.open}</Link></td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-fg-dim">{d.common.noData}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-4 text-sm text-fg-dim">
              <span>{d.common.showing} {rows.length} {d.common.of} {total}</span>
              <div className="flex gap-2">
                {page > 1 && <Link href={href({ page: String(page - 1) })} className="btn btn-ghost btn-sm">←</Link>}
                {page * PER < total && <Link href={href({ page: String(page + 1) })} className="btn btn-ghost btn-sm">→</Link>}
                <a href={`/api/admin/payments.csv?month=${y}-${m}`} className="btn btn-ghost"><Download size={15} /> {d.common.exportCsv}</a>
              </div>
            </div>
          </section>
          <PaymentReview p={review} />
        </div>
      </PageBody>
    </>
  );
}

function Kpi({ I, tint, k, v, f }: { I: typeof Clock; tint: string; k: string; v: React.ReactNode; f: string }) {
  return (
    <div className="card !rounded-[20px] p-5">
      <div className="flex items-center gap-2 text-[14px] text-fg-muted"><I size={16} style={{ color: tint }} /> {k}</div>
      <div className="mt-3 font-display text-[34px] font-extrabold leading-none">{v}</div>
      <div className="mt-2 text-[13px] text-fg-dim">{f}</div>
    </div>
  );
}
