import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasService } from "@/lib/subscription";
import { addViewer, getFrame } from "@/lib/relay";

export const dynamic = "force-dynamic";

/**
 * GET /api/cameras/:id/stream — live MJPEG relayed through the platform, so owners can watch from anywhere
 * (outside the site's Wi-Fi). Only the owning organization (or an admin), only with an active subscription.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const cam = await db.camera.findUnique({ where: { id }, select: { organizationId: true } });
  if (!cam) return new Response("not found", { status: 404 });
  if (s.role !== "ADMIN" && cam.organizationId !== s.org) return new Response("forbidden", { status: 403 });
  if (s.role !== "ADMIN" && !(await hasService(cam.organizationId))) return new Response("subscription inactive", { status: 402 });

  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastSeq = -1;
  const started = Date.now();
  addViewer(id, 1);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = () => {
        const f = getFrame(id);
        if (f && f.seq !== lastSeq && f.jpeg.length) {
          lastSeq = f.seq;
          controller.enqueue(enc.encode(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${f.jpeg.length}\r\n\r\n`));
          controller.enqueue(new Uint8Array(f.jpeg));
          controller.enqueue(enc.encode("\r\n"));
        }
        // no frame for 20 s after opening → end the response so the player reconnects / shows "connection lost"
        if ((!f || !f.jpeg.length || Date.now() - f.at > 20_000) && Date.now() - started > 20_000) {
          cleanup();
          try {
            controller.close();
          } catch {}
        }
      };
      timer = setInterval(send, 150);
      send();
    },
    cancel() {
      cleanup();
    },
  });

  let done = false;
  function cleanup() {
    if (done) return;
    done = true;
    clearInterval(timer);
    addViewer(id, -1);
  }
  req.signal.addEventListener("abort", cleanup);

  return new Response(stream, {
    headers: {
      "Content-Type": "multipart/x-mixed-replace; boundary=frame",
      "Cache-Control": "no-cache, no-store, private",
      "X-Accel-Buffering": "no", // disable proxy buffering (nginx)
      Connection: "keep-alive",
    },
  });
}
