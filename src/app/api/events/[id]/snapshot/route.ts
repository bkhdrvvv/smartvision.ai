import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { readSnapshot } from "@/lib/storage";

/** Face / head crop of an event — only for the organization that owns it (or an admin). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return new NextResponse("unauthorized", { status: 401 });
  const { id } = await params;
  const e = await db.event.findUnique({ where: { id }, select: { organizationId: true, snapshotKey: true } });
  if (!e?.snapshotKey) return new NextResponse("not found", { status: 404 });
  if (s.role !== "ADMIN" && e.organizationId !== s.org) return new NextResponse("forbidden", { status: 403 });
  const buf = await readSnapshot(e.snapshotKey).catch(() => null);
  if (!buf) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}
