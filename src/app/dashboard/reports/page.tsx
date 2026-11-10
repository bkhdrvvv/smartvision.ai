import Link from "next/link";
import { CalendarDays, Download, FileText } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { PrintButton } from "@/components/dash/PrintButton";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";

export default async function ReportsPage() {
  const user = await requireCustomer();
  const { d, f } = await getDict();
  const org = user.organization;
  const counts = await Promise.all([1, 7, 30].map((n) => db.event.count({ where: { organizationId: org.id, occurredAt: { gte: new Date(Date.now() - n * 86400000) } } })));
  const p = d.dash.reportsPage;
  const items = [
    { t: p.daily, days: 1, n: counts[0] },
    { t: p.weekly, days: 7, n: counts[1] },
    { t: p.monthly, days: 30, n: counts[2] },
  ];
  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${d.dash.menu.reports}`} title={p.title} demo={org.demo} chip={<PrintButton label={p.print} />} />
      <PageBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-fg-muted">{p.text}</p>
          <Link href="/report/month" className="btn btn-primary"><FileText size={15} /> {f.z.report.link}</Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {items.map((it) => (
            <Panel key={it.days}>
              <span className="icon-tile"><FileText size={18} /></span>
              <h2 className="mt-5 text-lg font-bold">{it.t}</h2>
              <div className="mt-1 flex items-center gap-2 text-sm text-fg-dim"><CalendarDays size={14} /> {it.days}d · {it.n} {d.dash.events.toLowerCase()}</div>
              <a href={`/api/reports/events?days=${it.days}`} className="btn btn-primary mt-6 w-full"><Download size={15} /> {p.download}</a>
            </Panel>
          ))}
        </div>
      </PageBody>
    </>
  );
}
