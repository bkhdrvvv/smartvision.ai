import type { Dict } from "./i18n";

/** 100000 -> "100,000" (thin grouping like the design) */
export function money(n: number) {
  return n.toLocaleString("en-US");
}

export function hhmm(d: Date | string) {
  const x = new Date(d);
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
}

export function shortDate(d: Date | string, locale = "en-US") {
  return new Date(d).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function longDate(d: Date | string, locale = "en-US") {
  return new Date(d).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

export function ago(d: Date | string, dict: Dict, now = Date.now()) {
  const s = Math.max(0, (now - new Date(d).getTime()) / 1000);
  if (s < 60) return dict.common.justNow;
  if (s < 3600) return `${Math.floor(s / 60)} ${dict.common.minAgo}`;
  if (s < 86400) return `${Math.floor(s / 3600)} ${dict.common.hAgo}`;
  return `${Math.floor(s / 86400)} ${dict.common.dAgo}`;
}

export function eventTime(d: Date | string, dict: Dict) {
  const x = new Date(d);
  const today = new Date();
  const y = new Date(Date.now() - 86400000);
  if (x.toDateString() === today.toDateString()) return `${dict.common.today} ${hhmm(x)}`;
  if (x.toDateString() === y.toDateString()) return `${dict.common.yesterday} ${hhmm(x)}`;
  return `${shortDate(x)} ${hhmm(x)}`;
}

export function initials(name: string) {
  return name
    .replace(/[^\p{L}\s.]/gu, " ")
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function daysLeft(end: Date | string | null | undefined) {
  if (!end) return 0;
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000));
}

export function maskPhone(p?: string | null) {
  if (!p) return "—";
  const digits = p.replace(/\D/g, "");
  if (digits.length < 9) return p;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} *** ${digits.slice(-4, -2)} ${digits.slice(-2)}`;
}

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}
