import "server-only";
import { db } from "./db";
import { startOfDay } from "./dashboard";
import type { LiveCam, LiveEvent } from "@/components/dash/LiveWall";

/** Everything the live monitoring wall needs for one organization (customer view and admin view). */
export async function loadLive(orgId: string) {
  const today = startOfDay();
  const [cams, events, stats, latestOcc, faces] = await Promise.all([
    db.camera.findMany({ where: { organizationId: orgId }, orderBy: { code: "asc" } }),
    db.event.findMany({ where: { organizationId: orgId }, orderBy: { occurredAt: "desc" }, take: 20, include: { camera: true } }),
    db.event.groupBy({ by: ["cameraId", "type"], where: { organizationId: orgId, occurredAt: { gte: today } }, _count: { _all: true }, _avg: { confidence: true } }),
    db.event.findMany({ where: { organizationId: orgId, type: "OCCUPANCY", occurredAt: { gte: today } }, orderBy: { occurredAt: "desc" }, distinct: ["cameraId"], select: { cameraId: true, value: true } }),
    db.event.findMany({ where: { organizationId: orgId, snapshotKey: { not: null } }, orderBy: { occurredAt: "desc" }, take: 60, include: { camera: { select: { name: true } } } }),
  ]);

  // Main gate first; counts are "entered/exited today"
  const liveCams: LiveCam[] = cams
    .sort((a, b) => (a.scene === "gate" ? -1 : b.scene === "gate" ? 1 : 0))
    .map((c) => {
      const s = stats.filter((x) => x.cameraId === c.id);
      const count = (t: string) => s.filter((x) => x.type === t).reduce((n, x) => n + x._count._all, 0);
      const confs = s.filter((x) => x._avg.confidence != null);
      const avg = confs.length ? confs.reduce((n, x) => n + (x._avg.confidence ?? 0) * x._count._all, 0) / confs.reduce((n, x) => n + x._count._all, 0) : null;
      return {
        id: c.id, code: c.code, name: c.name, location: c.location, status: c.status, fps: c.fps, resolution: c.resolution, protocol: c.protocol,
        scene: c.scene as LiveCam["scene"], streamUrl: c.streamUrl, capacity: c.capacity, lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
        nightMode: (["auto", "on", "off"].includes(c.nightMode) ? c.nightMode : "auto") as LiveCam["nightMode"],
        nightActive: c.nightMode !== "off" && c.nightActive && c.status !== "OFFLINE" && !!c.lastSeenAt && Date.now() - c.lastSeenAt.getTime() < 60_000,
        // only line crossings count as entries; PERSON is "detected in view", not "entered"
        stats: { entered: count("ENTRY"), exited: count("EXIT"), avgConf: avg, occupancy: latestOcc.find((o) => o.cameraId === c.id)?.value ?? null },
      };
    });
  const liveEvents: LiveEvent[] = events.map((e) => ({ id: e.id, type: e.type, at: e.occurredAt.toISOString(), camera: e.camera?.name ?? "—", trackId: e.trackId, confidence: e.confidence, value: e.value, severity: e.severity, snap: !!e.snapshotKey }));

  // one picture per tracked person (a person can have both a "detected" and an "intrusion" snapshot)
  const seen = new Set<string>();
  const faceList: LiveEvent[] = faces
    .filter((e) => {
      const k = e.trackId ? `${e.cameraId}:${e.trackId}` : e.id;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 12)
    .map((e) => ({ id: e.id, type: e.type, at: e.occurredAt.toISOString(), camera: e.camera?.name ?? "—", trackId: e.trackId, confidence: e.confidence, value: e.value, severity: e.severity, snap: true }));

  // Night Vision is a feature of the plan that is active right now (Pro)
  const sub = await db.subscription.findFirst({ where: { organizationId: orgId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } }, include: { plan: { select: { features: true } } } });
  return { cams: liveCams, events: liveEvents, faces: faceList, nightAllowed: !!sub?.plan.features.includes("nightVision") };
}
