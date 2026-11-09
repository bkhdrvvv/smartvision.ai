import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { cookies } from "next/headers";
import type { Ticket, TicketMessage } from "@prisma/client";
import { db } from "./db";
import { getSession } from "./auth";

/* Support chat (complaints & appeals): who may read a chat, private photo / voice files, message DTOs. */

export const CHAT_MAX_FILE = 5 * 1024 * 1024; // photos and voice notes
export const CHAT_MAX_VOICE_SEC = 180;
const DIR = join(process.cwd(), "uploads", "chat");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const guestCookie = (ticketId: string) => `sv_chat_${ticketId}`;

export function newGuestToken() {
  const raw = randomBytes(24).toString("base64url");
  return { raw, hash: sha(raw) };
}

export type Viewer = "admin" | "customer" | "guest";

/** The ticket and who is looking at it — or null when this browser may not see the chat. */
export async function chatAccess(ticketId: string): Promise<{ ticket: Ticket; viewer: Viewer; userId: string | null } | null> {
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;
  const s = await getSession();
  if (s?.role === "ADMIN") return { ticket, viewer: "admin", userId: s.uid };
  if (s && ticket.organizationId && s.org === ticket.organizationId) return { ticket, viewer: "customer", userId: s.uid };
  const raw = (await cookies()).get(guestCookie(ticketId))?.value;
  if (raw && ticket.guestTokenHash && sha(raw) === ticket.guestTokenHash) return { ticket, viewer: "guest", userId: null };
  return null;
}

/** Tickets this browser created as a visitor (their cookies). */
export async function guestTickets() {
  const jar = await cookies();
  const ids = jar.getAll().filter((c) => c.name.startsWith("sv_chat_")).map((c) => ({ id: c.name.slice(8), hash: sha(c.value) }));
  if (!ids.length) return [];
  const rows = await db.ticket.findMany({ where: { id: { in: ids.map((x) => x.id) } }, orderBy: { updatedAt: "desc" } });
  return rows.filter((t) => ids.some((x) => x.id === t.id && x.hash === t.guestTokenHash));
}

/** Only real photos / audio, recognised by their first bytes (the browser-sent type is not trusted). */
export function sniffChatFile(b: Buffer): { type: "IMAGE" | "VOICE"; mime: string; ext: string } | null {
  if (b.length < 12) return null;
  const hex = b.subarray(0, 4).toString("hex");
  if (hex.startsWith("ffd8ff")) return { type: "IMAGE", mime: "image/jpeg", ext: "jpg" };
  if (hex === "89504e47") return { type: "IMAGE", mime: "image/png", ext: "png" };
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return { type: "IMAGE", mime: "image/webp", ext: "webp" };
  if (b.subarray(0, 3).toString() === "GIF") return { type: "IMAGE", mime: "image/gif", ext: "gif" };
  if (hex === "1a45dfa3") return { type: "VOICE", mime: "audio/webm", ext: "webm" }; // Chrome / Edge / Firefox MediaRecorder
  if (b.subarray(0, 4).toString() === "OggS") return { type: "VOICE", mime: "audio/ogg", ext: "ogg" };
  if (b.subarray(4, 8).toString() === "ftyp") return { type: "VOICE", mime: "audio/mp4", ext: "m4a" }; // Safari / iPhone
  if (b.subarray(0, 3).toString() === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { type: "VOICE", mime: "audio/mpeg", ext: "mp3" };
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WAVE") return { type: "VOICE", mime: "audio/wav", ext: "wav" };
  return null;
}

export async function saveChatFile(buf: Buffer, ext: string) {
  await mkdir(DIR, { recursive: true });
  const key = `${Date.now()}-${randomBytes(12).toString("hex")}.${ext}`;
  await writeFile(join(DIR, key), buf);
  return key;
}
export const readChatFile = (key: string) => readFile(join(DIR, basename(key)));
export const deleteChatFile = (key: string) => unlink(join(DIR, basename(key))).catch(() => {});

export type ChatMsg = {
  id: string;
  mine: boolean;
  fromAdmin: boolean;
  type: "TEXT" | "IMAGE" | "VOICE";
  body: string;
  file: string | null;
  duration: number | null;
  at: string;
  seen: boolean;
  seenAt: string | null;
  author: string | null;
};

/* ───── presence: online now / online since / when they left ───── */
const ONLINE_MS = 15_000; // the chat polls every 3 s; no poll for 15 s = gone
export type Presence = { online: boolean; since: string | null; lastSeen: string | null };

/** Called on every poll of the viewer: marks this side online (a new "since" after a break). */
export async function touchPresence(ticketId: string, viewer: Viewer) {
  const t = await db.ticket.findUnique({ where: { id: ticketId }, select: { adminSeenAt: true, adminSince: true, clientSeenAt: true, clientSince: true } });
  if (!t) return;
  const now = new Date();
  const seen = viewer === "admin" ? t.adminSeenAt : t.clientSeenAt;
  const since = viewer === "admin" ? t.adminSince : t.clientSince;
  const fresh = !since || !seen || now.getTime() - seen.getTime() > ONLINE_MS;
  await db.ticket.update({
    where: { id: ticketId },
    data: viewer === "admin" ? { adminSeenAt: now, adminSince: fresh ? now : since } : { clientSeenAt: now, clientSince: fresh ? now : since },
  });
}

/** The viewer closed the chat (tab closed / left the page): offline right away, "left at" = now. */
export async function leavePresence(ticketId: string, viewer: Viewer) {
  const now = new Date();
  await db.ticket.update({ where: { id: ticketId }, data: viewer === "admin" ? { adminSeenAt: now, adminSince: null } : { clientSeenAt: now, clientSince: null } });
}

/** What the viewer sees about the OTHER side. */
export function peerPresence(t: Pick<Ticket, "adminSeenAt" | "adminSince" | "clientSeenAt" | "clientSince">, viewer: Viewer): Presence {
  const seen = viewer === "admin" ? t.clientSeenAt : t.adminSeenAt;
  const since = viewer === "admin" ? t.clientSince : t.adminSince;
  const online = !!since && !!seen && Date.now() - seen.getTime() < ONLINE_MS;
  return { online, since: online ? since!.toISOString() : null, lastSeen: seen?.toISOString() ?? null };
}

export function toChatMsg(m: TicketMessage & { author?: { name: string } | null }, viewer: Viewer): ChatMsg {
  const mine = viewer === "admin" ? m.fromAdmin : !m.fromAdmin;
  return {
    id: m.id,
    mine,
    fromAdmin: m.fromAdmin,
    type: m.type,
    body: m.body,
    file: m.fileKey ? `/api/tickets/${m.ticketId}/files/${m.id}` : null,
    duration: m.durationSec,
    at: m.createdAt.toISOString(),
    seen: !!m.readAt,
    seenAt: m.readAt?.toISOString() ?? null,
    author: m.author?.name ?? null,
  };
}

/** Opening the chat marks the other side's messages as seen. */
export async function markSeen(ticketId: string, viewer: Viewer) {
  const fromAdmin = viewer !== "admin"; // the viewer reads messages written by the other side
  await db.ticketMessage.updateMany({ where: { ticketId, fromAdmin, readAt: null }, data: { readAt: new Date() } });
  await db.ticket.update({ where: { id: ticketId }, data: viewer === "admin" ? { unreadAdmin: false } : { unreadCustomer: false } });
}
