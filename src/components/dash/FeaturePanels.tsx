"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, Loader2, Send, Trash2, UserPlus, Volume2, VolumeX } from "lucide-react";
import {
  inviteMember, removeMember, saveGuard, setSpeaker, setWeekly, telegramConnectLink, telegramDisconnect, telegramStatus,
} from "@/app/actions/features";
import type { ActionResult } from "@/app/actions/customer";
import { playAlarm, unlockAudio } from "@/lib/alarm";
import { featureDicts } from "@/lib/i18n/features";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

/* ───── Telegram ───── */
export function TelegramPanel({ linked, name, botReady }: { linked: boolean; name: string | null; botReady: boolean }) {
  const { f } = useI18n();
  const t = f.telegram;
  const [st, setSt] = useState({ linked, name });
  const [busy, start] = useTransition();
  const [waiting, setWaiting] = useState(false);
  // after opening Telegram, check every 3 s until the bot confirms the link
  useEffect(() => {
    if (!waiting) return;
    const iv = setInterval(async () => {
      const s = await telegramStatus();
      if (s.linked) {
        setSt(s);
        setWaiting(false);
      }
    }, 3000);
    const stop = setTimeout(() => setWaiting(false), 5 * 60_000);
    return () => { clearInterval(iv); clearTimeout(stop); };
  }, [waiting]);

  if (!botReady) return <p className="text-[13px] text-fg-dim">{t.noBot}</p>;
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-fg-muted">{t.lead}</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("chip", st.linked ? "chip-ok" : "chip-warn")}>{st.linked ? `${t.linked} · ${st.name ?? ""}` : t.notLinked}</span>
        {st.linked ? (
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => start(async () => { await telegramDisconnect(); setSt({ linked: false, name: null }); })}>{t.disconnect}</button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const r = await telegramConnectLink();
                if (r.url) {
                  window.open(r.url, "_blank", "noopener");
                  setWaiting(true);
                }
              })
            }
          >
            {busy || waiting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {t.connect}
          </button>
        )}
      </div>
      {!st.linked && <p className="text-[12px] text-fg-dim">{t.step}</p>}
    </div>
  );
}

/* ───── guard mode ───── */
export function GuardPanel({ mode, from, to, canEdit }: { mode: string; from: string; to: string; canEdit: boolean }) {
  const { f } = useI18n();
  const g = f.guard;
  const [m, setM] = useState(mode);
  const [state, run, pending] = useActionState<ActionResult, FormData>(saveGuard, undefined);
  return (
    <form action={run} className="space-y-3">
      <p className="text-[13px] text-fg-muted">{g.lead}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["auto", "custom", "always", "off"] as const).map((k) => (
          <label key={k} className={cn("flex cursor-pointer items-start gap-2 rounded-xl border p-3", m === k ? "border-brand-400/60 bg-brand-500/10" : "border-line")}>
            <input type="radio" name="mode" value={k} checked={m === k} onChange={() => setM(k)} disabled={!canEdit} className="mt-1 accent-brand-500" />
            <span>
              <span className="block text-[14px] font-semibold">{g.modes[k]}</span>
              <span className="block text-[12px] text-fg-dim">{g.hints[k]}</span>
            </span>
          </label>
        ))}
      </div>
      <div className={cn("grid grid-cols-2 gap-3", m !== "custom" && "opacity-50")}>
        <label><span className="label">{g.from}</span><input type="time" name="from" defaultValue={from} className="input" disabled={!canEdit} /></label>
        <label><span className="label">{g.to}</span><input type="time" name="to" defaultValue={to} className="input" disabled={!canEdit} /></label>
      </div>
      {state?.ok && <p className="text-sm text-ok-soft">{g.saved}</p>}
      {state?.error && <p className="err">{state.error}</p>}
      {canEdit && <button disabled={pending} className="btn btn-primary">{pending ? <Loader2 size={15} className="animate-spin" /> : g.save}</button>}
    </form>
  );
}

/* ───── speaker ───── */
const PHRASES = { uz: featureDicts.uz.speaker.phrase, ru: featureDicts.ru.speaker.phrase, en: featureDicts.en.speaker.phrase };

export function SpeakerPanel({ enabled, verified, canEdit }: { enabled: boolean; verified: boolean; canEdit: boolean }) {
  const { f, locale } = useI18n();
  const s = f.speaker;
  const [on, setOn] = useState(enabled);
  const [ok, setOk] = useState(verified);
  const [played, setPlayed] = useState(false);
  const [tip, setTip] = useState(false);
  const [busy, start] = useTransition();
  const save = (en: boolean, ver?: boolean) => start(async () => { await setSpeaker(en, ver); });
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-fg-muted">{s.lead}</p>
      <p className="text-[14px] font-semibold">{s.question}</p>
      <div className="flex flex-wrap gap-2">
        <button disabled={!canEdit || busy} onClick={() => { setOn(true); save(true); }} className={cn("btn btn-sm", on ? "btn-primary" : "btn-ghost")}><Volume2 size={14} /> {s.yes}</button>
        <button disabled={!canEdit || busy} onClick={() => { setOn(false); setOk(false); setPlayed(false); save(false); }} className={cn("btn btn-sm", !on ? "btn-primary" : "btn-ghost")}><VolumeX size={14} /> {s.no}</button>
      </div>
      {on ? (
        <div className="space-y-2 rounded-xl border border-line p-3">
          <span className={cn("chip", ok ? "chip-ok" : "chip-warn")}>{ok ? s.verified : s.unverified}</span>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                unlockAudio();
                setTimeout(() => setPlayed(playAlarm(PHRASES, locale)), 60);
                setTip(false);
              }}
            >
              <Volume2 size={14} /> {s.test}
            </button>
            {played && !ok && (
              <>
                <button disabled={!canEdit || busy} className="btn btn-primary btn-sm" onClick={() => { setOk(true); save(true, true); }}><Check size={14} /> {s.heard}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setTip(true); save(true, false); }}>{s.notHeard}</button>
              </>
            )}
          </div>
          {tip && <p className="text-[12px] text-warn-soft">{s.notHeardTip}</p>}
        </div>
      ) : (
        <p className="text-[12px] text-fg-dim">{s.off}</p>
      )}
    </div>
  );
}

/* ───── weekly report ───── */
export function WeeklyPanel({ on, canEdit }: { on: boolean; canEdit: boolean }) {
  const { f } = useI18n();
  const [v, setV] = useState(on);
  const [busy, start] = useTransition();
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-fg-muted">{f.weekly.lead}</p>
      <div className="flex gap-2">
        {[true, false].map((x) => (
          <button key={String(x)} disabled={!canEdit || busy} onClick={() => { setV(x); start(async () => { await setWeekly(x); }); }} className={cn("btn btn-sm", v === x ? "btn-primary" : "btn-ghost")}>
            {x ? f.weekly.on : f.weekly.off}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───── team ───── */
type Member = { id: string; name: string; email: string; orgRole: string; you: boolean };
export function TeamPanel({ members, isOwner }: { members: Member[]; isOwner: boolean }) {
  const { f } = useI18n();
  const t = f.team;
  const [state, run, pending] = useActionState<ActionResult, FormData>(inviteMember, undefined);
  const [busy, start] = useTransition();
  const role = (r: string) => t.roles[r as keyof typeof t.roles] ?? r;
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg-muted">{t.lead}</p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{m.name} {m.you && <span className="text-fg-dim">({t.you})</span>}</div>
              <div className="truncate text-[12px] text-fg-dim">{m.email}</div>
            </div>
            <span className="chip chip-blue">{role(m.orgRole)}</span>
            {isOwner && !m.you && m.orgRole !== "OWNER" && (
              <button title={t.remove} disabled={busy} onClick={() => start(async () => { await removeMember(m.id); })} className="btn btn-ghost !h-9 !w-9 !p-0"><Trash2 size={14} /></button>
            )}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <form action={run} className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">{t.name}</span><input name="name" required minLength={2} className="input" /></label>
          <label><span className="label">{t.email}</span><input name="email" type="email" required className="input" /></label>
          <label className="sm:col-span-2">
            <span className="label">{t.role}</span>
            <select name="role" className="input" defaultValue="VIEWER">
              {(["MEMBER", "VIEWER"] as const).map((r) => <option key={r} value={r}>{t.roles[r]} — {t.roleHints[r]}</option>)}
            </select>
          </label>
          {state?.error && <p className="err sm:col-span-2">{state.error}</p>}
          {state?.ok && <p className="text-sm text-ok-soft sm:col-span-2">{state.message}</p>}
          <button disabled={pending} className="btn btn-primary sm:col-span-2 sm:justify-self-start">{pending ? <Loader2 size={15} className="animate-spin" /> : <><UserPlus size={15} /> {t.invite}</>}</button>
        </form>
      ) : (
        <p className="text-[12px] text-fg-dim">{t.onlyOwner}</p>
      )}
    </div>
  );
}
