import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { ActionButton } from "@/components/dash/ClientBits";
import { toggleMessage } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { ago, cn } from "@/lib/format";

export default async function MessagesPage() {
  const admin = await requireAdmin();
  const { d } = await getDict();
  const [msgs, notes] = await Promise.all([
    db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.notification.findMany({ where: { userId: admin.id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  await db.notification.updateMany({ where: { userId: admin.id, read: false }, data: { read: true } });
  return (
    <>
      <Topbar crumb={`Admin / ${d.dash.menu.notifications}`} title={d.dash.menu.notifications} />
      <PageBody>
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title={d.dash.adminOverview.messages}>
            <ul className="divide-y divide-line border-t border-line">
              {msgs.map((m) => (
                <li key={m.id} className={cn("flex items-start justify-between gap-3 py-4", m.handled && "opacity-50")}>
                  <div>
                    <div className="font-semibold">{m.name} <span className="font-normal text-fg-dim">· {m.phone}{m.email ? ` · ${m.email}` : ""}{m.service ? ` · ${m.service}` : ""}</span></div>
                    <p className="mt-1 text-sm text-fg-muted">{m.message}</p>
                    <div className="mt-1 text-xs text-fg-dim">{ago(m.createdAt, d)}</div>
                  </div>
                  <ActionButton action={toggleMessage.bind(null, m.id)} className={cn("chip shrink-0 cursor-pointer", m.handled ? "chip-ok" : "chip-warn")}>{m.handled ? "✓" : "•"}</ActionButton>
                </li>
              ))}
              {msgs.length === 0 && <li className="py-6 text-sm text-fg-dim">{d.common.noData}</li>}
            </ul>
          </Panel>
          <Panel title={d.dash.notificationsPage.title}>
            <ul className="divide-y divide-line border-t border-line">
              {notes.map((n) => (
                <li key={n.id} className="py-3"><div className="font-semibold">{n.title}</div><div className="text-sm text-fg-dim">{n.body} · {ago(n.createdAt, d)}</div></li>
              ))}
              {notes.length === 0 && <li className="py-6 text-sm text-fg-dim">{d.common.noData}</li>}
            </ul>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
