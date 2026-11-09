"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Maximize2, Minimize2, Pause, Play, RotateCcw, RotateCw, Settings2, ZoomIn, ZoomOut } from "lucide-react";
import { StreamPlayer, type PlayerHandle, type Quality, type StreamState } from "./StreamPlayer";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

const STEP = 10;
const MAX_ZOOM = 4;

/**
 * Camera stream with a DVR-style control bar:
 *  ⏪10s · ⏯ · 10s⏩ · LIVE badge · zoom − / + (drag to pan, wheel to zoom) · quality · snapshot · fullscreen
 */
export function CameraPlayer({
  src, name, onState, compact, liveOnly, sourceToggle,
}: {
  src: string; name: string; onState?: (s: StreamState) => void; compact?: boolean;
  /** relay streams are live-only: no replay buffer / quality levels */
  liveOnly?: boolean;
  /** optional LAN ⇄ relay switch rendered in the bar */
  sourceToggle?: React.ReactNode;
}) {
  const { d } = useI18n();
  const p = d.dash.player;
  const wrap = useRef<HTMLDivElement>(null);
  const player = useRef<PlayerHandle>(null);
  const [paused, setPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [delay, setDelay] = useState(0);
  const [quality, setQuality] = useState<Quality>("auto");
  const [qOpen, setQOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fs, setFs] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const on = () => setFs(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const maxDelay = () => player.current?.maxDelay() ?? 115;
  const seek = (dir: -1 | 1) => setDelay((v) => Math.max(0, Math.min(maxDelay(), v - dir * STEP)));
  const togglePause = () => {
    if (paused) {
      // resume where we paused: everything that happened meanwhile is replayed from the buffer
      const behind = pausedAt ? (Date.now() - pausedAt) / 1000 : 0;
      setDelay((v) => Math.min(maxDelay(), v + behind));
      setPausedAt(null);
      setPaused(false);
    } else {
      setPausedAt(Date.now());
      setPaused(true);
    }
  };
  const clampZoom = (z: number) => Math.max(1, Math.min(MAX_ZOOM, Math.round(z * 4) / 4));
  /** functional update so fast repeated clicks / wheel ticks all count */
  const changeZoom = (f: (z: number) => number) =>
    setZoom((z) => {
      const nz = clampZoom(f(z));
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });
  const setZoomClamped = (z: number) => changeZoom(() => z);
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : wrap.current?.requestFullscreen());
  const snapshot = () => {
    const data = player.current?.capture();
    if (!data) return;
    const a = document.createElement("a");
    a.href = data;
    a.download = `${name.replace(/\W+/g, "_")}-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
    a.click();
  };

  const live = delay < 1 && !paused;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div ref={wrap} className={cn("absolute inset-0 overflow-hidden bg-black", fs && "rounded-none")}>
      {/* zoom / pan surface */}
      <div
        className={cn("absolute inset-0", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "")}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: drag.current ? "none" : "transform .2s ease-out" }}
        onWheel={(e) => {
          if (!e.ctrlKey && !fs && zoom === 1 && e.deltaY > 0) return; // let the page scroll normally
          e.preventDefault();
          changeZoom((z) => z * (e.deltaY < 0 ? 1.25 : 0.8));
        }}
        onPointerDown={(e) => {
          if (zoom === 1) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const r = wrap.current!.getBoundingClientRect();
          const lim = { x: (r.width * (zoom - 1)) / 2, y: (r.height * (zoom - 1)) / 2 };
          setPan({
            x: Math.max(-lim.x, Math.min(lim.x, drag.current.px + e.clientX - drag.current.x)),
            y: Math.max(-lim.y, Math.min(lim.y, drag.current.py + e.clientY - drag.current.y)),
          });
        }}
        onPointerUp={() => (drag.current = null)}
        onDoubleClick={(e) => {
          stop(e);
          setZoomClamped(zoom > 1 ? 1 : 2);
        }}
      >
        <StreamPlayer ref={player} src={src} paused={paused} delay={liveOnly ? 0 : delay} quality={liveOnly ? "auto" : quality} onState={onState} className="h-full w-full select-none object-contain" />
      </div>

      {/* status badge */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
        {paused ? (
          <span className="chip chip-warn !rounded-lg bg-ink-950/85">{p.paused}</span>
        ) : !live ? (
          <span className="chip chip-violet !rounded-lg bg-ink-950/85">−{Math.round(delay)} {p.sec}</span>
        ) : null}
      </div>

      {/* control bar */}
      <div onClick={stop} onDoubleClick={stop} className={cn("absolute inset-x-2 bottom-2 z-20 flex flex-wrap items-center gap-1 rounded-xl bg-ink-950/80 p-1 backdrop-blur transition-opacity", compact ? "opacity-0 group-hover:opacity-100" : "opacity-100")}>
        {!liveOnly && <Btn onClick={() => seek(-1)} label={p.back}><RotateCcw size={15} /><span className="ml-0.5 text-[10px] font-bold">10</span></Btn>}
        <Btn onClick={togglePause} label={paused ? p.play : p.pause}>{paused ? <Play size={15} /> : <Pause size={15} />}</Btn>
        {!liveOnly && <Btn onClick={() => seek(1)} label={p.forward} disabled={live}><span className="mr-0.5 text-[10px] font-bold">10</span><RotateCw size={15} /></Btn>}
        <button
          onClick={() => {
            setDelay(0);
            setPaused(false);
            setPausedAt(null);
          }}
          className={cn("ml-1 flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-bold uppercase", live ? "text-bad-soft" : "text-fg-muted hover:bg-white/10")}
          title={p.goLive}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-bad" : "bg-fg-dim")} /> {d.common.live}
        </button>
        {sourceToggle}
        <span className="flex-1" />
        <Btn onClick={() => changeZoom((z) => z / 1.25)} label={p.zoomOut} disabled={zoom <= 1}><ZoomOut size={15} /></Btn>
        <button onClick={() => setZoomClamped(1)} className="h-8 min-w-11 rounded-lg px-1 text-[11px] font-semibold text-fg-muted hover:bg-white/10" title={p.zoomReset}>{Math.round(zoom * 100)}%</button>
        <Btn onClick={() => changeZoom((z) => z * 1.25)} label={p.zoomIn} disabled={zoom >= MAX_ZOOM}><ZoomIn size={15} /></Btn>
        <div className={cn("relative", liveOnly && "hidden")}>
          <Btn onClick={() => setQOpen((o) => !o)} label={p.quality}>
            <Settings2 size={15} />
            <span className="ml-1 text-[10px] font-bold uppercase">{quality === "auto" ? "Auto" : quality === "high" ? "HD" : quality === "medium" ? "SD" : "LD"}</span>
          </Btn>
          {qOpen && (
            <div className="glass absolute bottom-10 right-0 w-36 rounded-xl p-1">
              {(["auto", "high", "medium", "low"] as Quality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setQuality(q);
                    setQOpen(false);
                  }}
                  className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] hover:bg-white/5", q === quality && "text-brand-400")}
                >
                  {p.q[q]}
                  {q === quality && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <Btn onClick={snapshot} label={p.snapshot}><Camera size={15} /></Btn>
        <Btn onClick={fullscreen} label={p.fullscreen}>{fs ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</Btn>
      </div>
    </div>
  );
}

function Btn({ children, onClick, label, disabled }: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label} className="flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-fg hover:bg-white/10 disabled:opacity-35">
      {children}
    </button>
  );
}
