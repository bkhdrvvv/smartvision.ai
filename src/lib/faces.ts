import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { sniffMime } from "./storage";

/** Private student face photos (./uploads/faces) — served only to the owner and to the organization's Edge agent. */
const DIR = join(process.cwd(), "uploads", "faces");
export const MAX_FACE = 5 * 1024 * 1024;

export async function saveFace(buf: Buffer): Promise<string | null> {
  const mime = sniffMime(buf);
  if (buf.length > MAX_FACE || (mime !== "image/jpeg" && mime !== "image/png")) return null;
  await mkdir(DIR, { recursive: true });
  const key = `${Date.now()}-${randomBytes(8).toString("hex")}.${mime === "image/png" ? "png" : "jpg"}`;
  await writeFile(join(DIR, key), buf);
  return key;
}

export const readFace = (key: string) => readFile(join(DIR, basename(key)));
export const deleteFace = (key: string) => unlink(join(DIR, basename(key))).catch(() => {});
