import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, Cctv, Mail, Phone, ShieldAlert, UserRound, Wallet } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { ActionButton } from "@/components/dash/ClientBits";
import { Chat } from "@/components/support/Chat";
import { KIND_CHIP, STATUS_CHIP } from "@/components/support/Thread";
import { setTicketStatus } from "@/app/actions/tickets";
import { markSeen, peerPresence, toChatMsg, touchPresence } from "@/lib/chat";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { cn, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { d } = await getDict();
  const t = d.support;
  const { id } = await params;
  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
      organization: {
        include: {
          subscriptions: { where: { status: "ACTIVE", currentPeriodEnd: { gt: new Date() } }, include: { plan: true }, take: 1 },
          _count: { select: { cameras: true, tickets: true } },
        },
      },
    },
  });
  if (!ticket) notFound();
  await Promise.all([markSeen(id, "admin"), touchPresence(id, "admin")]);
  const msgs = await db.ticketMessage.findMany({ where: { ticketId: id }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } });
  const org = ticket.organization;
  const sub = org?.subscriptions[0];

  const row = (I: typeof Mail, label: string, value: React.ReactNode) => (
    <div className="flex items-start gap-3 py-2">
      <I size={15} className="mt-0.5 shrink-0 text-brand-400" />
      <div className="min-w-0"><div className="text-[11px] uppercase tracking-wider text-fg-dim">{label}</div><div className="break-words text-[14px]">{value}</div></div>
    </div>
  );

  return (
    <>
      <Topbar crumb={`Admin / ${d.dash.menu.tickets} / #${ticket.number}`} title={ticket.subject} />
      <PageBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/tickets" className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"><ArrowLeft size={14} /> {d.dash.menu.tickets}</Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("chip", KIND_CHIP[ticket.kind])}>{t.kinds[ticket.kind]}</span>
            <span className={cn("chip", STATUS_CHIP[ticket.status])}>{t.status[ticket.status]}</span>
            <ActionButton action={setTicketStatus.bind(null, ticket.id, ticket.status === "CLOSED" ? "OPEN" : "CLOSED")} className="btn btn-ghost btn-sm">
              {ticket.status === "CLOSED" ? t.reopen : t.close}
            </ActionButton>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0">
            <Chat ticketId={id} initial={msgs.map((m) => toChatMsg(m, "admin"))} peerName={ticket.name} peerSub={[ticket.phone, org ? org.name : t.guest].filter(Boolean).join(" · ")} status={ticket.status} presence={peerPresence(ticket, "admin")} />
          </div>

          {/* Who wrote: contact details + account, plan, cameras */}
          <Panel title={t.sender} className="min-w-0">
            <div className="divide-y divide-line">
              {row(UserRound, d.auth.name, <span className="font-semibold">{ticket.name}</span>)}
              {ticket.email && row(Mail, d.auth.email, <a href={`mailto:${ticket.email}`} className="hover:text-brand-400">{ticket.email}</a>)}
              {ticket.phone && row(Phone, d.auth.phone, <a href={`tel:${ticket.phone.replace(/\s/g, "")}`} className="hover:text-brand-400">{ticket.phone}</a>)}
              {org ? (
                <>
                  {row(Building2, t.account, <Link href={`/admin/customers/${org.id}`} className="font-semibold text-brand-300 hover:underline">{org.name}</Link>)}
                  {row(Wallet, t.plan, sub ? `${d.solutions[org.service.toLowerCase() as "school"].name} · ${d.pricing.tiers[sub.plan.tier]} · → ${shortDate(sub.currentPeriodEnd!)}` : <span className="text-warn-soft">{t.noPlan}</span>)}
                  {row(Cctv, d.dash.adminCustomers.cameras, org._count.cameras)}
                  {ticket.user && row(CalendarDays, t.registered, shortDate(ticket.user.createdAt))}
                  {org.blockedAt && row(ShieldAlert, d.dash.adminCustomer.blockedChip, <span className="text-bad-soft">{shortDate(org.blockedAt)}{org.blockReason ? ` · ${org.blockReason}` : ""}</span>)}
                </>
              ) : (
                row(Building2, t.account, <span className="italic text-fg-muted">{t.guest}</span>)
              )}
              {row(CalendarDays, t.created, ticket.createdAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }))}
            </div>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
