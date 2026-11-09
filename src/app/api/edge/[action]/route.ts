import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { edgeDevice } from "@/lib/edge";
import { edgeEventSchema, heartbeatSchema } from "@/lib/validators";
import { getActiveSubscription, hasService } from "@/lib/subscription";
import { saveSnapshot } from "@/lib/storage";
import { notifyUsers, tf } from "@/lib/notify";
import { dictionaries, fmt } from "@/lib/i18n";
import { featureDicts } from "@/lib/i18n/features";
import { readFace } from "@/lib/faces";
import { planFeatures } from "@/lib/plan";
import { sendText, telegramToOrg } from "@/lib/telegram";

/**
 * Farm: the animal count of a camera fell clearly below yesterday's usual number → warn (at most every 6 h per camera).
 * "Usual" = the highest count seen 24–48 h ago; small herds (< 3) are ignored.
 */
async function livestockDrop(orgId: string, rows: { cameraId: string | null; value?: number | null; occurredAt: Date }[], userIds: string[]) {
  for (const r of rows) {
    if (!r.cameraId || r.value == null) continue;
    const day = 86400_000;
    const prev = await db.event.aggregate({ where: { cameraId: r.cameraId, type: "LIVESTOCK", occurredAt: { gte: new Date(r.occurredAt.getTime() - 2 * day), lt: new Date(r.occurredAt.getTime() - day) } }, _max: { value: true } });
    const usual = prev._max.value ?? 0;
    if (usual < 3 || r.value > usual * 0.8) continue;
    const key = `livestock-drop:${r.cameraId}`;
    const last = await db.setting.findUnique({ where: { key } });
    if (last && Date.now() - Number(last.value) < 6 * 3600_000) continue;
    await db.setting.upsert({ where: { key }, create: { key, value: String(Date.now()) }, update: { value: String(Date.now()) } });
    const cam = await db.camera.findUnique({ where: { id: r.cameraId }, select: { name: true } });
    const vars = { c: cam?.name ?? "", n: r.value, u: usual };
    await notifyUsers(userIds, "EVENT", (d) => {
      const f = featureDicts[(Object.entries(dictionaries).find(([, v]) => v === d)?.[0] ?? "uz") as keyof typeof featureDicts].more;
      return { title: f.livestockTitle, body: fmt(f.livestockBody, vars) };
    }, "important", "/dashboard/events?type=LIVESTOCK");
    await telegramToOrg(orgId, (l) => `🐄 ${featureDicts[l].more.livestockTitle}\n${fmt(featureDicts[l].more.livestockBody, vars)}`).catch(() => {});
  }
}

/** School attendance: first sighting of the day marks the student present and messages the parents. */
async function recordAttendance(rows: { studentId: string | null; cameraId: string | null; occurredAt: Date; value?: number | null }[], byCode: Map<string, { id: string; name: string }>) {
  const camName = new Map([...byCode.values()].map((c) => [c.id, c.name]));
  for (const r of rows) {
    const day = r.occurredAt.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }); // YYYY-MM-DD
    const prev = await db.attendance.findUnique({ where: { studentId_day: { studentId: r.studentId!, day } } });
    // value 2 = the recognised student crossed the counting line going OUT → "left school" for the parents (once a day)
    if (r.value === 2) {
      if (prev && r.occurredAt > prev.lastSeenAt) await db.attendance.update({ where: { id: prev.id }, data: { lastSeenAt: r.occurredAt } });
      const st = await db.student.findUnique({ where: { id: r.studentId! } });
      if (st?.parentChats.length) {
        const flag = await db.setting.create({ data: { key: `left:${st.id}:${day}`, value: r.occurredAt.toISOString() } }).catch(() => null);
        if (flag) {
          const t = r.occurredAt.toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });
          for (const chat of st.parentChats) await sendText(chat, fmt(featureDicts.uz.x.left, { n: st.name, t })).catch(() => {});
        }
      }
      if (prev) continue;
    }
    if (prev) {
      if (r.occurredAt > prev.lastSeenAt) await db.attendance.update({ where: { id: prev.id }, data: { lastSeenAt: r.occurredAt } });
      continue;
    }
    await db.attendance.create({ data: { studentId: r.studentId!, day, firstSeenAt: r.occurredAt, lastSeenAt: r.occurredAt, camera: r.cameraId ? camName.get(r.cameraId) : null } });
    const st = await db.student.findUnique({ where: { id: r.studentId! } });
    const t = r.occurredAt.toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });
    for (const chat of st?.parentChats ?? []) await sendText(chat, fmt(featureDicts.uz.students.arrived, { n: st!.name, t })).catch(() => {});
  }
}

/**
 * Edge AI server ingestion API.
 *   POST /api/edge/heartbeat  { cpu, gpu, firmware, cameras:[{code,status,signal,fps}] }
 *   POST /api/edge/events     { events:[{camera,type,severity,confidence,trackId,value,occurredAt}] }
 * Auth: "Authorization: Bearer <device token>" (sha256 stored in EdgeDevice.tokenHash)
 */
const device = edgeDevice;

/** GET /api/edge/config — cameras the Edge agent should analyse */
export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "config" && action !== "face") return NextResponse.json({ error: "unknown_action" }, { status: 404 });
  const dev = await device(req);
  if (!dev) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // GET /api/edge/face?id=<studentId> — the registered face photo (only for this device's organization)
  if (action === "face") {
    const st = await db.student.findFirst({ where: { id: new URL(req.url).searchParams.get("id") ?? "", organizationId: dev.organizationId } });
    const buf = st?.photoKey ? await readFace(st.photoKey).catch(() => null) : null;
    if (!buf) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
  }
  if (!(await hasService(dev.organizationId)))
    return NextResponse.json({ error: "subscription_inactive", message: "Subscription expired or not active — renew in the dashboard." }, { status: 402 });
  const cams = await db.camera.findMany({
    where: { organizationId: dev.organizationId, aiEnabled: true },
    select: { code: true, name: true, sourceUrl: true, streamUrl: true, scene: true, capacity: true, nightMode: true, zone: true, minConf: true, pen: true },
    orderBy: { code: "asc" },
  });
  // Night vision is part of the top plan only (feature key "nightVision"); the agent re-reads this every minute
  const sub = await getActiveSubscription(dev.organizationId);
  const nightVision = !!sub?.plan.features.includes("nightVision");
  const org = dev.organization;
  // students with a face photo → the agent builds face templates locally (photos are fetched with /api/edge/face)
  // the plan decides which analytics run on the Edge (Start: simple · Standard: stronger · Pro: everything)
  const feats = await planFeatures(org.id);
  const kinds = [...(feats.has("faceAttendance") ? ["STUDENT"] : []), ...(feats.has("teacherAttendance") ? ["TEACHER"] : [])];
  const students = kinds.length ? await db.student.findMany({ where: { organizationId: org.id, photoKey: { not: null }, kind: { in: kinds } }, select: { id: true, name: true, photoKey: true } }) : [];
  return NextResponse.json({
    device: dev.serial, organization: org.name, service: org.service, plan: sub?.plan.tier ?? null, nightVision, cameras: cams,
    features: [...feats],
    guard: { mode: org.guardMode, from: org.guardFrom, to: org.guardTo },
    school: { start: org.schoolStart, end: org.schoolEnd },
    students: students.map((s) => ({ id: s.id, name: s.name, v: s.photoKey })),
  });
}

const MAX_EDGE_BODY = 12 * 1024 * 1024; // events may carry snapshots; the agent sends ≤100 per batch

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_EDGE_BODY) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const dev = await device(req);
  if (!dev) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { action } = await params;
  const body = await req.json().catch(() => null);

  if (action === "heartbeat") {
    const p = heartbeatSchema.safeParse(body ?? {});
    if (!p.success) return NextResponse.json({ error: "invalid", issues: p.error.issues }, { status: 400 });
    await db.edgeDevice.update({ where: { id: dev.id }, data: { lastHeartbeat: new Date(), cpu: p.data.cpu, gpu: p.data.gpu, firmware: p.data.firmware ?? dev.firmware } });
    for (const c of p.data.cameras ?? []) {
      const cam = await db.camera.findFirst({ where: { organizationId: dev.organizationId, code: c.code } });
      if (!cam) continue;
      if (cam.status !== "OFFLINE" && c.status === "OFFLINE") {
        await db.event.create({ data: { organizationId: dev.organizationId, cameraId: cam.id, type: "CAMERA_STATUS", severity: "CRITICAL" } });
        await notifyUsers(dev.organization.users.map((u) => u.id), "CAMERA", tf("cameraOffline", "cameraOfflineBody", { c: cam.name }), "critical", "/dashboard/live");
      }
      await db.camera.update({
        where: { id: cam.id },
        data: {
          status: c.status, signal: c.signal, fps: c.fps ?? cam.fps, lastSeenAt: c.status === "OFFLINE" ? cam.lastSeenAt : new Date(),
          deviceId: cam.deviceId ?? dev.id,
          ...(c.streamUrl && { streamUrl: c.streamUrl }),
          ...(c.nightVision !== undefined && { nightActive: c.nightVision && c.status !== "OFFLINE" }),
          // heatmap: add the new counts to the stored grid, older counts fade a little (×0.98 per report)
          ...(c.heat?.length === 576 && {
            heat: (() => {
              const old = Array.isArray(cam.heat) && (cam.heat as number[]).length === 576 ? (cam.heat as number[]) : new Array(576).fill(0);
              return old.map((v, i) => Math.round((v * 0.98 + c.heat![i]) * 10) / 10);
            })(),
            heatAt: new Date(),
          }),
        },
      });
    }
    return NextResponse.json({ ok: true, serverTime: new Date().toISOString() });
  }

  if (action === "events") {
    // heartbeats are still accepted (so the dashboard knows the device is alive), events are not
    if (!(await hasService(dev.organizationId)))
      return NextResponse.json({ error: "subscription_inactive", message: "Subscription expired or not active — renew in the dashboard." }, { status: 402 });
    const p = edgeEventSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "invalid", issues: p.error.issues }, { status: 400 });
    const cams = await db.camera.findMany({ where: { organizationId: dev.organizationId }, select: { id: true, code: true, name: true } });
    const byCode = new Map(cams.map((c) => [c.code, c]));
    // licence plate lists: known car → quiet, blacklisted → critical, unknown → warning if the customer asked for it
    const feats = await planFeatures(dev.organizationId);
    const plates = p.data.events.filter((e) => e.type === "VEHICLE" && e.plate).map((e) => e.plate!);
    if (plates.length && feats.has("plateLists")) {
      const [list, org] = await Promise.all([
        db.plateListItem.findMany({ where: { organizationId: dev.organizationId, plate: { in: plates } } }),
        db.organization.findUnique({ where: { id: dev.organizationId }, select: { unknownPlateAlert: true } }),
      ]);
      const kind = new Map(list.map((x) => [x.plate, x.kind]));
      for (const e of p.data.events) {
        if (e.type !== "VEHICLE" || !e.plate) continue;
        const k = kind.get(e.plate);
        e.severity = k === "BLACK" ? "CRITICAL" : k === "WHITE" ? "INFO" : org?.unknownPlateAlert ? "WARNING" : "INFO";
      }
    }
    const data = await Promise.all(
      p.data.events.map(async (e) => ({
        id: randomUUID(), // known up front so Telegram buttons can point at the event
        organizationId: dev.organizationId,
        cameraId: byCode.get(e.camera)?.id ?? null,
        type: e.type,
        severity: e.severity,
        confidence: e.confidence,
        trackId: e.trackId,
        value: e.value,
        snapshotKey: e.snapshot ? await saveSnapshot(e.snapshot) : null,
        studentId: e.type === "STUDENT" && e.student ? e.student : null,
        plate: e.type === "VEHICLE" && e.plate ? e.plate : null,
        occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
      })),
    );
    // a student id must belong to this organization
    const ownIds = new Set((await db.student.findMany({ where: { organizationId: dev.organizationId }, select: { id: true } })).map((s) => s.id));
    for (const row of data) if (row.studentId && !ownIds.has(row.studentId)) row.studentId = null;
    await db.event.createMany({ data });
    await recordAttendance(data.filter((r) => r.studentId), byCode);
    if (feats.has("livestockDrop")) await livestockDrop(dev.organizationId, data.filter((r) => r.type === "LIVESTOCK" && typeof r.value === "number"), dev.organization.users.map((u) => u.id)).catch((e) => console.error("[livestock]", e));
    const critical = p.data.events.map((e, i) => ({ e, id: data[i].id })).filter((x) => x.e.severity !== "INFO").slice(0, 5);
    // alerts in each user's language; CRITICAL also by email + SMS, WARNING by email; Telegram with the photo
    for (const { e, id: eventId } of critical) {
      const camName = byCode.get(e.camera)?.name ?? e.camera;
      const at = new Date(e.occurredAt ?? Date.now()).toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });
      await notifyUsers(
        dev.organization.users.map((u) => u.id),
        "EVENT",
        (d) => ({ title: d.dash.eventTitles[e.type], body: fmt(d.dash.notify.aiAlertBody, { c: camName, t: at }) }),
        e.severity === "CRITICAL" ? "critical" : "important",
        "/dashboard/events",
      );
      const photo = e.snapshot ? Buffer.from(e.snapshot, "base64") : null;
      await telegramToOrg(
        dev.organizationId,
        (l) => `${e.severity === "CRITICAL" ? "🚨" : "⚠️"} ${dictionaries[l].dash.eventTitles[e.type]}${e.plate ? ` · ${e.plate}` : ""}\n📷 ${camName} · ${at}`,
        photo,
        eventId,
      ).catch(() => {});
    }
    await db.edgeDevice.update({ where: { id: dev.id }, data: { lastHeartbeat: new Date() } });
    return NextResponse.json({ ok: true, accepted: data.length });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 404 });
}
