"use client";

import { useRef, useState, useTransition } from "react";
import { Eraser, Loader2, Save, Trash2, Undo2 } from "lucide-react";
import { saveZone } from "@/app/actions/features";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";

type P = [number, number];

/** Click on the live picture to draw the forbidden zone (points are stored as 0..1 of the frame). */
export function ZoneEditor({ cameraId, initial, streamUrl, canEdit, field = "zone" }: { cameraId: string; initial: P[] | null; streamUrl: string; canEdit: boolean; field?: "zone" | "pen" }) {
  const { f } = useI18n();
  const z = f.zone;
  const [pts, setPts] = useState<P[]>(initial ?? []);
  const [imgOk, setImgOk] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  const add = (e: React.MouseEvent) => {
    if (!canEdit || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setPts((p) => (p.length >= 20 ? p : [...p, [x, y]]));
    setMsg(null);
  };
  const save = (v: P[] | null) =>
    start(async () => {
      const r = await saveZone(cameraId, v, field);
      setMsg(r?.ok ? z.saved : (r?.error ?? f.common.error));
      if (v === null) setPts([]);
    });

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg-muted">{field === "pen" ? f.x.penLead : z.lead}</p>
      <div ref={box} onClick={add} className="relative aspect-video w-full cursor-crosshair overflow-hidden rounded-2xl border border-line bg-[#05070d]">
        {imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={streamUrl} alt="" onError={() => setImgOk(false)} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(transparent_95%,rgba(255,255,255,.06)_95%),linear-gradient(90deg,transparent_95%,rgba(255,255,255,.06)_95%)] bg-[length:40px_40px] p-6 text-center text-[13px] text-fg-dim">{z.noFrame}</div>
        )}
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          {pts.length >= 3 && <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={field === "pen" ? "rgba(34,197,94,.22)" : "rgba(244,63,94,.28)"} stroke={field === "pen" ? "#22c55e" : "#f43f5e"} strokeWidth={0.004} />}
          {pts.length === 2 && <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#f43f5e" strokeWidth={0.004} />}
        </svg>
        {pts.map((p, i) => (
          <span key={i} className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-500" style={{ left: `${p[0] * 100}%`, top: `${p[1] * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip">{fmt(z.points, { n: pts.length })}</span>
        {canEdit && (
          <>
            <button type="button" disabled={!pts.length} onClick={() => setPts((p) => p.slice(0, -1))} className="btn btn-ghost btn-sm"><Undo2 size={14} /></button>
            <button type="button" disabled={!pts.length} onClick={() => setPts([])} className="btn btn-ghost btn-sm"><Eraser size={14} /> {z.clear}</button>
            <button type="button" disabled={pts.length < 3 || busy} onClick={() => save(pts)} className="btn btn-primary btn-sm">{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {z.save}</button>
            {initial && <button type="button" disabled={busy} onClick={() => save(null)} className="btn btn-ghost btn-sm text-bad-soft"><Trash2 size={14} /> {z.remove}</button>}
          </>
        )}
      </div>
      {msg && <p className="text-sm text-ok-soft">{msg}</p>}
    </div>
  );
}
