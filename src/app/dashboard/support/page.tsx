import Link from "next/link";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { TicketForm } from "@/components/support/TicketForms";
import { KIND_CHIP, STATUS_CHIP } from "@/components/support/Thread";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict, getLocale } from "@/lib/i18n/server";
import { featureDicts } from "@/lib/i18n/features";
import { ReviewForm } from "@/components/site/Reviews";
import { ago, cn } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.support.title };
}

export default async function CustomerSupportPage() {
  const user = await requireCustomer();
  const locale = await getLocale();
  const { d } = await getDict();
  const t = d.support;
  const tickets = await db.ticket.findMany({
    where: { organizationId: user.organization.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${t.title}`} title={t.title} />
      <PageBody>
        <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
          <Panel title={t.new}>
            <TicketForm guest={false} />
          </Panel>
          <Panel title={t.mine}>
            {tickets.length === 0 ? (
              <p className="py-8 text-center text-fg-dim">{t.none}</p>
            ) : (
              <ul className="divide-y divide-line">
                {tickets.map((x) => (
                  <li key={x.id}>
                    <Link href={`/dashboard/support/${x.id}`} className="flex items-center gap-3 py-3.5 hover:bg-white/[.02]">
                      <span className="w-14 shrink-0 font-mono text-[13px] text-fg-dim">#{x.number}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold">{x.subject}</span>
                          {x.unreadCustomer && <span className="chip chip-blue !h-5 !px-2 !text-[10px]">{t.unread}</span>}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-fg-dim">
                          <span className={cn("chip !h-5 !px-2 !text-[10px]", KIND_CHIP[x.kind])}>{t.kinds[x.kind]}</span>
                          {ago(x.updatedAt, d)} · {x._count.messages}
                        </div>
                      </div>
                      <span className={cn("chip shrink-0", STATUS_CHIP[x.status])}>{t.status[x.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <Panel title={featureDicts[locale].x.reviewWrite} className="mt-5"><ReviewForm name={user.name} /></Panel>
      </PageBody>
    </>
  );
}
