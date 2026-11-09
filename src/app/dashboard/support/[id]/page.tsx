import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Topbar, PageBody } from "@/components/dash/Shell";
import { ActionButton } from "@/components/dash/ClientBits";
import { Chat } from "@/components/support/Chat";
import { KIND_CHIP, STATUS_CHIP } from "@/components/support/Thread";
import { setTicketStatus } from "@/app/actions/tickets";
import { requireCustomer } from "@/lib/auth";
import { markSeen, peerPresence, toChatMsg, touchPresence } from "@/lib/chat";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { cn } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomerTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCustomer();
  const { d } = await getDict();
  const t = d.support;
  const { id } = await params;
  const ticket = await db.ticket.findFirst({ where: { id, organizationId: user.organization.id } });
  if (!ticket) notFound();
  await Promise.all([markSeen(id, "customer"), touchPresence(id, "customer")]);
  const msgs = await db.ticketMessage.findMany({ where: { ticketId: id }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } });
  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${t.title} / #${ticket.number}`} title={ticket.subject} />
      <PageBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard/support" className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"><ArrowLeft size={14} /> {t.mine}</Link>
          <div className="flex items-center gap-2">
            <span className={cn("chip", KIND_CHIP[ticket.kind])}>{t.kinds[ticket.kind]}</span>
            <span className={cn("chip", STATUS_CHIP[ticket.status])}>{t.status[ticket.status]}</span>
            <ActionButton action={setTicketStatus.bind(null, ticket.id, ticket.status === "CLOSED" ? "OPEN" : "CLOSED")} className="btn btn-ghost btn-sm">
              {ticket.status === "CLOSED" ? t.reopen : t.close}
            </ActionButton>
          </div>
        </div>
        <Chat ticketId={id} initial={msgs.map((m) => toChatMsg(m, "customer"))} peerName={t.team} status={ticket.status} showStatus presence={peerPresence(ticket, "customer")} />
      </PageBody>
    </>
  );
}
