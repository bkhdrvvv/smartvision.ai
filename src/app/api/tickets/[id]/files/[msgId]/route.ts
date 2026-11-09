import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatAccess, readChatFile } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** A chat photo / voice note — only for the two sides of that chat (admin, the customer, or the visitor's browser). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; msgId: string }> }) {
  const { id, msgId } = await params;
  const acc = await chatAccess(id);
  if (!acc) return new NextResponse("forbidden", { status: 403 });
  const m = await db.ticketMessage.findFirst({ where: { id: msgId, ticketId: id }, select: { fileKey: true, fileMime: true } });
  if (!m?.fileKey) return new NextResponse("not found", { status: 404 });
  const buf = await readChatFile(m.fileKey).catch(() => null);
  if (!buf) return new NextResponse("not found", { status: 404 });
  const headers: Record<string, string> = {
    "content-type": m.fileMime ?? "application/octet-stream",
    "cache-control": "private, max-age=86400",
    "x-content-type-options": "nosniff",
    "content-disposition": "inline",
    "accept-ranges": "bytes",
  };
  // audio players (Safari especially) ask for byte ranges
  const range = req.headers.get("range");
  const mt = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
  if (mt) {
    const start = mt[1] ? Number(mt[1]) : 0;
    const end = mt[2] ? Math.min(Number(mt[2]), buf.length - 1) : buf.length - 1;
    return new NextResponse(new Uint8Array(buf.subarray(start, end + 1)), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${buf.length}`, "content-length": String(end - start + 1) } });
  }
  return new NextResponse(new Uint8Array(buf), { headers: { ...headers, "content-length": String(buf.length) } });
}
