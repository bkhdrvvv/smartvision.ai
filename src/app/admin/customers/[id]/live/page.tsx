import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { Topbar, PageBody } from "@/components/dash/Shell";
import { LiveWall } from "@/components/dash/LiveWall";
import { audit, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadLive } from "@/lib/live";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** Admin view of a customer's cameras (live video, AI events, snapshots). Every visit is written to the audit log. */
export default async function AdminCustomerLive({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { d } = await getDict();
  const { id } = await params;
  const org = await db.organization.findUnique({ where: { id }, select: { id: true, name: true, demo: true } });
  if (!org) notFound();
  await audit(admin.id, "admin.view_cameras", org.id, { name: org.name });
  const live = await loadLive(org.id);
  return (
    <>
      <Topbar
        crumb={`Admin / ${d.dash.menu.customers} / ${org.name}`}
        title={`${org.name} · ${d.dash.menu.live}`}
        chip={<span className="chip chip-warn hidden !h-11 !rounded-xl !px-4 !text-[14px] md:inline-flex"><Eye size={14} /> {d.dash.adminSecurity.adminView}</span>}
      />
      <PageBody>
        <Link href={`/admin/customers/${org.id}`} className="mb-4 inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"><ArrowLeft size={15} /> {d.common.back}</Link>
        {live.cams.length === 0 ? (
          <div className="card grid min-h-[240px] place-items-center !rounded-[20px] p-8 text-fg-dim">{d.dash.adminSecurity.noCameras}</div>
        ) : (
          <LiveWall cams={live.cams} initialEvents={live.events} initialFaces={live.faces} demo={org.demo} orgId={org.id} nightAllowed={live.nightAllowed} />
        )}
      </PageBody>
    </>
  );
}
