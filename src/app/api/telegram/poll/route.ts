import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { pollUpdates } from "@/lib/telegram";

export const dynamic = "force-dynamic";

let busy = false;

/** Telegram long-poll tick (every few seconds from src/instrumentation.ts, internal key only). */
export async function POST(req: Request) {
  const want = createHash("sha256").update(`${process.env.AUTH_SECRET}:cron`).digest();
  const got = Buffer.from(req.headers.get("x-cron-key") ?? "", "hex");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return new NextResponse("forbidden", { status: 403 });
  if (busy) return NextResponse.json({ skipped: true });
  busy = true;
  try {
    return NextResponse.json({ handled: await pollUpdates() });
  } finally {
    busy = false;
  }
}
