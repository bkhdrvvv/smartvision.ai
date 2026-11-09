import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { ZoneEditor } from "@/components/dash/ZoneEditor";
import { PlanLock } from "@/components/dash/PlanLock";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { planFeatures } from "@/lib/plan";
import { getDict } from "@/lib/i18n/server";
import { cn } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Forbidden zone (all) and, on farms, the animals' pen. */
export default async function ZonePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string }> }) {
  const user = await requireCustomer();
  const { d, f } = await getDict();
  const { id } = await params;
  const org = user.organization;
  const cam = await db.camera.findFirst({ where: { id, organizationId: org.id } });
  if (!cam) notFound();
  const feats = await planFeatures(org.id);
  const kind = (await searchParams).kind === "pen" ? "pen" : "zone";
  const feature = kind === "pen" ? "animalPen" : "zone";
  const pts = (v: unknown) => (Array.isArray(v) ? (v as [number, number][]) : null);
  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${d.dash.menu.cameras} / ${cam.name}`} title={kind === "pen" ? f.x.penTab : f.zone.title} />
      <PageBody>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link href="/dashboard/cameras" className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"><ArrowLeft size={15} /> {d.common.back}</Link>
          {org.service === "FARM" && (
            <div className="ml-auto flex gap-2">
              {(["zone", "pen"] as const).map((k) => (
                <Link key={k} href={`?kind=${k}`} className={cn("btn btn-sm", kind === k ? "btn-primary" : "btn-ghost")}>{k === "pen" ? f.x.penTab : f.x.zoneTab}</Link>
              ))}
            </div>
          )}
        </div>
        {!feats.has(feature) && <PlanLock service={org.service} feature={feature} />}
        <Panel title={`${cam.code} · ${cam.name}`}>
          <ZoneEditor
            key={kind}
            cameraId={cam.id}
            field={kind}
            initial={pts(kind === "pen" ? cam.pen : cam.zone)}
            streamUrl={`/api/cameras/${cam.id}/stream`}
            canEdit={user.orgRole !== "VIEWER" && feats.has(feature)}
          />
        </Panel>
      </PageBody>
    </>
  );
}
