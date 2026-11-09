import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // CSV-injection guard
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(req: Request) {
  const s = await getSession();
  if (!s?.org) return new Response("unauthorized", { status: 401 });
  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 14));
  const from = new Date(Date.now() - days * 86400000);
  const rows = await db.event.findMany({ where: { organizationId: s.org, occurredAt: { gte: from } }, orderBy: { occurredAt: "desc" }, include: { camera: true }, take: 50000 });
  const lines = [
    ["occurred_at", "camera_code", "camera_name", "type", "severity", "confidence", "track_id", "value", "resolved"].join(","),
    ...rows.map((e) => [e.occurredAt.toISOString(), e.camera?.code, e.camera?.name, e.type, e.severity, e.confidence?.toFixed(3), e.trackId, e.value, e.resolved].map(esc).join(",")),
  ];
  return new Response("﻿" + lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="smartvision-events-${days}d.csv"`, "Cache-Control": "no-store" },
  });
}
