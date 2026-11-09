import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, dictionaries, isLocale, type Locale } from "./index";
import { featureDicts } from "./features";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.slice(0, 2).toLowerCase();
  return isLocale(first) ? first : DEFAULT_LOCALE;
}

export async function getDict() {
  const locale = await getLocale();
  return { locale, d: dictionaries[locale], f: featureDicts[locale] };
}
