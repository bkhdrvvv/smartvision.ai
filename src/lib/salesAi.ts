import "server-only";
import { db } from "./db";
import { dictionaries } from "./i18n";
import { getSettings } from "./settings";
import { geminiLoop, type ChatTurn } from "./adminAi";

/** Public AI consultant on the website: answers from the real plans (prices, camera limits, features) — no data access. */
export async function askSalesAi(history: ChatTurn[]) {
  const [plans, s] = await Promise.all([db.plan.findMany({ where: { active: true }, orderBy: [{ service: "asc" }, { priceMonthly: "asc" }] }), getSettings()]);
  const label = dictionaries.uz.planFeatures as Record<string, string>;
  const svc = { SCHOOL: "Maktab (Smart School)", HOME: "Uy (Smart Home)", FARM: "Ferma (Smart Farm)" } as const;
  const lines = plans.map((p) => `- ${svc[p.service]} · ${p.tier}: ${p.priceMonthly.toLocaleString("ru-RU")} so'm/oy, ${p.maxCameras} tagacha kamera. Imkoniyatlar: ${p.features.map((f) => label[f] ?? f).join(", ")}.`).join("\n");
  const system = `You are the sales consultant on the SMARTVISION AI website (AI video monitoring for schools, homes and farms in Uzbekistan).
Answer in the visitor's language (Uzbek in Latin script, Russian or English). Be short, warm and concrete; no technical jargon.
How it works: the customer's own IP cameras (RTSP/ONVIF) connect to a small "Edge AI" program on a computer at the site; it detects people, cars, animals, fire, falls etc. and sends alerts with photos to the website and Telegram. Video stays at the site. A 7-day free trial is available once. Payment: monthly, by card transfer (receipt is checked).
"Standard" includes everything in "Start", "Pro" includes everything in "Standard".
Plans (real, current):
${lines}
Recommend the cheapest plan that fits the number of cameras and the needs; mention a stronger plan only if they need its features. Never invent prices or features that are not listed.
Contacts: phone ${s.supportPhone}, email ${s.supportEmail}. For installation, discounts or more cameras than the biggest plan → suggest calling. Sign up: /register. Plain text or short Markdown lists only.`;
  return geminiLoop(history, system, undefined, async () => ({ error: "no tools" }));
}
