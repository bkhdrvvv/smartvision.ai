// Feature lists of the 9 plans (simple things in Start, stronger security in Standard, the strongest in Pro).
// Prices and camera limits are NOT changed. Usage: node scripts/plan-features.cjs
const { PrismaClient } = require("@prisma/client");

const F = {
  SCHOOL: {
    START: ["realtime", "studentCounting", "telegramAlerts", "guardMode", "dailyReports", "safetyLight", "aiAssistant"],
    STANDARD: ["everythingStart", "faceAttendance", "parentAlerts", "lateAbsent", "entryExit", "zone", "fall", "tamper", "busyHours"],
    PRO: ["everythingStandard", "teacherAttendance", "corridorWatch", "visitorLog", "plates", "fireSmoke", "heatmap", "speaker", "team", "advancedAnalytics", "pdfCsv", "nightVision"],
  },
  HOME: {
    START: ["realtime", "telegramAlerts", "guardMode", "dailyReports", "cameraStatus", "safetyLight", "aiAssistant"],
    STANDARD: ["everythingStart", "visitorAlerts", "zone", "fall", "tamper", "loiter", "plates", "busyHours"],
    PRO: ["everythingStandard", "plateLists", "heatmap", "speaker", "team", "advancedAnalytics", "pdfCsv", "nightVision"],
  },
  FARM: {
    START: ["realtime", "livestockCounting", "telegramAlerts", "guardMode", "dailyReports", "safetyLight", "aiAssistant"],
    STANDARD: ["everythingStart", "livestockDrop", "animalPen", "intruder", "tamper", "loiter", "plates", "busyHours"],
    PRO: ["everythingStandard", "fireSmoke", "nightAnimals", "plateLists", "heatmap", "speaker", "team", "advancedAnalytics", "pdfCsv", "nightVision"],
  },
};

(async () => {
  const db = new PrismaClient();
  for (const [service, tiers] of Object.entries(F))
    for (const [tier, features] of Object.entries(tiers)) {
      const r = await db.plan.updateMany({ where: { service, tier }, data: { features } });
      console.log(service, tier, r.count ? "ok" : "missing", features.length);
    }
  // support contacts shown on the site
  for (const [key, value] of [["supportPhone", "+998 99 140 20 60"], ["supportEmail", "smartvisionai@mail.com"]])
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  console.log("contacts ok");
  await db.$disconnect();
})();
