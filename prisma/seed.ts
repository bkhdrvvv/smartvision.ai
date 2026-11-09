/* SMARTVISION AI — seed script: plans, settings, admin, demo customers & sample data */
import { PrismaClient, type EventType, type Severity } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const db = new PrismaClient();
const DAY = 86400000;

const PLANS = [
  { service: "SCHOOL", tier: "START", maxCameras: 3, priceMonthly: 60000, features: ["realtime", "studentCounting", "smartNotifications", "dailyReports"] },
  { service: "SCHOOL", tier: "STANDARD", maxCameras: 5, priceMonthly: 100000, recommended: true, features: ["everythingStart", "entryExit", "classroomOccupancy", "dailyMonthly"] },
  { service: "SCHOOL", tier: "PRO", maxCameras: 10, priceMonthly: 200000, features: ["everythingStandard", "safetyAlerts", "advancedAnalytics", "pdfCsv", "nightVision"] },
  { service: "HOME", tier: "START", maxCameras: 2, priceMonthly: 50000, features: ["realtime", "entryExit", "smartNotifications", "dailyReports"] },
  { service: "HOME", tier: "STANDARD", maxCameras: 4, priceMonthly: 90000, recommended: true, features: ["everythingStart", "visitorAlerts", "suspicious", "cameraStatus"] },
  { service: "HOME", tier: "PRO", maxCameras: 8, priceMonthly: 160000, features: ["everythingStandard", "advancedAnalytics", "dailyMonthly", "pdfCsv", "nightVision"] },
  { service: "FARM", tier: "START", maxCameras: 3, priceMonthly: 100000, features: ["realtime", "livestockCounting", "smartNotifications", "dailyReports"] },
  { service: "FARM", tier: "STANDARD", maxCameras: 6, priceMonthly: 150000, recommended: true, features: ["everythingStart", "animalActivity", "equipment", "intruder"] },
  { service: "FARM", tier: "PRO", maxCameras: 12, priceMonthly: 250000, features: ["everythingStandard", "fireSmoke", "advancedAnalytics", "pdfCsv", "nightVision"] },
] as const;

/** Tiny PNG encoder so the sample receipt is a real image file */
function png(w: number, h: number, draw: (x: number, y: number) => [number, number, number]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = draw(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function sampleReceipt() {
  const bars = [[60, 80, 300, 14], [60, 120, 220, 10], [60, 150, 260, 10], [60, 260, 120, 8], [60, 290, 240, 26], [60, 360, 300, 10], [60, 390, 220, 10], [60, 420, 260, 10]];
  return png(420, 560, (x, y) => {
    for (const [bx, by, bw, bh] of bars) if (x >= bx! && x < bx! + bw! && y >= by! && y < by! + bh!) return [150, 160, 180];
    return [250, 251, 253];
  });
}

function pick<T>(arr: readonly T[], r: number) { return arr[Math.floor(r * arr.length) % arr.length]!; }
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

async function main() {
  console.log("Seeding…");
  // Settings
  const settings = { paymentCard: "8600 •••• •••• 4417", supportPhone: "+998 71 200 00 00", supportEmail: "hello@smartvision.ai", monthlyExpenses: "730000" };
  for (const [key, value] of Object.entries(settings)) await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });

  // Plans
  for (const p of PLANS) {
    await db.plan.upsert({
      where: { service_tier: { service: p.service, tier: p.tier } },
      update: { maxCameras: p.maxCameras, priceMonthly: p.priceMonthly, features: [...p.features], recommended: "recommended" in p },
      create: { service: p.service, tier: p.tier, maxCameras: p.maxCameras, priceMonthly: p.priceMonthly, features: [...p.features], recommended: "recommended" in p },
    });
  }
  const plans = await db.plan.findMany();
  const plan = (s: string, t: string) => plans.find((p) => p.service === s && p.tier === t)!;

  await db.coupon.upsert({ where: { code: "WELCOME10" }, update: {}, create: { code: "WELCOME10", percentOff: 10, maxRedemptions: 100 } });
  await db.coupon.upsert({ where: { code: "SCHOOL20" }, update: {}, create: { code: "SCHOOL20", percentOff: 20, maxRedemptions: 20 } });

  // Admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@smartvision.ai";
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? "";
  // never create an admin with a guessable password
  if (adminPass.length < 10 || /change-me/i.test(adminPass))
    throw new Error("Set SEED_ADMIN_PASSWORD in .env to a strong password (min 10 chars) before seeding.");
  await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, name: "Administrator", role: "ADMIN", passwordHash: await bcrypt.hash(adminPass, 12) },
  });

  if (await db.organization.findFirst({ where: { name: "Demo School" } })) {
    console.log("Demo data already present — skipping.");
    return;
  }

  const demoPass = await bcrypt.hash(process.env.SEED_DEMO_PASSWORD ?? "demo12345", 12);
  const uploads = join(process.cwd(), "uploads");
  mkdirSync(uploads, { recursive: true });
  const receipt = sampleReceipt();

  const customers = [
    { name: "Demo School", domain: "demo-school.uz", email: "demo@demo-school.uz", phone: "+998901231245", svc: "SCHOOL", tier: "STANDARD", pay: "RECEIPT_SUBMITTED", h: 3, sub: "ACTIVE" },
    { name: "Green Valley Farm", domain: "greenvalley.uz", email: "info@greenvalley.uz", phone: "+998931238810", svc: "FARM", tier: "PRO", pay: "UNDER_REVIEW", h: 5, sub: "UNDER_REVIEW" },
    { name: "A. Karimov · Home", domain: null, email: "a.karimov@mail.uz", phone: "+998971233102", svc: "HOME", tier: "START", pay: "RECEIPT_SUBMITTED", h: 6, sub: "RECEIPT_SUBMITTED" },
    { name: "Lyceum No. 7", domain: "lyceum7.uz", email: "admin@lyceum7.uz", phone: "+998991235477", svc: "SCHOOL", tier: "PRO", pay: "UNDER_REVIEW", h: 26, sub: "UNDER_REVIEW" },
    { name: "North Farm", domain: null, email: "north.farm@mail.uz", phone: "+998911230963", svc: "FARM", tier: "STANDARD", pay: "AWAITING_PAYMENT", h: 28, sub: "AWAITING_PAYMENT" },
    { name: "M. Yusupova · Home", domain: null, email: "m.yusupova@mail.uz", phone: "+998941237218", svc: "HOME", tier: "STANDARD", pay: "APPROVED", h: 50, sub: "ACTIVE" },
    { name: "Riverside School", domain: "riverside.uz", email: "office@riverside.uz", phone: "+998951234081", svc: "SCHOOL", tier: "START", pay: "REJECTED", h: 52, sub: "AWAITING_PAYMENT" },
  ] as const;

  const now = Date.now();
  let seq = 36;
  for (const c of customers) {
    const org = await db.organization.create({ data: { name: c.name, domain: c.domain, service: c.svc, phone: c.phone, address: "Tashkent", demo: true } });
    await db.user.create({ data: { email: c.email, name: c.name, phone: c.phone, passwordHash: demoPass, organizationId: org.id } });
    const p = plan(c.svc, c.tier);
    const active = c.sub === "ACTIVE";
    const periodStart = active ? new Date(now - 6 * DAY) : new Date(now);
    const sub = await db.subscription.create({
      data: {
        organizationId: org.id, planId: p.id, status: c.sub as never,
        requestedAt: new Date(now - (c.h + 30) * 3600000), approvedAt: new Date(now - (c.h + 20) * 3600000),
        currentPeriodStart: active ? periodStart : null, currentPeriodEnd: active ? new Date(periodStart.getTime() + 30 * DAY) : null,
      },
    });
    const hist = ["REQUESTED", "APPROVED", "AWAITING_PAYMENT", ...(c.pay !== "AWAITING_PAYMENT" ? ["RECEIPT_SUBMITTED"] : []), ...(c.pay === "UNDER_REVIEW" ? ["UNDER_REVIEW"] : []), ...(active ? ["ACTIVE"] : [])];
    for (const [i, s] of hist.entries()) await db.subscriptionEvent.create({ data: { subscriptionId: sub.id, status: s as never, createdAt: new Date(now - (c.h + 30 - i * 5) * 3600000) } });

    // Previous approved payment for active subs
    if (active) {
      await db.payment.create({
        data: { reference: `PAY-2026-${String(seq++).padStart(4, "0")}`, organizationId: org.id, subscriptionId: sub.id, amount: p.priceMonthly, status: "APPROVED", periodStart, periodEnd: new Date(periodStart.getTime() + 30 * DAY), paidToCard: "Card •••• 4417", submittedAt: new Date(now - 6 * DAY), reviewedAt: new Date(now - 5.9 * DAY) },
      });
    }
    // Current payment shown in admin verification queue
    if (c.pay !== "APPROVED" || !active) {
      const hasReceipt = ["RECEIPT_SUBMITTED", "UNDER_REVIEW", "REJECTED"].includes(c.pay);
      const key = hasReceipt ? `seed-${org.id}.png` : null;
      if (key) writeFileSync(join(uploads, key), receipt);
      const ps = active ? new Date(periodStart.getTime() + 30 * DAY) : new Date(now);
      await db.payment.create({
        data: {
          reference: `PAY-2026-1106-${String(seq++).padStart(4, "0")}`, organizationId: org.id, subscriptionId: sub.id, amount: p.priceMonthly,
          status: c.pay as never, periodStart: ps, periodEnd: new Date(ps.getTime() + 30 * DAY), paidToCard: "Card •••• 4417",
          receiptKey: key, receiptName: key ? "receipt_nov.png" : null, receiptMime: key ? "image/png" : null, receiptSize: key ? receipt.length : null,
          submittedAt: hasReceipt ? new Date(now - c.h * 3600000) : null, adminNote: c.pay === "REJECTED" ? "Amount does not match the plan price." : null,
          createdAt: new Date(now - (c.h + 2) * 3600000),
        },
      });
    }
  }

  // ── Demo School: devices, cameras, events, notifications ──
  const school = (await db.organization.findFirst({ where: { name: "Demo School" } }))!;
  const user = (await db.user.findFirst({ where: { organizationId: school.id } }))!;
  const token = randomBytes(24).toString("base64url");
  const device = await db.edgeDevice.create({
    data: { serial: "EDGE-SCH-0012", organizationId: school.id, firmware: "v1.4.2", tokenHash: createHash("sha256").update(token).digest("hex"), lastHeartbeat: new Date(now - 8000), cpu: 41, gpu: 58 },
  });
  const camDefs = [
    { code: "Cam 01", name: "Main gate", scene: "gate", status: "ONLINE", signal: 92 },
    { code: "Cam 04", name: "Classroom 3A", scene: "classroom", status: "ONLINE", signal: 88, capacity: 30 },
    { code: "Cam 03", name: "Classroom 3B", scene: "classroom", status: "ONLINE", signal: 85, capacity: 30 },
    { code: "Cam 02", name: "Sports hall", scene: "parking", status: "WEAK", signal: 22 },
    { code: "Cam 05", name: "Corridor B", scene: "house", status: "OFFLINE", signal: 0 },
  ] as const;
  const cams = [];
  for (const c of camDefs) {
    cams.push(
      await db.camera.create({
        data: { organizationId: school.id, deviceId: device.id, code: c.code, name: c.name, scene: c.scene, status: c.status, signal: c.signal, fps: c.status === "WEAK" ? 4 : 25, capacity: "capacity" in c ? c.capacity : null, sourceUrl: `rtsp://10.0.0.${cams.length + 11}:554/stream1`, lastSeenAt: c.status === "OFFLINE" ? new Date(now - 42 * 60000) : new Date(now) },
      }),
    );
  }

  const types: { t: EventType; w: number; sev: Severity }[] = [
    { t: "ENTRY", w: 0.24, sev: "INFO" }, { t: "EXIT", w: 0.17, sev: "INFO" }, { t: "OCCUPANCY", w: 0.27, sev: "WARNING" },
    { t: "PERSON", w: 0.18, sev: "INFO" }, { t: "SAFETY", w: 0.09, sev: "WARNING" }, { t: "CAMERA_STATUS", w: 0.05, sev: "CRITICAL" },
  ];
  const pickType = () => { let r = rnd(); for (const x of types) { if ((r -= x.w) <= 0) return x; } return types[0]!; };
  const events = [];
  for (let day = 13; day >= 1; day--) {
    const n = Math.round(18 + rnd() * 20 + (day % 7 === 3 ? 8 : 0));
    for (let i = 0; i < n; i++) {
      const x = pickType();
      const at = new Date(now - day * DAY);
      at.setHours(7 + Math.floor(rnd() * 11), Math.floor(rnd() * 60));
      const cam = x.t === "CAMERA_STATUS" ? cams[4]! : pick(cams.slice(0, 4), rnd());
      events.push({ organizationId: school.id, cameraId: cam.id, type: x.t, severity: x.sev, confidence: x.t === "CAMERA_STATUS" ? null : 0.82 + rnd() * 0.17, occurredAt: at, resolved: true, value: x.t === "OCCUPANCY" ? 20 + Math.floor(rnd() * 10) : null });
    }
  }
  // today: 37 events, the latest ones matching the dashboard
  const today = new Date(); today.setHours(7, 0, 0, 0);
  for (let i = 0; i < 31; i++) {
    const x = pickType();
    if (x.t === "CAMERA_STATUS") continue;
    events.push({ organizationId: school.id, cameraId: pick(cams.slice(0, 4), rnd()).id, type: x.t, severity: x.sev, confidence: 0.84 + rnd() * 0.15, occurredAt: new Date(today.getTime() + rnd() * 40 * 60000), resolved: true, value: null });
  }
  const mk = (hm: string) => { const d = new Date(); const [h, m] = hm.split(":").map(Number); d.setHours(h!, m!, 0, 0); return d.getTime() > now ? new Date(now - 60000) : d; };
  events.push(
    { organizationId: school.id, cameraId: cams[0]!.id, type: "EXIT", severity: "INFO", confidence: 0.94, occurredAt: mk("07:46"), resolved: true, value: null, trackId: "#0231" },
    { organizationId: school.id, cameraId: cams[4]!.id, type: "CAMERA_STATUS", severity: "CRITICAL", confidence: null, occurredAt: mk("07:58"), resolved: false, value: null },
    { organizationId: school.id, cameraId: cams[1]!.id, type: "OCCUPANCY", severity: "WARNING", confidence: 0.89, occurredAt: mk("08:31"), resolved: false, value: 28 },
    { organizationId: school.id, cameraId: cams[0]!.id, type: "ENTRY", severity: "INFO", confidence: 0.96, occurredAt: mk("08:42"), resolved: false, value: null, trackId: "#0247" },
    { organizationId: school.id, cameraId: cams[0]!.id, type: "UNKNOWN_PERSON", severity: "WARNING", confidence: 0.88, occurredAt: mk("09:13"), resolved: false, value: null },
    { organizationId: school.id, cameraId: cams[0]!.id, type: "PERSON", severity: "INFO", confidence: 0.97, occurredAt: mk("09:14"), resolved: false, value: null, trackId: "#0248" },
  );
  await db.event.createMany({ data: events as never });

  await db.notification.createMany({
    data: [
      { userId: user.id, kind: "PAYMENT", title: "Payment approved", body: "October invoice", read: false, createdAt: new Date(now - DAY) },
      { userId: user.id, kind: "EVENT", title: "Occupancy 92% in 3A", body: "Threshold 85%", read: false, createdAt: new Date(now - 51 * 60000) },
      { userId: user.id, kind: "CAMERA", title: "Camera offline", body: "Corridor B lost connection", read: false, createdAt: new Date(now - 42 * 60000) },
    ],
  });

  // Edge devices for other active org
  const yus = (await db.organization.findFirst({ where: { name: "M. Yusupova · Home" } }))!;
  await db.edgeDevice.create({ data: { serial: "EDGE-HOM-0031", organizationId: yus.id, tokenHash: createHash("sha256").update(randomBytes(24)).digest("hex"), lastHeartbeat: new Date(now - 20000), cpu: 22, gpu: 31 } });
  await db.camera.createMany({
    data: [
      { organizationId: yus.id, code: "Cam 01", name: "Front door", scene: "house", status: "ONLINE", signal: 90 },
      { organizationId: yus.id, code: "Cam 02", name: "Yard", scene: "parking", status: "ONLINE", signal: 76 },
    ],
  });

  await db.contactMessage.create({ data: { name: "Bobur", phone: "+998 90 555 11 22", service: "FARM", message: "Need a quote for 8 cameras on a dairy farm." } });

  console.log("\nDemo Edge device token for EDGE-SCH-0012 (store it on the device):\n  " + token + "\n");
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
