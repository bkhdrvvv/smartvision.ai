import "server-only";
import { db } from "./db";

/** Promo banner set by the admin (Admin → Settings). `raw` returns the stored values even when expired/empty. */
export async function getPromo(raw = false): Promise<{ text: string; link: string; until: string }> {
  const rows = await db.setting.findMany({ where: { key: { in: ["promo:text", "promo:link", "promo:until"] } } }).catch(() => []);
  const v = Object.fromEntries(rows.map((r) => [r.key.slice(6), r.value]));
  const p = { text: v.text ?? "", link: v.link ?? "", until: v.until ?? "" };
  if (raw) return p;
  if (!p.text) return { text: "", link: "", until: "" };
  if (p.until && new Date(`${p.until}T23:59:59+05:00`).getTime() < Date.now()) return { text: "", link: "", until: "" };
  return p;
}
