"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES } from "@/lib/i18n";
import { useI18n, useSetLocale } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

/** Segmented UZ · RU · EN switch (landing header) */
export function LangSegment() {
  const { locale } = useI18n();
  const { set, pending } = useSetLocale();
  return (
    <div className={cn("flex items-center rounded-lg border border-line-strong bg-ink-850/70 p-0.5", pending && "opacity-60")} role="group" aria-label="Language">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => set(l)}
          aria-pressed={locale === l}
          className={cn(
            "h-7 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-wider transition",
            locale === l ? "bg-ink-600 text-fg shadow-inner" : "text-fg-dim hover:text-fg",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Compact dropdown (dashboard header) */
export function LangMenu() {
  const { locale, d } = useI18n();
  const { set } = useSetLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="grid h-11 w-12 place-items-center rounded-xl border border-line-strong bg-ink-850 text-sm font-semibold uppercase" aria-label={d.common.language}>
        {locale}
      </button>
      {open && (
        <div className="glass absolute right-0 top-13 z-50 w-32 overflow-hidden rounded-xl p-1">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => {
                set(l);
                setOpen(false);
              }}
              className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-white/5", l === locale && "text-brand-400")}
            >
              <span>{{ uz: "O'zbekcha", ru: "Русский", en: "English" }[l]}</span>
              <span className="text-xs uppercase text-fg-dim">{l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
