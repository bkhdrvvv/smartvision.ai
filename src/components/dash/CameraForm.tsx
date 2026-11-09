"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { addCamera, updateCamera, type ActionResult } from "@/app/actions/customer";
import { useI18n } from "@/lib/i18n/client";

export type CameraDTO = { id: string; name: string; code: string; location: string | null; protocol: string; sourceUrl: string | null; streamUrl: string | null; scene: string };

// "corridor" (school): people staying there during lesson hours are reported (Pro)
const SCENES = ["gate", "classroom", "corridor", "parking", "house", "barn"];

export function AddCameraButton() {
  const { d } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary"><Plus size={15} /> {d.dash.camerasPage.add}</button>
      {open && <CameraDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function EditCameraButton({ cam }: { cam: CameraDTO }) {
  const { d } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg text-fg-dim hover:bg-white/5 hover:text-fg" aria-label={d.dash.camerasPage.edit} title={d.dash.camerasPage.edit}><Pencil size={15} /></button>
      {open && <CameraDialog cam={cam} onClose={() => setOpen(false)} />}
    </>
  );
}

function CameraDialog({ cam, onClose }: { cam?: CameraDTO; onClose: () => void }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<ActionResult, FormData>(cam ? updateCamera : addCamera, undefined);
  const p = d.dash.camerasPage;

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form action={action} className="glass relative my-auto w-full max-w-lg space-y-4 rounded-3xl p-6">
        {cam && <input type="hidden" name="id" value={cam.id} />}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{cam ? p.edit : p.add}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-line-strong" aria-label={d.common.close}><X size={16} /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="label">{p.name}</span><input name="name" required minLength={2} defaultValue={cam?.name} className="input" placeholder="Main gate" /></label>
          <label><span className="label">{p.code}</span><input name="code" required defaultValue={cam?.code} className="input" placeholder="Cam 06" /></label>
          <label><span className="label">{p.location}</span><input name="location" defaultValue={cam?.location ?? ""} className="input" placeholder="Building A" /></label>
          <label>
            <span className="label">{p.protocol}</span>
            <select name="protocol" defaultValue={cam?.protocol ?? "RTSP"} className="input"><option>RTSP</option><option>ONVIF</option></select>
          </label>
        </div>
        <label className="block">
          <span className="label">{p.stream}</span>
          <input name="streamUrl" type="url" defaultValue={cam?.streamUrl ?? ""} className="input font-mono text-[13px]" placeholder="http://192.168.1.10:8888/cam1/index.m3u8" />
          <span className="mt-1 block text-[11px] leading-snug text-fg-dim">{p.streamHint}</span>
        </label>
        <label className="block">
          <span className="label">{p.source}</span>
          <input name="sourceUrl" defaultValue={cam?.sourceUrl ?? ""} className="input font-mono text-[13px]" placeholder="rtsp://192.168.1.20:554/stream1" />
          <span className="mt-1 block text-[11px] text-fg-dim">{p.sourceHint}</span>
        </label>
        <label className="block">
          <span className="label">{p.scene}</span>
          <select name="scene" defaultValue={cam?.scene ?? "gate"} className="input">
            {SCENES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {state?.error && <p className="err" role="alert">{state.error}</p>}
        <button disabled={pending} className="btn btn-primary btn-lg w-full">{pending ? <Loader2 size={16} className="animate-spin" /> : d.common.save}</button>
      </form>
    </div>
  );
}
