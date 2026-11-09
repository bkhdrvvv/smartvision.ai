"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, dictionaries, type Dict, type Locale } from "./index";
import { featureDicts } from "./features";

const Ctx = createContext<{ locale: Locale; d: Dict }>({ locale: "uz", d: dictionaries.uz });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={{ locale, d: dictionaries[locale] }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  return { ...c, f: featureDicts[c.locale] };
}

export function useSetLocale() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (l: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    start(() => router.refresh());
  };
  return { set, pending };
}
