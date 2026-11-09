"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Check, Copy, ImagePlus, Loader2, Trash2, UserPlus } from "lucide-react";
import { addStudent, removeStudent } from "@/app/actions/features";
import type { ActionResult } from "@/app/actions/customer";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/format";

export type StudentRow = { id: string; name: string; group: string | null; photo: boolean; parents: number; link: string | null; came: string | null; left: string | null; late?: boolean };

export function AddStudentForm({ canEdit, teachers = false }: { canEdit: boolean; teachers?: boolean }) {
  const { f } = useI18n();
  const s = f.students;
  const [state, run, pending] = useActionState<ActionResult, FormData>(async (p, fd) => {
    const r = await addStudent(p, fd);
    if (r?.ok) {
      formRef.current?.reset();
      setPreview(null);
    }
    return r;
  }, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  if (!canEdit) return null;
  return (
    <form ref={formRef} action={run} className="grid gap-3 sm:grid-cols-[96px_1fr]">
      <label className="grid h-24 w-24 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-line-strong bg-white/[.03] text-fg-dim hover:text-fg">
        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={22} />}
        <input name="photo" type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; setPreview(file ? URL.createObjectURL(file) : null); }} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <label><span className="label">{s.name}</span><input name="name" required minLength={2} maxLength={80} className="input" /></label>
        <label><span className="label">{s.group}</span><input name="group" maxLength={20} placeholder="7-B" className="input" /></label>
        {teachers && (
          <label className="sm:col-span-2">
            <span className="label">{f.x.kindLabel}</span>
            <select name="kind" className="input" defaultValue="STUDENT">
              <option value="STUDENT">{f.x.kinds.STUDENT}</option>
              <option value="TEACHER">{f.x.kinds.TEACHER}</option>
            </select>
          </label>
        )}
        <p className="text-[12px] text-fg-dim sm:col-span-2">{s.photo}</p>
        {state?.error && <p className="err sm:col-span-2">{state.error}</p>}
        <button disabled={pending} className="btn btn-primary sm:col-span-2 sm:justify-self-start">{pending ? <Loader2 size={15} className="animate-spin" /> : <><UserPlus size={15} /> {s.save}</>}</button>
      </div>
    </form>
  );
}

export function StudentList({ rows, canEdit }: { rows: StudentRow[]; canEdit: boolean }) {
  const { f } = useI18n();
  const s = f.students;
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, start] = useTransition();
  if (!rows.length) return <p className="py-6 text-center text-fg-dim">{s.empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5">
            {r.photo ? <img src={`/api/students/${r.id}/photo`} alt="" className="h-full w-full object-cover" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{r.name} {r.group && <span className="text-fg-dim">· {r.group}</span>}</div>
            <div className="text-[12px] text-fg-dim">{r.photo ? `${r.parents} ${s.parents}` : s.noPhoto}</div>
          </div>
          {r.late && <span className="chip chip-warn">{f.more.late}</span>}
          <span className={cn("chip", r.came ? "chip-ok" : "chip-warn")}>{r.came ? `${s.came} ${r.came}${r.left && r.left !== r.came ? ` → ${r.left}` : ""}` : s.absent}</span>
          {r.link && (
            <button
              title={s.parentHint}
              onClick={() => { navigator.clipboard?.writeText(r.link!); setCopied(r.id); setTimeout(() => setCopied(null), 1500); }}
              className="btn btn-ghost btn-sm"
            >
              {copied === r.id ? <Check size={14} /> : <Copy size={14} />} {copied === r.id ? s.copied : s.parent}
            </button>
          )}
          {canEdit && <button title={s.remove} disabled={busy} onClick={() => start(async () => { await removeStudent(r.id); })} className="btn btn-ghost !h-9 !w-9 !p-0"><Trash2 size={14} /></button>}
        </li>
      ))}
    </ul>
  );
}

export function AttendanceStats({ present, total }: { present: number; total: number }) {
  const { f } = useI18n();
  return <span className="chip chip-blue">{fmt(f.students.stats, { a: present, t: total })}</span>;
}
