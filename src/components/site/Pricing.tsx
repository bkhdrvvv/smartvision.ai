"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cctv, Check, MoonStar, Sparkles, Ticket } from "lucide-react";
import { SectionTitle } from "./SectionTitle";
import { PriceCalculator } from "./Calculator";
import { KIND_ICON, type Kind } from "./Solutions";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { cn, money } from "@/lib/format";
import { yearPrice, YEAR_OFF } from "@/lib/billing";
import { BillingToggle } from "./BillingToggle";

export type PlanDTO = {
  id: string;
  service: "SCHOOL" | "HOME" | "FARM";
  tier: "START" | "STANDARD" | "PRO";
  maxCameras: number;
  priceMonthly: number;
  features: string[];
  recommended: boolean;
};

export function Pricing({ plans, authed, initial = "SCHOOL" }: { plans: PlanDTO[]; authed: boolean; initial?: PlanDTO["service"] }) {
  const { d, f } = useI18n();
  const [svc, setSvc] = useState<PlanDTO["service"]>(initial);
  const [months, setMonths] = useState<1 | 12>(1);
  const list = plans.filter((p) => p.service === svc).sort((a, b) => a.priceMonthly - b.priceMonthly);
  const tabs: { s: PlanDTO["service"]; k: Kind; label: string }[] = [
    { s: "SCHOOL", k: "school", label: "Smart School" },
    { s: "HOME", k: "home", label: "Smart Home" },
    { s: "FARM", k: "farm", label: "Smart Farm" },
  ];

  return (
    <section id="pricing" className="relative mx-auto max-w-[1240px] scroll-mt-24 px-5 py-28 md:py-36">
      <SectionTitle eyebrow={d.pricing.eyebrow} a={d.pricing.title1} b={d.pricing.title2} text={d.pricing.text} />
      <div className="mt-10 flex justify-center">
        <div className="glass inline-flex rounded-2xl p-1" role="tablist">
          {tabs.map((t) => {
            const I = KIND_ICON[t.k];
            const on = svc === t.s;
            return (
              <button key={t.s} role="tab" aria-selected={on} onClick={() => setSvc(t.s)} className={cn("relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors sm:px-5", on ? "text-fg" : "text-fg-muted hover:text-fg")}>
                {on && <motion.span layoutId="price-tab" className="absolute inset-0 rounded-xl border border-brand-400/40 bg-brand-500/15" transition={{ type: "spring", damping: 30, stiffness: 400 }} />}
                <I size={14} className="relative" />
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6"><BillingToggle months={months} onChange={setMonths} center /></div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {list.map((p, i) => {
            const hl = p.recommended;
            const href = authed ? `/dashboard/subscription?plan=${p.id}#plans` : `/register?plan=${p.id}`;
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 30, rotateX: -10 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: i * 0.07, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={cn("card relative flex flex-col p-7", hl && "card-hl lg:-translate-y-3")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand-400">{d.pricing.tiers[p.tier]}</span>
                  {hl && <span className="chip chip-blue !h-6 !text-[11px]"><Sparkles size={11} /> {d.pricing.recommended}</span>}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[13px] text-fg-muted"><Cctv size={14} /> {fmt(d.pricing.upTo, { n: p.maxCameras })}</div>
                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="font-display text-[46px] font-extrabold tracking-tight">{money(months === 12 ? yearPrice(p.priceMonthly, p.tier) : p.priceMonthly)}</span>
                  <span className="text-sm text-fg-muted">{months === 12 ? f.bill.perYear : d.common.uzs}</span>
                </div>
                {months === 12 ? (
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <span className="text-fg-dim">{fmt(f.bill.yearNote, { n: money(p.priceMonthly * 12) })}</span>
                    <span className="chip chip-ok !h-6 !text-[11.5px] font-bold">{fmt(f.bill.save, { n: money(YEAR_OFF[p.tier]) })}</span>
                  </div>
                ) : (
                  <div className="text-[12px] text-fg-dim">{d.common.perMonthLong}</div>
                )}
                {p.features.includes("nightVision") && (
                  // Night Vision — the top plan's headline feature, shown on its own
                  <div className="relative mt-6 overflow-hidden rounded-2xl border border-emerald-400/40 bg-[linear-gradient(135deg,rgba(16,185,129,.16),rgba(34,211,238,.08)_55%,rgba(124,92,255,.12))] p-4 shadow-[0_0_30px_-8px_rgba(16,185,129,.55)]">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><MoonStar size={20} /></span>
                      <div>
                        <div className="flex items-center gap-2 text-[15px] font-extrabold tracking-wide text-emerald-200">NIGHT VISION <span className="chip !h-5 border-emerald-400/50 bg-emerald-400/10 !px-2 !text-[10px] text-emerald-200">{d.pricing.nightVisionOnly}</span></div>
                        <div className="mt-0.5 text-[12.5px] leading-snug text-fg-muted">{d.pricing.nightVisionText}</div>
                      </div>
                    </div>
                  </div>
                )}
                <ul className="mt-6 space-y-3 border-t border-line pt-6">
                  {p.features.filter((f) => f !== "nightVision").map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-[14px]">
                      <Check size={15} className="text-brand-400" /> {(d.planFeatures as Record<string, string>)[f] ?? f}
                    </li>
                  ))}
                </ul>
                <Link href={href} className={cn("btn btn-lg mt-8 w-full", hl ? "btn-primary" : "btn-ghost")}>
                  {d.pricing.subscribe}
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <PriceCalculator plans={plans} authed={authed} initial={svc} key={svc} />
      <p className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-fg-dim">
        <span className="flex items-center gap-2 font-semibold text-violet-400"><Sparkles size={14} /> {d.dash.trial.title}</span>
        <span className="flex items-center gap-2"><Ticket size={14} /> {d.pricing.coupon}</span>
      </p>
    </section>
  );
}
