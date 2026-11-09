import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Night Vision state of one camera (mode set in the dashboard + whether the Edge agent is brightening right now). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const cam = await db.camera.findUnique({ where: { id }, select: { organizationId: true, nightMode: true, nightActive: true, status: true, lastSeenAt: true } });
  if (!cam || (s.role !== "ADMIN" && cam.organizationId !== s.org)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ mode: cam.nightMode, active: cam.nightMode !== "off" && cam.nightActive && cam.status !== "OFFLINE" && !!cam.lastSeenAt && Date.now() - cam.lastSeenAt.getTime() < 60_000 }, { headers: { "cache-control": "no-store" } });
}
