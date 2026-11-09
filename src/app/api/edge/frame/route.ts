import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { hasService } from "@/lib/subscription";
import { RELAY_MAX_FRAME, isJpeg, putFrame } from "@/lib/relay";

export const dynamic = "force-dynamic";

/*
 * Frames arrive several times per second per camera; resolving token → device → subscription → camera
 * on every frame would saturate the database. Cache the authorization for 30 s per token.
 */
type Auth = { orgId: string; ok: boolean; cams: Map<string, string>; exp: number };
const g = globalThis as unknown as { __svFrameAuth?: Map<string, Auth> };
const cache = (g.__svFrameAuth ??= new Map());

async function authorize(req: Request): Promise<Auth | null> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (token.length < 20) return null;
  const key = createHash("sha256").update(token).digest("hex");
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit;
  const dev = await db.edgeDevice.findFirst({ where: { tokenHash: key }, select: { organizationId: true, organization: { select: { blockedAt: true } } } });
  if (!dev || dev.organization.blockedAt) {
    cache.delete(key);
    return null;
  }
  const cams = await db.camera.findMany({ where: { organizationId: dev.organizationId }, select: { id: true, code: true } });
  const a: Auth = { orgId: dev.organizationId, ok: await hasService(dev.organizationId), cams: new Map(cams.map((c) => [c.code, c.id])), exp: Date.now() + 30_000 };
  cache.set(key, a);
  if (cache.size > 5000) cache.clear();
  return a;
}

/**
 * POST /api/edge/frame?camera=<code>   body: image/jpeg (annotated frame)
 * Response: { viewers } — the agent sends ~0.3 fps with no viewers and full relay fps when someone watches.
 */
export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > RELAY_MAX_FRAME) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const a = await authorize(req);
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!a.ok) return NextResponse.json({ error: "subscription_inactive" }, { status: 402 });
  const camId = a.cams.get(new URL(req.url).searchParams.get("camera") ?? "");
  if (!camId) return NextResponse.json({ error: "unknown_camera" }, { status: 404 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > RELAY_MAX_FRAME || !isJpeg(buf)) return NextResponse.json({ error: "bad_frame" }, { status: 415 });
  return NextResponse.json({ viewers: putFrame(camId, buf) });
}
