import "server-only";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "./db";

/** Every table, in an order that can be restored (parents before children). */
export const BACKUP_TABLES = [
  "setting", "plan", "coupon", "organization", "user", "authToken", "emailCode", "outbox", "contactMessage",
  "subscription", "subscriptionEvent", "payment", "edgeDevice", "camera", "event", "notification", "auditLog", "ticket", "ticketMessage", "student", "attendance", "plateListItem", "review",
] as const;

const DIR = join(process.cwd(), "backups");
const KEEP = 14;

/**
 * Full JSON copy of the database into ./backups/backup-YYYY-MM-DD.json (one per day, last 14 kept).
 * Receipt and snapshot files stay in ./uploads — copy that folder together with the backups.
 * Restore into an empty database: node scripts/restore.cjs backups/backup-....json
 */
export async function dailyBackup() {
  await mkdir(DIR, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const file = join(DIR, `backup-${day}.json`);
  const existing = await readdir(DIR);
  if (existing.includes(`backup-${day}.json`)) return null;

  const data: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) data[t] = await (db[t] as unknown as { findMany: () => Promise<unknown[]> }).findMany();
  await writeFile(file, JSON.stringify({ createdAt: new Date().toISOString(), tables: data }));

  const old = existing.filter((f) => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().slice(KEEP - 1);
  for (const f of old) await unlink(join(DIR, f)).catch(() => {});
  return file;
}
