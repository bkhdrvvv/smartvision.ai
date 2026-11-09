import { UserRound } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { PlanLock } from "@/components/dash/PlanLock";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { planFeatures } from "@/lib/plan";
import { getDict } from "@/lib/i18n/server";
import { eventTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Visitor log: people with a face photo that were NOT recognised as a student / teacher
 * (a recognised person produces a STUDENT event with the same track on the same camera within a few minutes).
 */
export default async function VisitorsPage() {
  const user = await requireCustomer();
  const { d, f } = await getDict();
  const org = user.organization;
  const feats = await planFeatures(org.id);
  const since = new Date(Date.now() - 14 * 86400_000);
  const [persons, known] = await Promise.all([
    db.event.findMany({ where: { organizationId: org.id, type: { in: ["PERSON", "UNKNOWN_PERSON"] }, snapshotKey: { not: null }, occurredAt: { gte: since } }, orderBy: { occurredAt: "desc" }, take: 300, include: { camera: { select: { name: true } } } }),
    db.event.findMany({ where: { organizationId: org.id, type: "STUDENT", occurredAt: { gte: since } }, select: { cameraId: true, trackId: true, occurredAt: true } }),
  ]);
  const recognised = (p: (typeof persons)[number]) =>
    known.some((k) => k.cameraId === p.cameraId && k.trackId && k.trackId === p.trackId && Math.abs(k.occurredAt.getTime() - p.occurredAt.getTime()) < 10 * 60_000);
  const rows = persons.filter((p) => !recognised(p)).slice(0, 120);
  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${f.x.visitorsMenu}`} title={f.x.visitorsTitle} />
      <PageBody>
        {!feats.has("visitorLog") && <PlanLock service={org.service} feature="visitorLog" />}
        <Panel sub={f.x.visitorsLead}>
          {!feats.has("visitorLog") ? null : rows.length === 0 ? (
            <div className="grid place-items-center gap-3 py-12 text-fg-dim"><UserRound size={28} /> {f.x.visitorsEmpty}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
              {rows.map((p) => (
                <a key={p.id} href={`/api/events/${p.id}/snapshot`} target="_blank" className="overflow-hidden rounded-2xl border border-line bg-white/[.02] hover:border-brand-400/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/events/${p.id}/snapshot`} alt="" loading="lazy" className="aspect-square w-full bg-black object-cover" />
                  <div className="p-2.5 text-[12px] text-fg-muted">
                    <div className="font-mono text-fg">{eventTime(p.occurredAt, d)}</div>
                    <div className="truncate">{p.camera?.name ?? "—"}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
