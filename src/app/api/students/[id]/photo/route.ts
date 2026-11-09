import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { readFace } from "@/lib/faces";

export const dynamic = "force-dynamic";

/** A student's face photo — only for users of the same organization (and admins). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const st = await db.student.findUnique({ where: { id }, select: { organizationId: true, photoKey: true } });
  if (!st?.photoKey || (s.role !== "ADMIN" && st.organizationId !== s.org)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const buf = await readFace(st.photoKey).catch(() => null);
  if (!buf) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": st.photoKey.endsWith(".png") ? "image/png" : "image/jpeg", "cache-control": "private, max-age=300" } });
}
