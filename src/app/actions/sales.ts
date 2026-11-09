"use server";

import { aiConfigured, type ChatTurn } from "@/lib/adminAi";
import { askSalesAi } from "@/lib/salesAi";
import { clientIp, hit } from "@/lib/ratelimit";

/** Website AI consultant — anyone can ask, limited per IP (free Gemini quota). */
export async function askSales(history: ChatTurn[]): Promise<{ text?: string; error?: string }> {
  if (!aiConfigured()) return { error: "not_configured" };
  if (!hit(`sales:${await clientIp()}`, 30, 60 * 60_000)) return { error: "too_many" };
  const turns = (Array.isArray(history) ? history : [])
    .filter((t) => (t?.role === "user" || t?.role === "assistant") && typeof t.text === "string" && t.text.trim())
    .slice(-10)
    .map((t) => ({ role: t.role, text: t.text.slice(0, 1500) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return { error: "empty" };
  return askSalesAi(turns);
}
