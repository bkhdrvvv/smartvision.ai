import en, { type Dict } from "./en";
import uz from "./uz";
import ru from "./ru";

export const LOCALES = ["uz", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";
export const LOCALE_COOKIE = "sv_lang";

export const dictionaries: Record<Locale, Dict> = { uz, ru, en };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Replace {n}, {m}… placeholders */
export function fmt(str: string, vars: Record<string, string | number>) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export const intlLocale: Record<Locale, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

export type { Dict };
