import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit, getSession } from "@/lib/auth";
import { MAX_RECEIPT, readReceipt, saveReceipt, sniffMime } from "@/lib/storage";
import { hit } from "@/lib/ratelimit";
import { notifyUsers, tf } from "@/lib/notify";

/** GET — stream a receipt to its owner or an admin */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const p = await db.payment.findUnique({ where: { id } });
  if (!p || !p.receiptKey) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (s.role !== "ADMIN" && p.organizationId !== s.org) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const buf = await readReceipt(p.receiptKey).catch(() => null);
  if (!buf) return NextResponse.json({ error: "missing_file" }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": p.receiptMime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${(p.receiptName ?? "receipt").replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** POST — customer uploads a receipt for an AWAITING_PAYMENT (or REJECTED) payment */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || s.role !== "CUSTOMER" || !s.org) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const p = await db.payment.findUnique({ where: { id } });
  if (!p || p.organizationId !== s.org) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!["AWAITING_PAYMENT", "REJECTED"].includes(p.status)) return NextResponse.json({ error: "invalid_state" }, { status: 409 });
  // reject oversized bodies before buffering them into memory
  if (Number(req.headers.get("content-length") ?? 0) > MAX_RECEIPT + 64 * 1024) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (!hit(`receipt:${s.uid}`, 10, 60 * 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (file.size > MAX_RECEIPT) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime) return NextResponse.json({ error: "bad_type" }, { status: 415 });

  const key = await saveReceipt(buf, mime);
  await db.$transaction([
    db.payment.update({ where: { id }, data: { status: "RECEIPT_SUBMITTED", receiptKey: key, receiptMime: mime, receiptSize: buf.length, receiptName: file.name.slice(0, 120), submittedAt: new Date(), adminNote: null } }),
    db.subscription.update({ where: { id: p.subscriptionId }, data: { status: (await db.subscription.findUnique({ where: { id: p.subscriptionId } }))?.status === "ACTIVE" ? "ACTIVE" : "RECEIPT_SUBMITTED", history: { create: { status: "RECEIPT_SUBMITTED" } } } }),
  ]);
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await notifyUsers(admins.map((a) => a.id), "PAYMENT", tf("receiptSubmitted", "receiptSubmittedBody", { r: p.reference }), "important", "/admin/payments");
  await audit(s.uid, "payment.receipt_upload", p.id);
  revalidatePath("/dashboard", "layout");
  return NextResponse.json({ ok: true });
}
