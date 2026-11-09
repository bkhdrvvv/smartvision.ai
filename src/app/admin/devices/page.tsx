import { Server } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { DeviceForm, RotateToken } from "@/components/dash/AdminForms";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { ago, cn } from "@/lib/format";

export default async function DevicesPage() {
  await requireAdmin();
  const { d } = await getDict();
  const [devices, orgs] = await Promise.all([
    db.edgeDevice.findMany({ include: { organization: true, _count: { select: { cameras: true } } }, orderBy: { createdAt: "desc" } }),
    db.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const p = d.dash.adminDevices;
  return (
    <>
      <Topbar crumb={`Admin / ${d.dash.menu.devices}`} title={p.title} />
      <PageBody>
        <Panel title={p.create}><DeviceForm orgs={orgs} /></Panel>
        <Panel>
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[760px]">
              <thead><tr><th>{p.serial}</th><th>{p.org}</th><th>{p.firmware}</th><th>{d.dash.menu.cameras}</th><th>{p.heartbeat}</th><th>CPU / GPU</th><th /></tr></thead>
              <tbody>
                {devices.map((dv) => {
                  const online = dv.lastHeartbeat && Date.now() - dv.lastHeartbeat.getTime() < 5 * 60000;
                  return (
                    <tr key={dv.id}>
                      <td><span className="flex items-center gap-2 font-mono font-semibold"><Server size={15} className="text-brand-400" /> {dv.serial}</span></td>
                      <td>{dv.organization.name}</td>
                      <td className="text-fg-muted">{dv.firmware}</td>
                      <td>{dv._count.cameras}</td>
                      <td><span className={cn("chip", online ? "chip-ok" : "chip-bad")}>{dv.lastHeartbeat ? ago(dv.lastHeartbeat, d) : "—"}</span></td>
                      <td className="text-fg-muted">{dv.cpu ?? "—"}% / {dv.gpu ?? "—"}%</td>
                      <td className="text-right"><RotateToken id={dv.id} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
