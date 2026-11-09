import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { dictionaries, fmt, isLocale } from "@/lib/i18n";
import { cookies } from "next/headers";

/** Checks what the platform knows: Edge heartbeat freshness and camera last-seen time. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || (!s.org && s.role !== "ADMIN")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const cam = await db.camera.findFirst({ where: s.role === "ADMIN" ? { id } : { id, organizationId: s.org! }, include: { device: true } });
  if (!cam) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const l = (await cookies()).get("sv_lang")?.value;
  const d = dictionaries[isLocale(l) ? l : "uz"];
  const hb = cam.device?.lastHeartbeat;
  const edgeOk = !!hb && Date.now() - hb.getTime() < 5 * 60000;
  const last = cam.lastSeenAt ? cam.lastSeenAt.toTimeString().slice(0, 5) : "—";
  const message = !cam.device
    ? d.dash.edge.none
    : !edgeOk
      ? `${d.dash.edge.title}: ${d.common.offline} · ${fmt(d.dash.live.lastFrame, { t: last })}`
      : cam.status === "OFFLINE"
        ? fmt(d.dash.live.diagResult, { t: last })
        : d.common.online;
  return NextResponse.json({ edgeOnline: edgeOk, cameraStatus: cam.status, lastSeenAt: cam.lastSeenAt, message });
}
