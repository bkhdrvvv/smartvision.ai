// Dev helper: register (or re-key) an Edge device for an organization and write its token.
// Usage: node scripts/edge-register.cjs "<Organization name>" <SERIAL> [outfile]
const { PrismaClient } = require("@prisma/client");
const { randomBytes, createHash } = require("crypto");
const fs = require("fs");

const db = new PrismaClient();
(async () => {
  const [orgName, serial, out] = process.argv.slice(2);
  if (!orgName || !serial) throw new Error('usage: edge-register.cjs "<Organization>" <SERIAL> [outfile]');
  const org = await db.organization.findFirst({ where: { name: orgName } });
  if (!org) throw new Error(`organization not found: ${orgName}`);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const dev = await db.edgeDevice.upsert({
    where: { serial },
    update: { tokenHash, organizationId: org.id },
    create: { serial, organizationId: org.id, tokenHash, firmware: "edge-1.0" },
  });
  await db.camera.updateMany({ where: { organizationId: org.id, deviceId: null }, data: { deviceId: dev.id } });
  if (out) fs.writeFileSync(out, token);
  else console.log(token);
  console.log(`device ${serial} → ${org.name}`);
})()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
