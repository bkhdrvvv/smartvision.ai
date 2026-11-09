import { Mail, MessageSquare } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { mailStatus } from "@/lib/notify";
import { getDict } from "@/lib/i18n/server";
import { cn } from "@/lib/format";

const linkify = (s: string) => s.split(/(https?:\/\/[^\s]+)/g);

export default async function OutboxPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { d } = await getDict();
  const { q } = await searchParams;
  const rows = await db.outbox.findMany({ where: q ? { to: { contains: q, mode: "insensitive" } } : undefined, orderBy: { createdAt: "desc" }, take: 100 });
  const ms = mailStatus();
  const o = d.dash.outbox;
  return (
    <>
      <Topbar crumb={`Admin / ${o.title}`} title={o.title} />
      <PageBody>
        {(!ms.email || !ms.sms) && <div className="rounded-2xl border border-brand-400/30 bg-brand-500/[.07] p-4 text-sm text-fg-muted">{o.howTo}</div>}
        <Panel>
          <form className="mb-4"><input name="q" defaultValue={q} placeholder={o.searchTo} className="input max-w-sm" /></form>
          <ul className="divide-y divide-line border-t border-line">
            {rows.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {r.channel === "EMAIL" ? <Mail size={15} className="text-brand-400" /> : <MessageSquare size={15} className="text-violet-400" />}
                  <span className="font-semibold">{r.to}</span>
                  {r.subject && <span className="text-fg-muted">· {r.subject}</span>}
                  <span className={cn("chip ml-auto", r.status === "SENT" ? "chip-ok" : r.status === "FAILED" ? "chip-bad" : r.status === "OUTBOX_ONLY" ? "chip-warn" : "")}>{o.status[r.status]}</span>
                  <span className="text-[12px] text-fg-dim">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                </div>
                <p className="mt-2 whitespace-pre-line break-words text-[13px] text-fg-muted">
                  {linkify(r.body).map((part, i) => (/^https?:\/\//.test(part) ? <a key={i} href={part} className="text-brand-400 underline" target="_blank" rel="noreferrer">{part}</a> : <span key={i}>{part}</span>))}
                </p>
                {r.error && <p className="mt-1 text-[12px] text-bad-soft">{r.error}</p>}
              </li>
            ))}
            {!rows.length && <li className="py-10 text-center text-fg-dim">{d.common.noData}</li>}
          </ul>
        </Panel>
      </PageBody>
    </>
  );
}
