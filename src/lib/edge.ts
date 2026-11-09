import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";

/** Resolve the Edge device from "Authorization: Bearer <token>" (only the SHA-256 is stored). */
export async function edgeDevice(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (token.length < 20) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const dev = await db.edgeDevice.findFirst({ where: { tokenHash }, include: { organization: { include: { users: { select: { id: true } } } } } });
  // a blocked customer's devices are rejected like an unknown token
  return dev && !dev.organization.blockedAt ? dev : null;
}
