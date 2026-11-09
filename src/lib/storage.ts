import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";

/**
 * Private receipt storage. "local" writes to ./uploads (never served statically —
 * only through the authenticated /api/receipts route). Cloudinary can be wired in
 * by implementing the same two functions with the authenticated-upload API.
 */
const DIR = join(process.cwd(), "uploads");
export const MAX_RECEIPT = 5 * 1024 * 1024;

export function sniffMime(buf: Buffer): "image/jpeg" | "image/png" | "application/pdf" | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

export async function saveReceipt(buf: Buffer, mime: string) {
  if ((process.env.STORAGE_DRIVER ?? "local") !== "local") throw new Error("Only STORAGE_DRIVER=local is implemented");
  await mkdir(DIR, { recursive: true });
  const ext = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" }[mime] ?? "bin";
  const key = `${Date.now()}-${randomBytes(12).toString("hex")}.${ext}`;
  await writeFile(join(DIR, key), buf);
  return key;
}

const SNAP_DIR = join(DIR, "snapshots");

/** Store an Edge snapshot (JPEG only). Returns the key or null if the data isn't a JPEG. */
export async function saveSnapshot(b64: string) {
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 100 || sniffMime(buf) !== "image/jpeg") return null;
  await mkdir(SNAP_DIR, { recursive: true });
  const key = `${Date.now()}-${randomBytes(8).toString("hex")}.jpg`;
  await writeFile(join(SNAP_DIR, key), buf);
  return key;
}

export async function readSnapshot(key: string) {
  return readFile(join(SNAP_DIR, basename(key)));
}

export async function deleteSnapshot(key: string) {
  const { unlink } = await import("node:fs/promises");
  await unlink(join(SNAP_DIR, basename(key))).catch(() => {});
}

export async function readReceipt(key: string) {
  return readFile(join(DIR, basename(key)));
}
