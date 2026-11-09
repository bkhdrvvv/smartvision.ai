import Link from "next/link";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { chipFor } from "@/components/dash/Bits";
import { TrialButton } from "@/components/dash/AdminForms";
import { trialUsedSet } from "@/lib/trial";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { cn, initials, maskPhone, shortDate } from "@/lib/format";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { d } = await getDict();
  const { q } = await searchParams;
  const orgs = await db.organization.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { users: { some: { email: { contains: q, mode: "insensitive" } } } }] } : undefined,
    include: { _count: { select: { users: true, cameras: true } }, subscriptions: { where: { status: { notIn: ["CANCELLED"] } }, include: { plan: true }, orderBy: { createdAt: "desc" }, take: 5 }, users: { take: 1 } },
    orderBy: { createdAt: "desc" },
  });
  const c = d.dash.adminCustomers;
  const trialSet = await trialUsedSet(orgs.map((o) => o.id));
  return (
    <>
      <Topbar crumb={`Admin / ${d.dash.menu.customers}`} title={c.title} />
      <PageBody>
        <Panel>
          <form className="mb-4"><input name="q" defaultValue={q} placeholder={d.dash.adminSecurity.search} className="input max-w-sm" /></form>
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[760px]">
              <thead><tr><th>{d.dash.adminPay.customer}</th><th>{c.service}</th><th>{c.plan}</th><th>{c.cameras}</th><th>{c.users}</th><th>{c.joined}</th><th /></tr></thead>
              <tbody>
                {orgs.map((o) => {
                  // show the running subscription first (an extra pending request must not hide it)
                  const s = o.subscriptions.find((x) => x.status === "ACTIVE" && x.currentPeriodEnd && x.currentPeriodEnd > new Date()) ?? o.subscriptions[0];
                  const pending = o.subscriptions.find((x) => x !== s && ["REQUESTED", "AWAITING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW"].includes(x.status));
                  return (
                    <tr key={o.id}>
                      <td><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500/80 to-brand-500/80 text-[13px] font-bold">{initials(o.name)}</span><div><Link href={`/admin/customers/${o.id}`} className="font-semibold hover:text-brand-400 hover:underline">{o.name}</Link>{o.blockedAt && <span className="chip chip-bad ml-2">{d.dash.adminCustomer.blockedChip}</span>}<div className="text-[13px] text-fg-dim">{o.users[0]?.email} · {maskPhone(o.phone)}</div></div></div></td>
                      <td>{d.solutions[o.service.toLowerCase() as "school"].name}</td>
                      <td>
                        {s ? (
                          <span className="flex flex-wrap items-center gap-2">
                            {d.pricing.tiers[s.plan.tier]} <span className={cn("chip", chipFor(s.status))}>{d.dash.status[s.status]}</span>
                            {s.status === "ACTIVE" && s.currentPeriodEnd && <span className="text-[12px] text-fg-dim">→ {shortDate(s.currentPeriodEnd)}</span>}
                            {pending && <span className={cn("chip", chipFor(pending.status))}>+ {d.pricing.tiers[pending.plan.tier]}: {d.dash.status[pending.status]}</span>}
                          </span>
                        ) : "—"}
                      </td>
                      <td>{o._count.cameras}</td>
                      <td>{o._count.users}</td>
                      <td className="text-fg-muted">{shortDate(o.createdAt)}</td>
                      <td className="text-right">{s && s.status !== "ACTIVE" && <TrialButton orgId={o.id} used={trialSet.has(o.id)} />}</td>
                    </tr>
                  );
                })}
                {orgs.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-fg-dim">{d.common.noData}</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
