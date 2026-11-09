// Dev helper: issue a fresh API token for an Edge device and print it.
// Usage: node scripts/edge-token.cjs EDGE-SCH-0012 [outfile]
const { PrismaClient } = require("@prisma/client");
const { randomBytes, createHash } = require("crypto");
const fs = require("fs");

const db = new PrismaClient();
(async () => {
  const serial = process.argv[2];
  if (!serial) throw new Error("serial required");
  const token = randomBytes(32).toString("base64url");
  await db.edgeDevice.update({ where: { serial }, data: { tokenHash: createHash("sha256").update(token).digest("hex") } });
  if (process.argv[3]) fs.writeFileSync(process.argv[3], token);
  else console.log(token);
})()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
