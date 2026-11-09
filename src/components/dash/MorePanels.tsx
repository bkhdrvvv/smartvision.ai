"use client";

import { useActionState, useState, useTransition } from "react";
import { Ban, Check, Loader2, ShieldCheck, ThumbsDown, Trash2 } from "lucide-react";
import { addPlate, markFalseAlarm, removePlate, resetSensitivity, saveSchoolTimes, setDaily, setUnknownPlateAlert } from "@/app/actions/features";
import type { ActionResult } from "@/app/actions/customer";
import { formatPlate } from "@/components/dash/Bits";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

/* ───── plate lists ───── */
type Item = { plate: string; kind: string; note: string | null };

export function PlateLists({ items, unknownAlert, canEdit }: { items: Item[]; unknownAlert: boolean; canEdit: boolean }) {
  const { f } = useI18n();
  const m = f.more;
  const [state, run, pending] = useActionState<ActionResult, FormData>(addPlate, undefined);
  const [alert, setAlert] = useState(unknownAlert);
  const [busy, start] = useTransition();
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg-muted">{m.listsLead}</p>
      <label className="flex items-center gap-3 rounded-xl border border-line p-3">
        <input type="checkbox" checked={alert} disabled={!canEdit || busy} onChange={(e) => { setAlert(e.target.checked); start(async () => { await setUnknownPlateAlert(e.target.checked); }); }} className="accent-brand-500" />
        <span className="text-[14px]">{m.unknownAlert}</span>
      </label>
      {canEdit && (
        <form action={run} className="grid gap-2 sm:grid-cols-[150px_1fr_auto_auto]">
          <input name="plate" required minLength={4} maxLength={14} placeholder="01A123BC" className="input font-mono uppercase" />
          <input name="note" maxLength={80} placeholder={m.note} className="input" />
          <button name="kind" value="WHITE" disabled={pending} className="btn btn-ghost"><ShieldCheck size={15} /> {m.known}</button>
          <button name="kind" value="BLACK" disabled={pending} className="btn btn-ghost text-bad-soft"><Ban size={15} /> {m.black}</button>
          {state?.error && <p className="err sm:col-span-4">{state.error}</p>}
        </form>
      )}
      {items.length === 0 ? (
        <p className="text-fg-dim">{m.empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {items.map((it) => (
            <li key={it.plate} className="flex items-center gap-3 p-3">
              <span className={cn("chip", it.kind === "BLACK" ? "chip-bad" : "chip-ok")}>{it.kind === "BLACK" ? m.black : m.known}</span>
              <span className="font-mono font-bold">{formatPlate(it.plate)}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg-dim">{it.note}</span>
              {canEdit && <button title={m.remove} disabled={busy} onClick={() => start(async () => { await removePlate(it.plate); })} className="btn btn-ghost !h-9 !w-9 !p-0"><Trash2 size={14} /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Buttons under a plate card: mark the car as known or blacklist it */
export function PlateCardActions({ plate, kind, canEdit }: { plate: string; kind: string | null; canEdit: boolean }) {
  const { f } = useI18n();
  const m = f.more;
  const [k, setK] = useState(kind);
  const [busy, start] = useTransition();
  const set = (v: "WHITE" | "BLACK") =>
    start(async () => {
      const fd = new FormData();
      fd.set("plate", plate);
      fd.set("kind", v);
      const r = await addPlate(undefined, fd);
      if (r?.ok) setK(v);
    });
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <span className={cn("chip", k === "BLACK" ? "chip-bad" : k === "WHITE" ? "chip-ok" : "chip-warn")}>{k === "BLACK" ? m.black : k === "WHITE" ? m.known : m.unknown}</span>
      {canEdit && k !== "WHITE" && <button disabled={busy} onClick={() => set("WHITE")} className="btn btn-ghost btn-sm"><ShieldCheck size={13} /> {m.addKnown}</button>}
      {canEdit && k !== "BLACK" && <button disabled={busy} onClick={() => set("BLACK")} className="btn btn-ghost btn-sm text-bad-soft"><Ban size={13} /> {m.addBlack}</button>}
    </div>
  );
}

/* ───── false alarm ───── */
export function FalseAlarmButton({ id }: { id: string }) {
  const { f } = useI18n();
  const [done, setDone] = useState(false);
  const [busy, start] = useTransition();
  if (done) return <span className="text-[12px] text-ok-soft"><Check size={13} className="inline" /> {f.more.falseDone}</span>;
  return (
    <button title={f.more.falseHint} disabled={busy} onClick={() => start(async () => { const r = await markFalseAlarm(id); if (r?.ok) setDone(true); })} className="btn btn-ghost btn-sm">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <ThumbsDown size={13} />} {f.more.falseAlarm}
    </button>
  );
}

export function SensitivityChip({ cameraId, minConf }: { cameraId: string; minConf: number }) {
  const { f } = useI18n();
  const [v, setV] = useState(minConf);
  const [busy, start] = useTransition();
  if (v <= 0.4) return null;
  return (
    <button title={f.more.resetSens} disabled={busy} onClick={() => start(async () => { await resetSensitivity(cameraId); setV(0.4); })} className="chip chip-warn !h-6 !text-[11px]">
      {f.more.sensitivity} −{Math.round((v - 0.4) * 100)}% ↺
    </button>
  );
}

/* ───── school hours ───── */
export function SchoolTimes({ start, report, end, canEdit }: { start: string; report: string; end: string; canEdit: boolean }) {
  const { f } = useI18n();
  const m = f.more;
  const [state, run, pending] = useActionState<ActionResult, FormData>(saveSchoolTimes, undefined);
  return (
    <form action={run} className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <label><span className="label">{m.schoolStart}</span><input type="time" name="start" defaultValue={start} disabled={!canEdit} className="input" /></label>
        <label><span className="label">{f.x.schoolEnd}</span><input type="time" name="end" defaultValue={end} disabled={!canEdit} className="input" /></label>
        <label><span className="label">{m.absentAt}</span><input type="time" name="report" defaultValue={report} disabled={!canEdit} className="input" /></label>
      </div>
      <p className="text-[12px] text-fg-dim">{m.schoolHint}</p>
      {state?.ok && <p className="text-sm text-ok-soft">{m.saved}</p>}
      {canEdit && <button disabled={pending} className="btn btn-primary">{pending ? <Loader2 size={15} className="animate-spin" /> : m.save}</button>}
    </form>
  );
}

/* ───── daily summary ───── */
export function DailyPanel({ on, canEdit }: { on: boolean; canEdit: boolean }) {
  const { f } = useI18n();
  const [v, setV] = useState(on);
  const [busy, start] = useTransition();
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-fg-muted">{f.more.dailyLead}</p>
      <div className="flex gap-2">
        {[true, false].map((x) => (
          <button key={String(x)} disabled={!canEdit || busy} onClick={() => { setV(x); start(async () => { await setDaily(x); }); }} className={cn("btn btn-sm", v === x ? "btn-primary" : "btn-ghost")}>
            {x ? f.weekly.on : f.weekly.off}
          </button>
        ))}
      </div>
    </div>
  );
}
