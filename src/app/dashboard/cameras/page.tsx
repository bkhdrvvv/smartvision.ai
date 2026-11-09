import Link from "next/link";
import { SensitivityChip } from "@/components/dash/MorePanels";
import { Cctv, OctagonAlert, Trash2 } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { CamStatusChip } from "@/components/dash/Bits";
import { AddCameraButton, EditCameraButton } from "@/components/dash/CameraForm";
import { ActionButton } from "@/components/dash/ClientBits";
import { removeCamera } from "@/app/actions/customer";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveSubscription } from "@/lib/dashboard";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { ago } from "@/lib/format";

export default async function CamerasPage() {
  const user = await requireCustomer();
  const { d, f } = await getDict();
  const org = user.organization;
  const [cams, sub] = await Promise.all([db.camera.findMany({ where: { organizationId: org.id }, orderBy: { code: "asc" } }), getActiveSubscription(org.id)]);
  const p = d.dash.camerasPage;
  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${d.dash.menu.cameras}`} title={p.title} demo={org.demo} />
      <PageBody>
        <Panel title={`${cams.length} / ${sub?.plan.maxCameras ?? 0}`} sub={fmt(p.limit, { n: sub?.plan.maxCameras ?? 0 })} action={<AddCameraButton />}>
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[720px]">
              <thead><tr><th>{p.name}</th><th>{p.location}</th><th>{p.protocol}</th><th>{p.signal}</th><th>{p.lastSeen}</th><th>{d.common.status}</th><th /></tr></thead>
              <tbody>
                {cams.map((c) => (
                  <tr key={c.id}>
                    <td><div className="flex items-center gap-3"><span className="icon-tile !h-9 !w-9"><Cctv size={15} /></span><div><div className="font-semibold">{c.name}</div><div className="flex items-center gap-2 text-xs text-fg-dim">{c.code} · {c.resolution} · {c.fps} fps {c.streamUrl && <span className="chip chip-blue !h-5 !px-1.5 !text-[10px]">HLS</span>}</div></div></div></td>
                    <td className="text-fg-muted">{c.location ?? "—"}</td>
                    <td className="text-fg-muted">{c.protocol}</td>
                    <td><div className="h-1.5 w-20 overflow-hidden rounded bg-white/10"><div className="h-full rounded bg-brand-400" style={{ width: `${c.signal}%` }} /></div></td>
                    <td className="text-fg-muted">{c.lastSeenAt ? ago(c.lastSeenAt, d) : "—"}</td>
                    <td>
                      {c.streamUrl && !c.deviceId ? (
                        <span className="chip chip-blue min-w-[110px] justify-center">HLS</span>
                      ) : (
                        <CamStatusChip s={c.status} label={c.status === "ONLINE" ? d.common.online : c.status === "WEAK" ? d.common.weak : d.common.offline} />
                      )}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <SensitivityChip cameraId={c.id} minConf={c.minConf} />
                        <Link href={`/dashboard/cameras/${c.id}/zone`} title={f.zone.draw} className={`grid h-9 w-9 place-items-center rounded-lg hover:bg-white/5 ${c.zone ? "text-rose-400" : "text-fg-dim"}`}><OctagonAlert size={15} /></Link>
                        <EditCameraButton cam={{ id: c.id, name: c.name, code: c.code, location: c.location, protocol: c.protocol, sourceUrl: c.sourceUrl, streamUrl: c.streamUrl, scene: c.scene }} />
                        <ActionButton action={removeCamera.bind(null, c.id)} confirm={p.confirmRemove} className="grid h-9 w-9 place-items-center rounded-lg text-fg-dim hover:bg-bad/10 hover:text-bad-soft"><Trash2 size={15} /></ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
                {cams.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-fg-dim">{d.common.noData}</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
