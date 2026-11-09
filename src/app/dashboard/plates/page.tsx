import { Car, Search } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { PlateBadge } from "@/components/dash/Bits";
import { PlateCardActions, PlateLists } from "@/components/dash/MorePanels";
import { PlanLock } from "@/components/dash/PlanLock";
import { planFeatures } from "@/lib/plan";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { eventTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Licence plates read by the Edge agent: sharp photo + plate, searchable. */
export default async function PlatesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireCustomer();
  const { d, f } = await getDict();
  const p = f.plates;
  const q = ((await searchParams).q ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  const orgId = user.organization.id;
  const dayStart = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }) + "T00:00:00+05:00");
  const [rows, today, uniq] = await Promise.all([
    db.event.findMany({ where: { organizationId: orgId, plate: q ? { contains: q } : { not: null } }, orderBy: { occurredAt: "desc" }, take: 60, include: { camera: { select: { name: true } } } }),
    db.event.count({ where: { organizationId: orgId, plate: { not: null }, occurredAt: { gte: dayStart } } }),
    db.event.groupBy({ by: ["plate"], where: { organizationId: orgId, plate: { not: null } }, _count: { _all: true } }),
  ]);
  const seen = new Map(uniq.map((u) => [u.plate, u._count._all]));
  const [list, org] = await Promise.all([
    db.plateListItem.findMany({ where: { organizationId: orgId }, orderBy: [{ kind: "asc" }, { createdAt: "desc" }] }),
    db.organization.findUnique({ where: { id: orgId }, select: { unknownPlateAlert: true } }),
  ]);
  const kindOf = new Map(list.map((x) => [x.plate, x.kind]));
  const canEdit = user.orgRole !== "VIEWER";
  const feats = await planFeatures(orgId);
  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${f.menu.plates}`} title={p.title} chip={<span className="chip chip-blue hidden md:inline-flex">{fmt(p.today, { n: today })} · {fmt(p.unique, { n: uniq.length })}</span>} />
      <PageBody>
        {!feats.has("plates") && <PlanLock service={user.organization.service} feature="plates" />}
        <Panel>
          <form className="mb-5 flex gap-2">
            <input name="q" defaultValue={q} placeholder={p.search} className="input max-w-sm font-mono uppercase" />
            <button className="btn btn-ghost !h-11" aria-label="Search"><Search size={15} /></button>
          </form>
          {rows.length === 0 ? (
            <div className="grid place-items-center gap-3 py-12 text-center text-fg-dim">
              <Car size={30} />
              <p className="max-w-md">{p.empty}</p>
              <p className="max-w-md text-[12px]">{p.tip}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((e) => (
                <div key={e.id} className="overflow-hidden rounded-2xl border border-line bg-white/[.02]">
                  {e.snapshotKey ? (
                    <a href={`/api/events/${e.id}/snapshot`} target="_blank" title={p.open} className="block bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/events/${e.id}/snapshot`} alt={e.plate ?? ""} loading="lazy" className="aspect-[4/3] w-full object-contain" />
                    </a>
                  ) : (
                    <div className="grid aspect-[4/3] place-items-center bg-black/40 text-fg-dim"><Car size={28} /></div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <PlateBadge plate={e.plate!} big />
                    <span className="chip">{fmt(p.times, { n: seen.get(e.plate) ?? 1 })}</span>
                    <div className="w-full text-[12.5px] text-fg-dim">{eventTime(e.occurredAt, d)} · {e.camera?.name ?? "—"} · {Math.round((e.confidence ?? 0) * 100)}%</div>
                    <PlateCardActions plate={e.plate!} kind={kindOf.get(e.plate!) ?? null} canEdit={canEdit} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title={f.more.listsTitle} className="mt-5">
          {!feats.has("plateLists") && <PlanLock service={user.organization.service} feature="plateLists" />}
          <PlateLists items={list.map((x) => ({ plate: x.plate, kind: x.kind, note: x.note }))} unknownAlert={!!org?.unknownPlateAlert} canEdit={canEdit && feats.has("plateLists")} />
        </Panel>
      </PageBody>
    </>
  );
}
