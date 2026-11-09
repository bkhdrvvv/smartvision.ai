// Full JSON copy of the database right now (same format as the automatic daily backup).
// Usage: node scripts/backup-now.cjs [out.json]   → restore with: node scripts/restore.cjs <file>
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const TABLES = ["setting", "plan", "coupon", "organization", "user", "authToken", "emailCode", "outbox", "contactMessage", "subscription", "subscriptionEvent", "payment", "edgeDevice", "camera", "event", "notification", "auditLog", "ticket", "ticketMessage", "student", "attendance", "plateListItem", "review"];

(async () => {
  const db = new PrismaClient();
  const out = process.argv[2] || path.join("backups", `manual-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tables = {};
  for (const t of TABLES) tables[t] = await db[t].findMany();
  fs.writeFileSync(out, JSON.stringify({ createdAt: new Date().toISOString(), tables }));
  console.log(out, Object.entries(tables).map(([k, v]) => `${k}=${v.length}`).join(" "));
  await db.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
