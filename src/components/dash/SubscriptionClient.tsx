"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Copy, FileCheck2, Loader2, ShieldCheck, Sparkles, Ticket, Upload } from "lucide-react";
import { checkCoupon, requestPlan, startTrial, type ActionResult } from "@/app/actions/customer";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { cn, money } from "@/lib/format";
import type { PlanDTO } from "@/components/site/Pricing";
import { BillingToggle } from "@/components/site/BillingToggle";
import { periodAmount, yearPrice, YEAR_OFF } from "@/lib/billing";

export function CopyCard({ card }: { card: string }) {
  const { d } = useI18n();
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line-strong bg-ink-850 p-4">
      <div>
        <div className="text-[12px] text-fg-dim">{d.dash.subscriptionPage.card}</div>
        <div className="mt-1 font-mono text-[20px] font-bold tracking-wider">{card}</div>
      </div>
      <button
        onClick={async () => {
          // copy digits only when the admin entered a full card number; a masked placeholder is copied as-is
          const digits = card.replace(/\D/g, "");
          await navigator.clipboard.writeText(digits.length >= 16 ? digits : card);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        }}
        className="btn btn-ghost btn-sm"
      >
        {ok ? <Check size={14} /> : <Copy size={14} />} {ok ? d.common.copied : d.common.copy}
      </button>
    </div>
  );
}

export function ReceiptUpload({ paymentId }: { paymentId: string }) {
  const { d } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const send = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return setMsg({ ok: false, t: d.dash.subscriptionPage.uploadHint });
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`/api/receipts/${paymentId}`, { method: "POST", body: fd });
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, t: d.dash.subscriptionPage.uploaded });
      router.refresh();
    } else setMsg({ ok: false, t: r.status === 415 ? d.dash.subscriptionPage.uploadHint : d.common.error });
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) send(f); }}
        className={cn("flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 transition", drag ? "border-brand-400 bg-brand-500/10" : "border-brand-400/35 hover:border-brand-400/70")}
      >
        {busy ? <Loader2 className="animate-spin text-brand-400" size={30} /> : <Upload size={30} className="text-brand-400" />}
        <span className="text-[17px] font-bold">{busy ? d.dash.subscriptionPage.uploading : d.dash.subscriptionPage.upload}</span>
        <span className="text-[13px] text-fg-dim">{d.dash.subscriptionPage.uploadHint}</span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }} />
      {msg && <p className={cn("mt-3 text-sm", msg.ok ? "text-ok-soft" : "text-bad-soft")}>{msg.t}</p>}
    </div>
  );
}

const STEPS = ["REQUESTED", "APPROVED", "AWAITING_PAYMENT", "RECEIPT_SUBMITTED", "UNDER_REVIEW", "ACTIVE"] as const;

export function Timeline({ status, history }: { status: string; history: { status: string; at: string }[] }) {
  const { d } = useI18n();
  const idx = STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <ol className="relative space-y-6">
      <span className="absolute bottom-4 left-[19px] top-4 w-px bg-line-strong" />
      {STEPS.map((s, i) => {
        const done = i < idx || status === "ACTIVE";
        const current = i === idx && status !== "ACTIVE";
        const h = [...history].reverse().find((x) => x.status === s);
        const [title, sub] = d.dash.subscriptionPage.timeline[s];
        return (
          <li key={s} className="relative flex gap-4">
            <span className={cn("relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border", done ? "border-ok/40 bg-ok/15 text-ok-soft" : current ? "border-warn/50 bg-warn/15 text-warn-soft" : "border-line-strong bg-ink-850 text-fg-dim")}>
              {done ? <Check size={16} /> : current ? <Clock size={16} /> : s === "ACTIVE" ? <ShieldCheck size={16} /> : <FileCheck2 size={16} />}
            </span>
            <div>
              <div className={cn("font-semibold", !done && !current && "text-fg-muted")}>{title}</div>
              <div className="text-[13px] text-fg-dim">{h ? new Date(h.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : sub}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PlanPicker({ plans, currentPlanId, preselect, trialAvailable }: { plans: PlanDTO[]; currentPlanId?: string; preselect?: string; trialAvailable?: boolean }) {
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialMsg, setTrialMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const router = useRouter();
  const { d, f } = useI18n();
  const [planId, setPlanId] = useState(preselect && plans.some((p) => p.id === preselect) ? preselect : (plans.find((p) => p.recommended) ?? plans[0])?.id);
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<{ ok: boolean; pct?: number } | null>(null);
  const [state, action, pending] = useActionState<ActionResult, FormData>(requestPlan, undefined);
  const [months, setMonths] = useState<1 | 12>(12);
  const plan = plans.find((p) => p.id === planId);
  const price = plan ? periodAmount(plan.priceMonthly, plan.tier, months, coupon?.ok ? coupon.pct : null) : 0;

  if (state?.ok) return <p className="rounded-xl border border-ok/30 bg-ok/10 p-4 text-ok-soft">{state.message}</p>;
  if (trialMsg?.ok) return <p className="rounded-xl border border-ok/30 bg-ok/10 p-4 text-ok-soft">{trialMsg.t}</p>;

  return (
    <form action={action} className="space-y-5">
      {trialAvailable && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-violet-500/40 bg-[radial-gradient(80%_120%_at_0%_0%,rgba(124,92,255,.22),transparent_60%)] p-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[16px] font-bold"><Sparkles size={16} className="text-violet-400" /> {d.dash.trial.title}</div>
            <p className="mt-1 text-[13px] text-fg-muted">{d.dash.trial.text}</p>
            {trialMsg && !trialMsg.ok && <p className="mt-2 text-[13px] text-bad-soft">{trialMsg.t}</p>}
          </div>
          <button
            type="button"
            disabled={trialBusy || !planId}
            onClick={async () => {
              setTrialBusy(true);
              const r = await startTrial(planId!);
              setTrialBusy(false);
              setTrialMsg({ ok: !!r?.ok, t: r?.message ?? r?.error ?? d.common.error });
              if (r?.ok) router.refresh();
            }}
            className="btn btn-lg !bg-violet-500 text-white hover:!bg-violet-400"
          >
            {trialBusy ? <Loader2 size={16} className="animate-spin" /> : d.dash.trial.button}
          </button>
        </div>
      )}
      <input type="hidden" name="planId" value={planId ?? ""} />
      <input type="hidden" name="months" value={months} />
      <BillingToggle months={months} onChange={setMonths} />
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => (
          <button type="button" key={p.id} onClick={() => setPlanId(p.id)} className={cn("card p-5 text-left transition", planId === p.id ? "card-hl" : "hover:border-line-strong")}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-400">{d.pricing.tiers[p.tier]}</span>
              {p.id === currentPlanId && <span className="chip chip-ok !h-5 !text-[10px]">{d.common.active}</span>}
            </div>
            <div className="mt-3 font-display text-[28px] font-extrabold">{money(months === 12 ? yearPrice(p.priceMonthly, p.tier) : p.priceMonthly)} <span className="text-sm font-medium text-fg-dim">{months === 12 ? f.bill.perYear : d.common.uzs}</span></div>
            {months === 12 && <div className="mt-1 text-[12.5px]"><span className="text-fg-dim line-through">{money(p.priceMonthly * 12)}</span> <span className="ml-1 font-semibold text-ok-soft">{fmt(f.bill.save, { n: money(YEAR_OFF[p.tier]) })}</span></div>}
            <div className="text-[13px] text-fg-muted">{fmt(d.pricing.upTo, { n: p.maxCameras })}</div>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1">
          <span className="label">{d.dash.subscriptionPage.coupon}</span>
          <div className="relative">
            <Ticket size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-dim" />
            <input name="coupon" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCoupon(null); }} className="input !pl-10 uppercase" placeholder="WELCOME10" />
          </div>
        </label>
        <button type="button" disabled={!code} onClick={async () => { const r = await checkCoupon(code); setCoupon(r ? { ok: true, pct: r.percentOff } : { ok: false }); }} className="btn btn-ghost !h-11">{d.dash.subscriptionPage.apply}</button>
      </div>
      {coupon && <p className={cn("text-sm", coupon.ok ? "text-ok-soft" : "text-bad-soft")}>{coupon.ok ? fmt(d.dash.subscriptionPage.couponOk, { n: coupon.pct! }) : d.dash.subscriptionPage.couponBad}</p>}
      {state?.error && <p className="err">{state.error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <div className="text-fg-muted">{months === 12 ? f.bill.yearTotal : d.dash.subscriptionPage.monthly}: <span className="font-display text-2xl font-extrabold text-fg">{money(price)}</span> {d.common.uzs}</div>
        <button disabled={pending || !planId} className="btn btn-primary btn-lg">{pending ? <Loader2 size={16} className="animate-spin" /> : d.dash.subscriptionPage.request}</button>
      </div>
    </form>
  );
}
