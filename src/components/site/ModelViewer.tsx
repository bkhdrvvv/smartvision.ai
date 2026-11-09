"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, RotateCw } from "lucide-react";
import { Scene3D } from "@/components/three/Scene3D";
import type { ViewerModel } from "@/components/three/scenes/ViewerScene";
import { cn } from "@/lib/format";

const ViewerScene = dynamic(() => import("@/components/three/scenes/ViewerScene"), { ssr: false });
const ANGLE_KEYS = ["iso", "front", "side", "top"] as const;

/** Interactive 360° viewer: drag / touch rotate, wheel / pinch zoom, preset angles, fullscreen */
export function ModelViewer({ models, labels, className }: { models: { id: ViewerModel; label: string }[]; labels: { angles: Record<(typeof ANGLE_KEYS)[number], string>; hint: string }; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState(models[0]!.id);
  const [angle, setAngle] = useState<(typeof ANGLE_KEYS)[number]>("iso");
  const [auto, setAuto] = useState(true);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : wrap.current?.requestFullscreen?.());

  return (
    <div ref={wrap} className={cn("card relative overflow-hidden !rounded-[28px] bg-[radial-gradient(60%_60%_at_50%_70%,rgba(37,99,235,.3),transparent_70%),#070c1b]", fs ? "!rounded-none" : "", className)}>
      <Scene3D eager className={cn("touch-none", fs ? "h-screen" : "h-[460px] md:h-[560px]")} camera={{ position: [6, 4, 6.5], fov: 34 }}>
        <ViewerScene model={model} angle={angle} autoRotate={auto} />
      </Scene3D>
      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
        {models.map((m) => (
          <button key={m.id} onClick={() => setModel(m.id)} className={cn("chip", model === m.id && "chip-blue")}>{m.label}</button>
        ))}
      </div>
      <div className="absolute right-4 top-4 flex gap-2">
        <button onClick={() => setAuto((a) => !a)} className={cn("grid h-9 w-9 place-items-center rounded-lg border border-line-strong bg-ink-900/70", auto && "text-brand-400")} aria-label="Auto rotate"><RotateCw size={15} /></button>
        <button onClick={toggleFs} className="grid h-9 w-9 place-items-center rounded-lg border border-line-strong bg-ink-900/70" aria-label="Fullscreen">{fs ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
      </div>
      <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-2">
        <div className="glass flex rounded-xl p-1">
          {ANGLE_KEYS.map((a) => (
            <button key={a} onClick={() => setAngle(a)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", angle === a ? "bg-brand-500/20 text-fg" : "text-fg-muted")}>{labels.angles[a]}</button>
          ))}
        </div>
        <span className="text-[11px] text-fg-dim">{labels.hint}</span>
      </div>
    </div>
  );
}
