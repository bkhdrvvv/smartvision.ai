import { NextResponse } from "next/server";
import { chatAccess, leavePresence } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** sendBeacon from the chat when the tab is closed or the page is left → shown as "left at …" right away. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acc = await chatAccess(id);
  if (!acc) return new NextResponse(null, { status: 403 });
  await leavePresence(id, acc.viewer);
  return new NextResponse(null, { status: 204 });
}
