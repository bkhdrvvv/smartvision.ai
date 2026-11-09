import Link from "next/link";
import { UserRound } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { KIND_CHIP, STATUS_CHIP } from "@/components/support/Thread";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { ago, cn, maskPhone } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.dash.menu.tickets };
}

const TABS = ["OPEN", "ANSWERED", "CLOSED", "ALL"] as const;

export default async function AdminTicketsPage({ searchParams }: { searchParams: Promise<{ s?: string; q?: string }> }) {
  await requireAdmin();
  const { d } = await getDict();
  const t = d.support;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.s ?? "") ? (sp.s as (typeof TABS)[number]) : "OPEN";
  const q = sp.q?.trim();
  const [tickets, counts] = await Promise.all([
    db.ticket.findMany({
      where: {
        ...(tab === "ALL" ? {} : { status: tab }),
        ...(q
          ? { OR: [{ subject: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, ...(/^\d+$/.test(q) ? [{ number: Number(q) }] : [])] }
          : {}),
      },
      orderBy: [{ unreadAdmin: "desc" }, { updatedAt: "desc" }],
      take: 200,
      include: { organization: { select: { id: true, name: true, service: true } }, _count: { select: { messages: true } } },
    }),
    db.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const now = Date.now();
  const n = (s: string) => (s === "ALL" ? counts.reduce((a, c) => a + c._count._all, 0) : counts.find((c) => c.status === s)?._count._all ?? 0);

  return (
    <>
      <Topbar crumb={`Admin / ${d.dash.menu.tickets}`} title={t.title} />
      <PageBody>
        <Panel>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {TABS.map((s) => (
              <Link key={s} href={`/admin/tickets?s=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cn("btn btn-sm", s === tab ? "btn-primary" : "btn-ghost")}>
                {s === "ALL" ? t.all : t.status[s]} <span className="rounded-md bg-white/10 px-1.5 text-[11px]">{n(s)}</span>
              </Link>
            ))}
            <form className="ml-auto">
              <input type="hidden" name="s" value={tab} />
              <input name="q" defaultValue={q} placeholder={d.dash.adminSecurity.search} className="input !h-10 w-[260px] max-w-full" />
            </form>
          </div>
          {tickets.length === 0 ? (
            <p className="py-10 text-center text-fg-dim">{t.none}</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {tickets.map((x) => (
                <li key={x.id}>
                  <Link href={`/admin/tickets/${x.id}`} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 hover:bg-white/[.02] sm:flex-nowrap", x.unreadAdmin && "[&_.subj]:text-fg")}>
                    <span className="w-14 shrink-0 font-mono text-[13px] text-fg-dim">#{x.number}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {x.unreadAdmin && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-400" aria-label={t.unread} />}
                        <span className="subj truncate font-semibold text-fg-muted">{x.subject}</span>
                        <span className={cn("chip !h-5 shrink-0 !px-2 !text-[10px]", KIND_CHIP[x.kind])}>{t.kinds[x.kind]}</span>
                        {x.clientSince && x.clientSeenAt && now - x.clientSeenAt.getTime() < 15000 && (
                          <span className="chip chip-ok !h-5 shrink-0 !px-2 !text-[10px]"><span className="h-1.5 w-1.5 rounded-full bg-ok" /> {t.online}</span>
                        )}
                      </div>
                      {/* who wrote — always visible in the list */}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-fg-dim">
                        <UserRound size={13} className="text-brand-400" />
                        <span className="font-medium text-fg-muted">{x.name}</span>{x.email && <>· {x.email}</>}
                        {x.phone && <>· {maskPhone(x.phone)}</>}·
                        {x.organization ? <span className="text-brand-300">{x.organization.name}</span> : <span className="italic">{t.guest}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-[12px] text-fg-dim">
                      {ago(x.updatedAt, d)} · {x._count.messages}
                      <span className={cn("chip", STATUS_CHIP[x.status])}>{t.status[x.status]}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
