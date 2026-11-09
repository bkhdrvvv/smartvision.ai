import { Bell } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { ActionButton } from "@/components/dash/ClientBits";
import { markAllRead } from "@/app/actions/customer";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { ago, cn } from "@/lib/format";

export default async function NotificationsPage() {
  const user = await requireCustomer();
  const { d } = await getDict();
  const rows = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${d.dash.menu.notifications}`} title={d.dash.notificationsPage.title} demo={user.organization.demo} />
      <PageBody>
        <Panel action={<ActionButton action={markAllRead} className="btn btn-ghost btn-sm">{d.common.markAllRead}</ActionButton>} title={`${rows.filter((r) => !r.read).length}`} sub={d.dash.notificationsPage.title}>
          <ul className="divide-y divide-line border-t border-line">
            {rows.map((n) => (
              <li key={n.id} className="flex items-center gap-4 py-4">
                <span className={cn("icon-tile !h-10 !w-10", n.read && "opacity-50")}><Bell size={16} /></span>
                <div className="flex-1">
                  <div className={n.read ? "text-fg-muted" : "font-semibold"}>{n.title}</div>
                  <div className="text-sm text-fg-dim">{n.body}</div>
                </div>
                <span className="text-xs text-fg-dim">{ago(n.createdAt, d)}</span>
                {!n.read && <span className="h-2 w-2 rounded-full bg-brand-400" />}
              </li>
            ))}
            {rows.length === 0 && <li className="py-10 text-center text-fg-dim">{d.common.noData}</li>}
          </ul>
        </Panel>
      </PageBody>
    </>
  );
}
