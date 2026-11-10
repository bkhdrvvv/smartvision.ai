"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Calculator as CalcIcon, Cctv, ShieldPlus } from "lucide-react";
import type { PlanDTO } from "./Pricing";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { cn, money } from "@/lib/format";
import { yearPrice, YEAR_OFF } from "@/lib/billing";

/** "How much will it cost?" — pick the place and the number of cameras, get the cheapest plan that fits. */
export function PriceCalculator({ plans, authed, initial = "HOME" }: { plans: PlanDTO[]; authed: boolean; initial?: PlanDTO["service"] }) {
  const { d, f } = useI18n();
  const x = f.x;
  const [svc, setSvc] = useState<PlanDTO["service"]>(initial);
  const [n, setN] = useState(3);
  const list = useMemo(() => plans.filter((p) => p.service === svc).sort((a, b) => a.priceMonthly - b.priceMonthly), [plans, svc]);
  const maxCams = Math.max(1, ...list.map((p) => p.maxCameras));
  const fit = list.find((p) => p.maxCameras >= n);
  const stronger = fit ? list.find((p) => p.priceMonthly > fit.priceMonthly) : undefined;
  const href = (p: PlanDTO) => (authed ? `/dashboard/subscription?plan=${p.id}` : `/register?plan=${p.id}`);
  return (
    <div id="calculator" className="card mx-auto mt-14 max-w-3xl scroll-mt-28 !rounded-[24px] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-400"><CalcIcon size={20} /></span>
        <div>
          <h3 className="text-[20px] font-bold">{x.calcTitle}</h3>
          <p className="text-[13px] text-fg-muted">{x.calcLead}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <span className="label">{x.calcService}</span>
          <div className="grid grid-cols-3 gap-2">
            {(["HOME", "SCHOOL", "FARM"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSvc(s)} className={cn("btn btn-sm", svc === s ? "btn-primary" : "btn-ghost")}>{x.calcPlans[s]}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="label flex items-center justify-between">{x.calcCameras} <span className="font-mono text-[15px] text-fg">{n}</span></span>
          <input type="range" min={1} max={Math.max(maxCams + 4, 12)} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full accent-brand-500" aria-label={x.calcCameras} />
        </div>
      </div>
      {fit ? (
        <div className="mt-6 grid gap-4 rounded-2xl border border-brand-400/30 bg-brand-500/[.07] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand-400">{x.calcFit}</div>
            <div className="mt-1 text-[22px] font-extrabold">{d.pricing.tiers[fit.tier]} <span className="text-[14px] font-medium text-fg-muted">· <Cctv size={13} className="inline" /> {fmt(d.pricing.upTo, { n: fit.maxCameras })}</span></div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span><span className="font-display text-[34px] font-extrabold">{money(fit.priceMonthly)}</span> <span className="text-[13px] text-fg-muted">{d.common.uzs} / {x.calcMonth}</span></span>
              <span className="text-[13px] text-fg-muted">{x.calcYear}: <b className="text-fg">{money(yearPrice(fit.priceMonthly, fit.tier))}</b> <span className="text-ok-soft">(−{money(YEAR_OFF[fit.tier])})</span> {d.common.uzs}</span>
            </div>
          </div>
          <Link href={href(fit)} className="btn btn-primary">{x.calcPick}</Link>
          {stronger && (
            <Link href={href(stronger)} className="flex items-center gap-2 text-[13px] text-violet-300 hover:underline sm:col-span-2">
              <ShieldPlus size={14} /> {x.calcAlso} {d.pricing.tiers[stronger.tier]} — {money(stronger.priceMonthly)} {d.common.uzs}
            </Link>
          )}
        </div>
      ) : (
        <p className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-[14px] text-amber-100">{fmt(x.calcMany, { n: maxCams })}</p>
      )}
    </div>
  );
}
