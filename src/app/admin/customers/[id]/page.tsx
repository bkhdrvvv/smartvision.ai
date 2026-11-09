import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cctv } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { CustomerAdmin } from "@/components/dash/CustomerAdmin";
import { chipFor } from "@/components/dash/Bits";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { cn, money, shortDate } from "@/lib/format";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { d } = await getDict();
  const { id } = await params;
  const org = await db.organization.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      cameras: { select: { code: true, name: true, status: true } },
      devices: { select: { serial: true, lastHeartbeat: true } },
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 5 },
      payments: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!org) notFound();
  const u = org.users[0];
  return (
    <>
      <Topbar crumb={`Admin / ${d.dash.menu.customers}`} title={org.name} />
      <PageBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/customers" className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"><ArrowLeft size={14} /> {d.dash.menu.customers}</Link>
          {org.cameras.length > 0 && <Link href={`/admin/customers/${org.id}/live`} className="btn btn-primary btn-sm"><Cctv size={15} /> {d.dash.adminSecurity.watch} ({org.cameras.length})</Link>}
        </div>
        {u && (
          <CustomerAdmin
            c={{ orgId: org.id, orgName: org.name, orgPhone: org.phone ?? "", service: org.service, userId: u.id, userName: u.name, email: u.email, verified: !!u.emailVerifiedAt, blockedAt: org.blockedAt?.toISOString() ?? null, blockReason: org.blockReason ?? "" }}
          />
        )}
        <div className="grid gap-5 xl:grid-cols-3">
          <Panel title={d.dash.menu.subscription}>
            <ul className="space-y-2 text-sm">
              {org.subscriptions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span>{d.pricing.tiers[s.plan.tier]} {s.currentPeriodEnd && <span className="text-fg-dim">→ {shortDate(s.currentPeriodEnd)}</span>}</span>
                  <span className={cn("chip", chipFor(s.status))}>{d.dash.status[s.status]}</span>
                </li>
              ))}
              {!org.subscriptions.length && <li className="text-fg-dim">—</li>}
            </ul>
          </Panel>
          <Panel title={d.dash.menu.payments}>
            <ul className="space-y-2 text-sm">
              {org.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px]">{p.reference}</span>
                  <span>{money(p.amount)} <span className={cn("chip ml-1", chipFor(p.status))}>{d.dash.status[p.status]}</span></span>
                </li>
              ))}
              {!org.payments.length && <li className="text-fg-dim">—</li>}
            </ul>
          </Panel>
          <Panel title={`${d.dash.menu.cameras} · ${d.dash.menu.devices}`}>
            <ul className="space-y-2 text-sm">
              {org.cameras.map((c) => <li key={c.code} className="flex justify-between"><span>{c.name} · {c.code}</span><span className="text-fg-dim">{c.status}</span></li>)}
              {org.devices.map((dv) => <li key={dv.serial} className="flex justify-between font-mono text-[12px]"><span>{dv.serial}</span><span className="text-fg-dim">{dv.lastHeartbeat ? shortDate(dv.lastHeartbeat) : "—"}</span></li>)}
              {!org.cameras.length && !org.devices.length && <li className="text-fg-dim">—</li>}
            </ul>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
