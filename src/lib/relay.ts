import "server-only";

/**
 * In-memory live-frame relay (Edge agent → platform → remote browsers).
 * The agent POSTs the latest annotated JPEG; viewers anywhere get it as MJPEG from /api/cameras/:id/stream.
 * Frames are never written to disk. Single-process store — for several app instances use Redis pub/sub.
 */
type Slot = { jpeg: Buffer; at: number; seq: number; viewers: number; lastView: number };

const g = globalThis as unknown as { __svRelay?: Map<string, Slot> };
const store = (g.__svRelay ??= new Map());

export const RELAY_MAX_FRAME = 1_500_000; // bytes

export function putFrame(cameraId: string, jpeg: Buffer) {
  const s = store.get(cameraId);
  if (s) {
    s.jpeg = jpeg;
    s.at = Date.now();
    s.seq++;
  } else store.set(cameraId, { jpeg, at: Date.now(), seq: 1, viewers: 0, lastView: 0 });
  return viewers(cameraId);
}

export function getFrame(cameraId: string) {
  return store.get(cameraId) ?? null;
}

/** viewers watching now, or within the last 10 s (so the agent doesn't drop fps between reconnects) */
export function viewers(cameraId: string) {
  const s = store.get(cameraId);
  if (!s) return 0;
  return s.viewers > 0 || Date.now() - s.lastView < 10_000 ? Math.max(1, s.viewers) : 0;
}

export function addViewer(cameraId: string, delta: 1 | -1) {
  let s = store.get(cameraId);
  if (!s) {
    s = { jpeg: Buffer.alloc(0), at: 0, seq: 0, viewers: 0, lastView: 0 };
    store.set(cameraId, s);
  }
  s.viewers = Math.max(0, s.viewers + delta);
  s.lastView = Date.now();
}

export function isJpeg(b: Buffer) {
  return b.length > 100 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}
