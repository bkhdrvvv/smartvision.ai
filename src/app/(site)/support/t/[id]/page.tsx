import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { Chat } from "@/components/support/Chat";
import { Permissions } from "@/components/dash/Permissions";
import { chatAccess, markSeen, peerPresence, toChatMsg, touchPresence } from "@/lib/chat";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** A visitor's chat with support (reachable only from the browser that created it). */
export default async function GuestChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acc = await chatAccess(id);
  if (!acc || acc.viewer !== "guest") notFound();
  const { d } = await getDict();
  await Promise.all([markSeen(id, "guest"), touchPresence(id, "guest")]);
  const msgs = await db.ticketMessage.findMany({ where: { ticketId: id }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } });
  const t = acc.ticket;
  return (
    <section className="mx-auto max-w-[860px] px-3 pt-28 pb-10 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link href="/support" className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"><ArrowLeft size={14} /> {d.support.title}</Link>
        <span className="text-[13px] text-fg-dim">#{t.number} · {t.subject}</span>
      </div>
      <Chat ticketId={id} initial={msgs.map((m) => toChatMsg(m, "guest"))} peerName={d.support.team} status={t.status} showStatus presence={peerPresence(t, "guest")} />
      <p className="mt-3 flex items-start gap-2 text-[12.5px] text-fg-dim"><Info size={14} className="mt-0.5 shrink-0" /> {d.support.guestSaved}</p>
      <Permissions withNotif={false} poll={false} />
    </section>
  );
}
