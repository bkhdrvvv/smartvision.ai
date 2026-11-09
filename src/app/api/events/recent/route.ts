import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const s = await getSession();
  const sp = new URL(req.url).searchParams;
  // admins may watch any customer (?org=…); customers only their own organization
  const org = s?.role === "ADMIN" ? sp.get("org") : s?.org;
  if (!s || !org) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const after = sp.get("after");
  const since = after && !Number.isNaN(Date.parse(after)) ? new Date(after) : new Date(Date.now() - 3600000);
  const rows = await db.event.findMany({
    where: { organizationId: org, occurredAt: { gt: since } },
    orderBy: { occurredAt: "desc" },
    take: 20,
    include: { camera: { select: { name: true } } },
  });
  return NextResponse.json({
    events: rows.map((e) => ({ id: e.id, type: e.type, at: e.occurredAt.toISOString(), camera: e.camera?.name ?? "—", trackId: e.trackId, confidence: e.confidence, value: e.value, severity: e.severity, snap: !!e.snapshotKey })),
  });
}
