import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** New notifications since `after` (ms timestamp), for the browser pop-up notifications. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const after = Number(new URL(req.url).searchParams.get("after")) || Date.now() - 60_000;
  const rows = await db.notification.findMany({
    where: { userId: s.uid, read: false, createdAt: { gt: new Date(after) } },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true, title: true, body: true, kind: true, createdAt: true },
  });
  return NextResponse.json(
    { now: Date.now(), items: rows.map((r) => ({ id: r.id, title: r.title, body: r.body, kind: r.kind, at: r.createdAt.getTime() })) },
    { headers: { "cache-control": "no-store" } },
  );
}
