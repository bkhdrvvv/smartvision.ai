import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/auth";
import { CHAT_MAX_FILE, CHAT_MAX_VOICE_SEC, chatAccess, markSeen, peerPresence, saveChatFile, sniffChatFile, toChatMsg, touchPresence } from "@/lib/chat";
import { notifyUsers } from "@/lib/notify";
import { fmt } from "@/lib/i18n";
import { clientIp, hit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Messages of one chat (polled every few seconds). Reading also marks the other side's messages as seen. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acc = await chatAccess(id);
  if (!acc) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await Promise.all([markSeen(id, acc.viewer), touchPresence(id, acc.viewer)]);
  const [msgs, t] = await Promise.all([
    db.ticketMessage.findMany({ where: { ticketId: id }, orderBy: { createdAt: "asc" }, take: 500, include: { author: { select: { name: true } } } }),
    db.ticket.findUnique({ where: { id } }),
  ]);
  return NextResponse.json(
    { status: t?.status, presence: t ? peerPresence(t, acc.viewer) : null, messages: msgs.map((m) => toChatMsg(m, acc.viewer)) },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Send: text and/or one file (photo or voice note) as multipart form data. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (Number(req.headers.get("content-length") ?? 0) > CHAT_MAX_FILE + 64 * 1024) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const acc = await chatAccess(id);
  if (!acc) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const who = acc.userId ?? `guest:${await clientIp()}`;
  if (!hit(`chat:${who}`, 60, 10 * 60_000)) return NextResponse.json({ error: "too_many" }, { status: 429 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const text = String(form.get("text") ?? "").trim().slice(0, 4000);
  const file = form.get("file");
  let fileData: { key: string; mime: string; size: number; type: "IMAGE" | "VOICE" } | null = null;
  if (file && typeof file !== "string" && file.size > 0) {
    if (file.size > CHAT_MAX_FILE) return NextResponse.json({ error: "too_large" }, { status: 413 });
    const buf = Buffer.from(await file.arrayBuffer());
    const kind = sniffChatFile(buf);
    if (!kind) return NextResponse.json({ error: "bad_file" }, { status: 415 });
    fileData = { key: await saveChatFile(buf, kind.ext), mime: kind.mime, size: buf.length, type: kind.type };
  }
  if (!text && !fileData) return NextResponse.json({ error: "empty" }, { status: 400 });
  const duration = fileData?.type === "VOICE" ? Math.max(1, Math.min(CHAT_MAX_VOICE_SEC, Math.round(Number(form.get("duration")) || 1))) : null;

  const fromAdmin = acc.viewer === "admin";
  const msg = await db.ticketMessage.create({
    data: {
      ticketId: id,
      fromAdmin,
      authorId: acc.userId,
      type: fileData?.type ?? "TEXT",
      body: text,
      fileKey: fileData?.key,
      fileMime: fileData?.mime,
      fileSize: fileData?.size,
      durationSec: duration,
    },
    include: { author: { select: { name: true } } },
  });
  // admin answered → ANSWERED (customer's turn); customer / visitor wrote → OPEN again (admin's turn)
  await db.ticket.update({
    where: { id },
    data: fromAdmin ? { status: "ANSWERED", unreadCustomer: true } : { status: "OPEN", unreadAdmin: true },
  });

  // in-app notifications only (no emails) — the chat is where the conversation lives
  const t = acc.ticket;
  const preview = text ? text.slice(0, 120) : fileData?.type === "IMAGE" ? "📷" : "🎤";
  if (fromAdmin) {
    if (t.userId) await notifyUsers([t.userId], "SYSTEM", (d) => ({ title: fmt(d.support.notifyReplyTitle, { n: t.number }), body: preview }), "info", `/dashboard/support/${t.id}`);
  } else {
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    await notifyUsers(admins.map((a) => a.id), "SYSTEM", (d) => ({ title: fmt(d.support.notifyCustomerTitle, { n: t.number }), body: `${t.name}: ${preview}` }), "info", `/admin/tickets/${t.id}`);
  }
  if (fromAdmin) await audit(acc.userId, "ticket.reply", id, { number: t.number, type: msg.type });
  return NextResponse.json({ message: toChatMsg(msg, acc.viewer) });
}
