// Restore a JSON backup (made automatically every day into ./backups) into an EMPTY database.
// Usage: node scripts/restore.cjs backups/backup-2026-11-07.json
// Steps for a full recovery: npm run db  →  npx prisma db push  →  node scripts/restore.cjs <file>  (+ copy the uploads folder back)
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");

const ORDER = ["setting", "plan", "coupon", "organization", "user", "authToken", "emailCode", "outbox", "contactMessage", "subscription", "subscriptionEvent", "payment", "edgeDevice", "camera", "event", "notification", "auditLog", "ticket", "ticketMessage", "student", "attendance", "plateListItem", "review"];
// JSON turns dates into strings; these fields are DateTime in the schema
const isDateKey = (k) => /(At|Start|End|expiresAt|lastHeartbeat|lastSeenAt|occurredAt|requestedAt|approvedAt|sentAt|usedAt|readAt|blockedAt|emailVerifiedAt)$/.test(k);

(async () => {
  const file = process.argv[2];
  if (!file) throw new Error("usage: node scripts/restore.cjs <backup.json>");
  const { tables, createdAt } = JSON.parse(fs.readFileSync(file, "utf8"));
  const db = new PrismaClient();
  if ((await db.user.count()) > 0) throw new Error("the database is not empty — restore only into a fresh database");
  for (const t of ORDER) {
    const rows = (tables[t] || []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" && isDateKey(k) ? new Date(v) : v])));
    if (rows.length) await db[t].createMany({ data: rows });
    console.log(`${t}: ${rows.length}`);
  }
  // autoincrement counters continue after the restored rows (appeal numbers #1, #2 …)
  await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Ticket"', 'number'), GREATEST((SELECT COALESCE(MAX(number), 0) FROM "Ticket"), 1), (SELECT COUNT(*) > 0 FROM "Ticket"))`).catch(() => {});
  console.log(`restored backup from ${createdAt}`);
  await db.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
