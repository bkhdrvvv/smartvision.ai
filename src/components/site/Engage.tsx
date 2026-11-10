"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Check, Copy, Loader2, PhoneCall, PiggyBank, RotateCcw, Send, ShieldQuestion, Tractor } from "lucide-react";
import { contactAction, type ContactState } from "@/app/actions/contact";
import { useI18n } from "@/lib/i18n/client";
import { cn, money } from "@/lib/format";

/* ───── «How safe is your place?» — 8 questions → score 0..100 ───── */
export function SecurityQuiz() {
  const { f } = useI18n();
  const y = f.y;
  const [i, setI] = useState(0);
  const [pts, setPts] = useState<number[]>([]);
  const done = i >= y.quizQ.length;
  const score = Math.round((pts.reduce((a, b) => a + b, 0) / (y.quizQ.length * 2)) * 100);
  const answer = (p: number) => { setPts((x) => [...x, p]); setI((x) => x + 1); };
  const level = score < 45 ? y.levelLow : score < 75 ? y.levelMid : y.levelHigh;
  const tone = score < 45 ? "#f43f5e" : score < 75 ? "#f59e0b" : "#34d399";
  return (
    <div className="card mx-auto max-w-2xl !rounded-[24px] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><ShieldQuestion size={20} /></span>
        <div><h2 className="text-[20px] font-bold">{y.quizTitle}</h2><p className="text-[13px] text-fg-muted">{y.quizLead}</p></div>
      </div>
      {!done ? (
        <div className="mt-6">
          <div className="mb-2 flex justify-between text-[12px] text-fg-dim"><span>{i + 1} / {y.quizQ.length}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all" style={{ width: `${(i / y.quizQ.length) * 100}%` }} /></div>
          <p className="mt-6 text-[19px] font-semibold">{y.quizQ[i]}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <button onClick={() => answer(2)} className="btn btn-primary">{y.yes}</button>
            <button onClick={() => answer(1)} className="btn btn-ghost">{y.partly}</button>
            <button onClick={() => answer(0)} className="btn btn-ghost">{y.no}</button>
          </div>
        </div>
      ) : (
        <div className="mt-6 text-center">
          <div className="text-[13px] uppercase tracking-[0.18em] text-fg-dim">{y.score}</div>
          <div className="relative mx-auto my-4 grid h-40 w-40 place-items-center rounded-full" style={{ background: `conic-gradient(${tone} ${score * 3.6}deg, rgba(255,255,255,.08) 0)` }}>
            <div className="grid h-32 w-32 place-items-center rounded-full bg-ink-900 font-display text-[44px] font-extrabold">{score}</div>
          </div>
          <p className="text-[17px] font-semibold" style={{ color: tone }}>{level}</p>
          <div className="mx-auto mt-4 max-w-md rounded-2xl border border-line p-4 text-left text-[14px] text-fg-muted"><b className="text-fg">{y.quizAdvice}:</b> {y.quizAdviceText}</div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/pricing#calculator" className="btn btn-primary">{y.quizCta}</Link>
            <button onClick={() => { setI(0); setPts([]); }} className="btn btn-ghost"><RotateCcw size={15} /> {y.again}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── before / after slider: the same yard through an ordinary camera and through the AI ───── */
function Scene({ ai }: { ai: boolean }) {
  return (
    <svg viewBox="0 0 960 540" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b2540" /><stop offset="1" stopColor="#0c1120" /></linearGradient>
      </defs>
      <rect width="960" height="540" fill="url(#sky)" />
      <rect y="360" width="960" height="180" fill="#151b2b" />
      <rect x="560" y="150" width="330" height="210" fill="#232c44" /><rect x="610" y="230" width="70" height="130" fill="#0f1526" /><rect x="720" y="200" width="120" height="70" fill="#33405f" />
      <rect x="60" y="250" width="400" height="12" fill="#2b3550" />{[80, 150, 220, 290, 360, 430].map((x) => <rect key={x} x={x} y="200" width="10" height="160" fill="#2b3550" />)}
      {/* person */}
      <circle cx="330" cy="300" r="22" fill="#4a5677" /><path d="M296 470v-118q0-34 34-34t34 34v118z" fill="#4a5677" />
      {/* car */}
      <path d="M560 470v-34q0-12 12-14l40-6 34-30q9-7 21-7h84q12 0 21 9l30 28 24 5q12 4 12 16v33z" fill="#3a4566" /><circle cx="620" cy="474" r="20" fill="#0b1020" /><circle cx="776" cy="474" r="20" fill="#0b1020" />
      {/* dog */}
      <path d="M140 470q0-26 26-30h50q14-18 30-8l-4 14q14 6 14 24z" fill="#4a5677" />
      {!ai && <text x="24" y="40" fontSize="20" fill="#8a93a8" fontFamily="Segoe UI, Arial">CAM 02 · 02:14</text>}
      {ai && (
        <g fontFamily="Segoe UI, Arial" fontWeight="700" fontSize="18">
          <rect x="286" y="266" width="88" height="208" fill="none" stroke="#22d3ee" strokeWidth="4" /><rect x="286" y="238" width="140" height="28" fill="#22d3ee" /><text x="294" y="258" fill="#03121a">Odam · 97%</text>
          <rect x="546" y="374" width="300" height="104" fill="none" stroke="#a78bfa" strokeWidth="4" /><rect x="546" y="346" width="160" height="28" fill="#a78bfa" /><text x="554" y="366" fill="#140a2e">Mashina · 94%</text>
          <rect x="132" y="420" width="128" height="56" fill="none" stroke="#34d399" strokeWidth="4" /><rect x="132" y="392" width="90" height="28" fill="#34d399" /><text x="140" y="412" fill="#022c22">It · 88%</text>
          <rect x="20" y="20" width="250" height="34" rx="17" fill="#ef4444" /><text x="38" y="43" fill="#fff">⚠ Begona odam · 02:14</text>
          <rect x="700" y="20" width="236" height="34" rx="17" fill="#0b1226" stroke="#5eead4" /><text x="718" y="43" fill="#ccfbf1">Telegramga yuborildi ✓</text>
        </g>
      )}
    </svg>
  );
}

export function BeforeAfter() {
  const { f } = useI18n();
  const y = f.y;
  const [p, setP] = useState(50);
  return (
    <div className="mx-auto max-w-4xl">
      <div className="relative aspect-video select-none overflow-hidden rounded-[24px] border border-line">
        <Scene ai={false} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${p}%)` }}><Scene ai /></div>
        <div className="pointer-events-none absolute inset-y-0 w-1 bg-white shadow-[0_0_20px_rgba(255,255,255,.6)]" style={{ left: `calc(${p}% - 2px)` }} />
        <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-[12px] font-semibold">{y.baPlain}</span>
        <span className="absolute bottom-3 right-3 rounded-full bg-brand-500/80 px-3 py-1 text-[12px] font-semibold">{y.baAi}</span>
        <input type="range" min={0} max={100} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label={y.baTitle} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
      </div>
    </div>
  );
}

/* ───── savings vs a guard ───── */
export function SavingsCalc({ planPrice }: { planPrice: number }) {
  const { f, d } = useI18n();
  const y = f.y;
  const [pay, setPay] = useState(3_000_000);
  const [n, setN] = useState(1);
  const month = Math.max(0, pay * n - planPrice);
  return (
    <div className="card mx-auto mt-8 max-w-3xl !rounded-[24px] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><PiggyBank size={20} /></span>
        <div><h3 className="text-[20px] font-bold">{y.savTitle}</h3><p className="text-[13px] text-fg-muted">{y.savLead}</p></div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <label><span className="label">{y.savGuard}</span><input type="number" min={0} step={100000} value={pay} onChange={(e) => setPay(Math.max(0, Number(e.target.value) || 0))} className="input font-mono" /></label>
        <label><span className="label">{y.savGuards}</span><input type="number" min={1} max={20} value={n} onChange={(e) => setN(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} className="input font-mono" /></label>
        <div><span className="label">{y.savPlan}</span><div className="input flex items-center font-mono">{money(planPrice)} {d.common.uzs}</div></div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4"><div className="text-[13px] text-emerald-200">{y.savMonth}</div><div className="font-display text-[30px] font-extrabold">{money(month)} <span className="text-[14px] font-medium">{d.common.uzs}</span></div></div>
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4"><div className="text-[13px] text-emerald-200">{y.savYear}</div><div className="font-display text-[30px] font-extrabold">{money(month * 12)} <span className="text-[14px] font-medium">{d.common.uzs}</span></div></div>
      </div>
      <p className="mt-3 text-[12.5px] text-fg-dim">{y.savNote}</p>
    </div>
  );
}

/* ───── share on Telegram → 10% code ───── */
export function ShareDiscount({ code, url }: { code: string; url: string }) {
  const { f } = useI18n();
  const y = f.y;
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(y.shareText)}`;
  return (
    <div className="card flex flex-col gap-4 !rounded-[24px] p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><Send size={20} /></span>
        <div><h3 className="text-[18px] font-bold">{y.shareTitle}</h3><p className="text-[13px] text-fg-muted">{y.shareLead}</p></div>
      </div>
      {!shown ? (
        <a href={href} target="_blank" rel="noopener" onClick={() => setTimeout(() => setShown(true), 1200)} className="btn btn-primary self-start"><Send size={15} /> {y.shareBtn}</a>
      ) : (
        <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-4">
          <div className="text-[12px] uppercase tracking-[0.16em] text-sky-200">{y.shareCode}</div>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-mono text-[26px] font-extrabold tracking-wider">{code}</span>
            <button onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); }} className="btn btn-ghost btn-sm">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
          </div>
          <div className="mt-1 text-[12.5px] text-fg-muted">{y.shareHint}</div>
        </div>
      )}
    </div>
  );
}

/* ───── free consultation: name + phone → admin gets it on Telegram ───── */
export function Consultation() {
  const { f } = useI18n();
  const y = f.y;
  const [state, run, pending] = useActionState<ContactState, FormData>(contactAction, undefined);
  return (
    <div className="card flex flex-col gap-4 !rounded-[24px] p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><PhoneCall size={20} /></span>
        <div><h3 className="text-[18px] font-bold">{y.consultTitle}</h3><p className="text-[13px] text-fg-muted">{y.consultLead}</p></div>
      </div>
      {state?.ok ? (
        <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">✅ {y.consultDone}</p>
      ) : (
        <form action={run} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <input type="hidden" name="message" value={y.consultMsg} />
          <input name="name" required minLength={2} maxLength={80} placeholder={y.consultName} className="input" />
          <input name="phone" required type="tel" pattern="\+?[0-9 ()-]{9,20}" placeholder="+998 90 123 45 67" aria-label={y.consultPhone} className="input" />
          <button disabled={pending} className="btn btn-primary">{pending ? <Loader2 size={15} className="animate-spin" /> : y.consultBtn}</button>
          {state?.error && <p className="err sm:col-span-3">{state.error}</p>}
        </form>
      )}
    </div>
  );
}

/* ───── farm: how much the AI can save ───── */
export function FarmCalc({ planYear }: { planYear: number }) {
  const { f, d } = useI18n();
  const y = f.y;
  const [heads, setHeads] = useState(50);
  const [price, setPrice] = useState(12_000_000);
  const [loss, setLoss] = useState(3);
  const risk = useMemo(() => Math.round(heads * price * (loss / 100)), [heads, price, loss]);
  const save = Math.max(0, Math.round(risk * 0.7) - planYear);
  return (
    <div className="card mx-auto max-w-3xl !rounded-[24px] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><Tractor size={20} /></span>
        <div><h3 className="text-[20px] font-bold">{y.farmTitle}</h3><p className="text-[13px] text-fg-muted">{y.farmLead}</p></div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <label><span className="label">{y.farmHeads}</span><input type="number" min={1} value={heads} onChange={(e) => setHeads(Math.max(1, Number(e.target.value) || 1))} className="input font-mono" /></label>
        <label><span className="label">{y.farmPrice}</span><input type="number" min={0} step={500000} value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))} className="input font-mono" /></label>
        <label><span className="label">{y.farmLoss}</span><input type="number" min={0} max={50} step={0.5} value={loss} onChange={(e) => setLoss(Math.min(50, Math.max(0, Number(e.target.value) || 0)))} className="input font-mono" /></label>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line p-4"><div className="text-[13px] text-fg-muted">{y.farmRisk}</div><div className="font-display text-[24px] font-extrabold">{money(risk)}</div></div>
        <div className="rounded-2xl border border-line p-4"><div className="text-[13px] text-fg-muted">{y.farmPlan}</div><div className="font-display text-[24px] font-extrabold">{money(planYear)}</div></div>
        <div className={cn("rounded-2xl border p-4", save > 0 ? "border-emerald-400/30 bg-emerald-400/10" : "border-line")}><div className="text-[13px] text-emerald-200">{y.farmSave}</div><div className="font-display text-[24px] font-extrabold">{money(save)} <span className="text-[13px] font-medium">{d.common.uzs}</span></div></div>
      </div>
      <p className="mt-3 text-[12.5px] text-fg-dim">{y.farmNote}</p>
    </div>
  );
}

/* ───── school: one day, step by step (animated timeline) ───── */
export function SchoolStory() {
  const { f } = useI18n();
  const y = f.y;
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 text-center font-display text-[28px] font-extrabold">{y.schoolStory}</h2>
      <ol className="relative space-y-4 border-l-2 border-brand-500/40 pl-6">
        {y.schoolSteps.map((s, i) => {
          const [time, ...rest] = s.split(" — ");
          return (
            <li key={i} className="relative animate-[fadeUp_.6s_ease_both]" style={{ animationDelay: `${i * 0.25}s` }}>
              <span className="absolute -left-[33px] top-1 grid h-4 w-4 place-items-center rounded-full bg-brand-500 shadow-[0_0_12px_rgba(59,130,246,.8)]" />
              <div className="card !rounded-2xl p-4"><span className="font-mono text-[13px] font-bold text-brand-300">{time}</span><p className="mt-1 text-[15px]">{rest.join(" — ")}</p></div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
