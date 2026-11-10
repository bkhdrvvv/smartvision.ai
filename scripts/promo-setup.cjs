// Coupons + the timed promo banner. Usage: node scripts/promo-setup.cjs
//   ULASH10   — 10% for sharing the site on Telegram (no end date)
//   AKSIYA20  — 20% first month, until the end of the current month (banner with a countdown)
const { PrismaClient } = require("@prisma/client");

(async () => {
  const db = new PrismaClient();
  const now = new Date();
  const lastDay = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  const until = lastDay.toISOString().slice(0, 10);
  const expires = new Date(`${until}T23:59:59+05:00`);
  await db.coupon.upsert({ where: { code: "ULASH10" }, create: { code: "ULASH10", percentOff: 10 }, update: { percentOff: 10, active: true, expiresAt: null } });
  await db.coupon.upsert({ where: { code: "AKSIYA20" }, create: { code: "AKSIYA20", percentOff: 20, expiresAt: expires }, update: { percentOff: 20, active: true, expiresAt: expires } });
  const promo = { text: "🔥 Aksiya: birinchi oyga 20% chegirma — kod AKSIYA20", link: "/pricing", until };
  for (const [k, v] of Object.entries(promo)) await db.setting.upsert({ where: { key: `promo:${k}` }, create: { key: `promo:${k}`, value: v }, update: { value: v } });
  console.log("coupons ULASH10 (10%), AKSIYA20 (20% until", until + ") · promo banner on");
  await db.$disconnect();
})();
