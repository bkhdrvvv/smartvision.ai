"use server";

import { audit, requireAdmin } from "@/lib/auth";
import { aiConfigured, askAdminAi, type ChatTurn } from "@/lib/adminAi";
import { hit } from "@/lib/ratelimit";

export async function askAssistant(history: ChatTurn[]): Promise<{ text?: string; error?: string }> {
  const admin = await requireAdmin();
  if (!aiConfigured()) return { error: "not_configured" };
  if (!hit(`ai:${admin.id}`, 60, 60 * 60_000)) return { error: "too_many" };
  // keep only well-formed recent turns; the last one must be the admin's question
  const turns = (Array.isArray(history) ? history : [])
    .filter((t) => (t?.role === "user" || t?.role === "assistant") && typeof t.text === "string" && t.text.trim())
    .slice(-20)
    .map((t) => ({ role: t.role, text: t.text.slice(0, 8000) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return { error: "empty" };
  await audit(admin.id, "admin.ai_question", undefined, { q: turns[turns.length - 1].text.slice(0, 300) });
  return askAdminAi(turns);
}
