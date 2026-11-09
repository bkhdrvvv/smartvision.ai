import "server-only";
import { db } from "./db";

export const SETTING_DEFAULTS = {
  paymentCard: "8600 •••• •••• 4417",
  supportPhone: "+998 71 200 00 00",
  supportEmail: "hello@smartvision.ai",
  monthlyExpenses: "730000",
  // operator of the service (shown in the Terms of Use / Privacy Policy)
  companyName: "SMARTVISION AI",
  companyTin: "",
  companyAddress: "Toshkent, O'zbekiston",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSettings(): Promise<Record<SettingKey, string>> {
  try {
    // only the public site settings — the same table also stores per-user security state (2FA secrets, token versions)
    const keys = Object.keys(SETTING_DEFAULTS);
    const rows = await db.setting.findMany({ where: { key: { in: keys } } });
    const out: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const r of rows) out[r.key] = r.value;
    return out as Record<SettingKey, string>;
  } catch {
    return { ...SETTING_DEFAULTS };
  }
}
