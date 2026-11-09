"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { View } from "@react-three/drei";
import { motion } from "framer-motion";
import { Activity, ArrowRight, Camera, ChevronDown, Expand, Filter, Globe, LayoutGrid, Layers, MapPin, Maximize, Pause, Play, ScanFace, VideoOff, Wifi, WifiOff } from "lucide-react";
import { isMjpeg, type StreamState } from "./StreamPlayer";
import { CameraPlayer } from "./CameraPlayer";
import { NightVisionControl } from "./NightVisionControl";
import { LiveScene, type SceneKind } from "@/components/three/scenes/LiveScenes";
import { useWebGL } from "@/components/three/hooks";
import { Silhouette } from "@/components/ui/Silhouette";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/format";

export type LiveCam = {
  id: string; code: string; name: string; location: string | null; status: "ONLINE" | "WEAK" | "OFFLINE";
  fps: number; resolution: string; protocol: string; scene: SceneKind; streamUrl: string | null; capacity: number | null; lastSeenAt: string | null;
  nightMode: "auto" | "on" | "off"; nightActive: boolean;
  stats: { entered: number; exited: number; avgConf: number | null; occupancy: number | null };
};
export type LiveEvent = { id: string; type: string; at: string; camera: string; trackId: string | null; confidence: number | null; value: number | null; severity: string; snap?: boolean };

const DOT: Record<string, string> = { INFO: "#5b9dff", WARNING: "#f59e0b", CRITICAL: "#ef4444" };

function useClock(paused: boolean) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    if (paused) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [paused]);
  return now;
}
const stamp = (d: Date | null) => (d ? `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}` : "");

export function LiveWall({ cams, initialEvents, initialFaces = [], demo, orgId, nightAllowed = false }: { cams: LiveCam[]; initialEvents: LiveEvent[]; initialFaces?: LiveEvent[]; demo: boolean; /** admin watching a customer */ orgId?: string; /** the plan includes Night Vision (Pro) */ nightAllowed?: boolean }) {
  const { d } = useI18n();
  const wall = useRef<HTMLDivElement>(null);
  const webgl = useWebGL();
  const [layout, setLayout] = useState<"focus" | "grid">("focus");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [loc, setLoc] = useState<string>("");
  const [selected, setSelected] = useState(cams[0]?.id ?? "");
  const [overlay, setOverlay] = useState(true);
  const [paused, setPaused] = useState<Record<string, boolean>>({});
  const [events, setEvents] = useState(initialEvents);
  const [faces, setFaces] = useState(initialFaces);
  const [zoomFace, setZoomFace] = useState<LiveEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const locations = useMemo(() => [...new Set(cams.map((c) => c.location).filter(Boolean))] as string[], [cams]);
  const visible = cams.filter((c) => (!onlineOnly || c.status !== "OFFLINE") && (!loc || c.location === loc));
  const ordered = layout === "focus" ? [...visible].sort((a, b) => (a.id === selected ? -1 : b.id === selected ? 1 : 0)) : visible;
  const sel = cams.find((c) => c.id === selected) ?? cams[0];
  const liveCount = cams.filter((c) => c.status !== "OFFLINE").length;

  // poll the real event stream (Edge → API → DB)
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const after = events[0]?.at ?? new Date(0).toISOString();
        const r = await fetch(`/api/events/recent?after=${encodeURIComponent(after)}${orgId ? `&org=${encodeURIComponent(orgId)}` : ""}`, { cache: "no-store" });
        if (!r.ok) return;
        const j: { events: LiveEvent[] } = await r.json();
        if (j.events.length) {
          setEvents((prev) => [...j.events, ...prev].slice(0, 30));
          const withSnap = j.events.filter((e) => e.snap);
          if (withSnap.length)
            setFaces((prev) => {
              // one picture per tracked person; newest first
              const out: LiveEvent[] = [];
              const keys = new Set<string>();
              for (const f of [...withSnap, ...prev]) {
                const k = f.trackId ? `${f.camera}:${f.trackId}` : f.id;
                if (keys.has(k)) continue;
                keys.add(k);
                out.push(f);
              }
              return out.slice(0, 12);
            });
        }
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [events]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const snapshot = useCallback(
    (camId: string) => {
      const tile = document.getElementById(`tile-${camId}`);
      const canvas = wall.current?.querySelector("canvas");
      const video = tile?.querySelector("video") ?? tile?.querySelector("img");
      if (!tile) return;
      const rect = tile.getBoundingClientRect();
      const out = document.createElement("canvas");
      out.width = rect.width * devicePixelRatio;
      out.height = rect.height * devicePixelRatio;
      const ctx = out.getContext("2d")!;
      if (video) ctx.drawImage(video, 0, 0, out.width, out.height);
      else if (canvas) {
        const cr = canvas.getBoundingClientRect();
        const sx = canvas.width / cr.width;
        ctx.drawImage(canvas, (rect.left - cr.left) * sx, (rect.top - cr.top) * sx, rect.width * sx, rect.height * sx, 0, 0, out.width, out.height);
      }
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(0, out.height - 34 * devicePixelRatio, out.width, 34 * devicePixelRatio);
      ctx.fillStyle = "#fff";
      ctx.font = `${13 * devicePixelRatio}px monospace`;
      ctx.fillText(`${cams.find((c) => c.id === camId)?.name} · ${stamp(new Date())}`, 10 * devicePixelRatio, out.height - 12 * devicePixelRatio);
      const a = document.createElement("a");
      a.href = out.toDataURL("image/png");
      a.download = `snapshot-${camId}-${Date.now()}.png`;
      a.click();
      flash(d.dash.live.snapshot);
    },
    [cams, d],
  );

  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : wall.current?.requestFullscreen());

  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line-strong bg-ink-850 p-1">
          <button onClick={() => setLayout("focus")} className={cn("grid h-9 w-10 place-items-center rounded-lg", layout === "focus" ? "bg-brand-500/25 text-brand-300" : "text-fg-muted")} aria-label="Focus layout"><Expand size={16} /></button>
          <button onClick={() => setLayout("grid")} className={cn("grid h-9 w-10 place-items-center rounded-lg", layout === "grid" ? "bg-brand-500/25 text-brand-300" : "text-fg-muted")} aria-label="Grid layout"><LayoutGrid size={16} /></button>
          <button onClick={() => setOverlay((o) => !o)} className={cn("grid h-9 w-10 place-items-center rounded-lg", overlay ? "text-brand-300" : "text-fg-muted")} aria-label="AI overlay" title={overlay ? d.dash.live.aiOverlay : d.dash.live.aiOverlayOff}><Layers size={16} /></button>
        </div>
        <label className="relative">
          <MapPin size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          <select value={loc} onChange={(e) => setLoc(e.target.value)} className="input !h-11 !w-auto appearance-none !rounded-xl !pl-10 !pr-9">
            <option value="">{d.dash.live.allLocations}</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted" />
        </label>
        <button onClick={() => setOnlineOnly((o) => !o)} className={cn("btn btn-ghost !h-11 !rounded-xl", onlineOnly && "!border-brand-400/50 text-brand-300")}>
          <Filter size={15} /> {onlineOnly ? d.dash.live.onlineOnly : d.dash.live.allCameras}
        </button>
        {demo && <span className="chip chip-demo">{d.common.demoMode}</span>}
        <span className="ml-auto hidden text-[14px] text-fg-dim xl:block">{fmt(d.dash.live.liveCount, { n: liveCount, m: cams.length })}</span>
        <button onClick={fullscreen} className="btn btn-ghost !h-11 !rounded-xl"><Maximize size={15} /> {d.dash.live.fullscreen}</button>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1fr_400px]">
        <div ref={wall} className="relative bg-ink-900">
          <div className={cn("grid gap-4", layout === "focus" ? "md:grid-cols-[1.9fr_1fr] xl:grid-cols-[1.9fr_1fr]" : "sm:grid-cols-2 xl:grid-cols-3")}>
            {ordered.map((c, i) => (
              <Tile
                key={c.id}
                cam={c}
                big={layout === "focus" && i === 0}
                className={layout === "focus" && i === 0 ? "md:row-span-2" : ""}
                selected={c.id === selected}
                overlay={overlay}
                paused={!!paused[c.id]}
                webgl={webgl !== false}
                demo={demo}
                onSelect={() => setSelected(c.id)}
                onPause={() => setPaused((p) => ({ ...p, [c.id]: !p[c.id] }))}
                onSnapshot={() => snapshot(c.id)}
                nightAllowed={nightAllowed}
              />
            ))}
          </div>
          {webgl && (
            <Canvas
              eventSource={wall as React.RefObject<HTMLElement>}
              style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}
              gl={{ preserveDrawingBuffer: true, antialias: true }}
              dpr={[1, 1.5]}
            >
              <View.Port />
            </Canvas>
          )}
          {toast && <div className="glass absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-xl px-4 py-2 text-sm">{toast}</div>}
        </div>

        {/* right column */}
        <div className="space-y-5">
          {sel && (
            <section className="card !rounded-[20px] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[18px] font-bold">{sel.name} · {sel.code}</h2>
                  <div className="text-[13px] text-fg-dim">{sel.protocol} · {sel.resolution} · {sel.fps} fps</div>
                </div>
                <span className={cn("chip", sel.status === "ONLINE" ? "chip-ok" : sel.status === "WEAK" ? "chip-warn" : "chip-bad")}>{sel.status === "ONLINE" ? d.common.online : sel.status === "WEAK" ? d.common.weak : d.common.offline}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat v={sel.stats.entered} l={d.dash.live.enteredToday} />
                <Stat v={sel.stats.exited} l={d.dash.live.exitedToday} />
                <Stat v={sel.stats.occupancy ?? (demo && sel.status !== "OFFLINE" ? peopleFor(sel.scene) : "—")} l={d.dash.live.peopleInView} />
                <Stat v={sel.stats.avgConf != null ? sel.stats.avgConf.toFixed(2) : "—"} l={d.dash.live.avgConfidence} />
              </div>
            </section>
          )}
          {faces.length > 0 && (
            <section className="card !rounded-[20px] p-5">
              <h2 className="mb-4 text-[18px] font-bold">{d.dash.player.faces}</h2>
              <div className="grid grid-cols-4 gap-2">
                {faces.slice(0, 12).map((f) => (
                  <button key={f.id} onClick={() => setZoomFace(f)} className="group relative aspect-square overflow-hidden rounded-xl border border-line-strong bg-ink-850" title={`${f.camera} · ${new Date(f.at).toTimeString().slice(0, 8)}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/events/${f.id}/snapshot`} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-110" />
                    <span className="absolute inset-x-0 bottom-0 bg-ink-950/80 px-1 py-0.5 text-center font-mono text-[10px]">{f.trackId ?? new Date(f.at).toTimeString().slice(0, 5)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {zoomFace && (
            <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-6 backdrop-blur-sm" onClick={() => setZoomFace(null)}>
              <div className="glass w-full max-w-sm rounded-3xl p-4" onClick={(e) => e.stopPropagation()}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/events/${zoomFace.id}/snapshot`} alt="" className="w-full rounded-2xl object-contain" />
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold">{d.dash.eventTitles[zoomFace.type as keyof typeof d.dash.eventTitles]} {zoomFace.trackId ? `· ID ${zoomFace.trackId}` : ""}</div>
                    <div className="text-fg-dim">{zoomFace.camera} · {new Date(zoomFace.at).toLocaleString()} {zoomFace.confidence != null ? `· ${zoomFace.confidence.toFixed(2)}` : ""}</div>
                  </div>
                  <a href={`/api/events/${zoomFace.id}/snapshot`} download className="btn btn-ghost btn-sm"><Camera size={14} /></a>
                </div>
              </div>
            </div>
          )}
          <section className="card !rounded-[20px] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold">{d.dash.live.eventStream}</h2>
              <span className="chip chip-blue"><span className="dot dot-live !bg-brand-400" /> {d.common.live}</span>
            </div>
            <ol className="relative max-h-[460px] space-y-0 overflow-y-auto scrollbar-thin">
              {events.slice(0, 12).map((e, i) => (
                <motion.li key={e.id} initial={i === 0 ? { opacity: 0, x: 10 } : false} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-[14px_52px_1fr] gap-3 border-b border-line py-3.5 last:border-0">
                  <span className="mt-1.5 h-2 w-2 rounded-full" style={{ background: DOT[e.severity] ?? "#5b9dff", boxShadow: `0 0 8px ${DOT[e.severity]}` }} />
                  <span className="font-mono text-[13px] text-fg-dim">{new Date(e.at).toTimeString().slice(0, 5)}</span>
                  <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{d.dash.eventTitles[e.type as keyof typeof d.dash.eventTitles] ?? e.type}</div>
                    <div className="text-[13px] text-fg-dim">
                      {e.camera}
                      {e.trackId ? ` · ID ${e.trackId}` : e.value != null ? ` · ${e.value}` : e.confidence != null ? ` · ${e.confidence.toFixed(2)}` : ""}
                    </div>
                  </div>
                  {e.snap && (
                    <button onClick={() => setZoomFace(e)} className="shrink-0 overflow-hidden rounded-lg border border-line-strong">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/events/${e.id}/snapshot`} alt="" loading="lazy" className="h-11 w-11 object-cover" />
                    </button>
                  )}
                  </div>
                </motion.li>
              ))}
              {events.length === 0 && <li className="py-6 text-sm text-fg-dim">{d.common.noData}</li>}
            </ol>
            <Link href="/dashboard/events" className="btn btn-ghost mt-4 w-full">{d.dash.live.openEvents} <ArrowRight size={14} /></Link>
          </section>
        </div>
      </div>
    </div>
  );
}

function peopleFor(s: SceneKind) {
  return { gate: 3, classroom: 4, parking: 0, house: 1, barn: 0 }[s];
}

function Stat({ v, l }: { v: React.ReactNode; l: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink-850/70 p-4">
      <div className="font-display text-[28px] font-extrabold leading-none">{v}</div>
      <div className="mt-1.5 text-[13px] text-fg-dim">{l}</div>
    </div>
  );
}

type TileProps = { cam: LiveCam; big: boolean; className?: string; selected: boolean; overlay: boolean; paused: boolean; webgl: boolean; demo: boolean; onSelect: () => void; onPause: () => void; onSnapshot: () => void; nightAllowed: boolean };

function Tile({ cam, big, className, selected, overlay, paused, webgl, demo, onSelect, onPause, onSnapshot, nightAllowed }: TileProps) {
  const { d } = useI18n();
  const [stream, setStream] = useState<StreamState>("loading");
  // Edge-agent cameras can be watched directly on the site's Wi-Fi (fast, with replay) or via the platform relay
  const edgeCam = !!cam.streamUrl && isMjpeg(cam.streamUrl);
  const [source, setSource] = useState<"lan" | "relay">("lan");
  useEffect(() => {
    // opened from outside the camera's network (public host / phone on mobile data) → start with the relay
    const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname);
    if (edgeCam && !local) setSource("relay");
  }, [edgeCam]);
  const onStreamState = (st: StreamState) => {
    setStream(st);
    // direct Wi-Fi stream unreachable (viewer is not on the site's network) → fall back to the relay once
    if (st === "error" && edgeCam && source === "lan") setSource("relay");
  };
  const [diag, setDiag] = useState<string | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  // A camera with a browser stream is judged by the stream itself; otherwise by the Edge heartbeat status.
  const offline = cam.streamUrl ? stream === "error" : cam.status === "OFFLINE";
  const simulated = !cam.streamUrl && demo;
  const noVideo = !cam.streamUrl && !demo && !offline;
  const now = useClock(paused || offline || noVideo);
  const night = cam.scene === "house";

  const runDiag = async () => {
    setDiagBusy(true);
    try {
      const r = await fetch(`/api/cameras/${cam.id}/diagnostics`, { method: "POST" });
      const j = await r.json();
      setDiag(j.message ?? d.common.error);
    } catch {
      setDiag(d.common.error);
    }
    setDiagBusy(false);
  };

  return (
    <div
      id={`tile-${cam.id}`}
      onClick={onSelect}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-[18px] border bg-[linear-gradient(180deg,#5b6273,#2a2f3b)] transition-shadow",
        big ? "aspect-[4/3] md:aspect-auto md:min-h-[520px]" : "aspect-[16/11]",
        offline && "!bg-[#07090f]",
        selected ? "border-brand-400/60 shadow-[0_0_0_1px_rgba(91,157,255,.4),0_20px_60px_-30px_rgba(59,130,246,.8)]" : "border-line-strong",
        className,
      )}
    >
      {/* video or simulated scene */}
      {cam.streamUrl ? (
        // real stream: DVR player (±10 s, pause, zoom, quality, fullscreen); object-contain so AI boxes are never cropped
        <div className={cn("absolute inset-0", offline && "hidden")}>
          <CameraPlayer
            key={source}
            src={source === "relay" ? `/api/cameras/${cam.id}/stream` : cam.streamUrl}
            name={cam.name}
            onState={onStreamState}
            compact={!big}
            liveOnly={source === "relay"}
            sourceToggle={
              edgeCam ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSource((s) => (s === "relay" ? "lan" : "relay"));
                  }}
                  title={d.dash.player.sourceHint}
                  className="ml-1 flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold uppercase text-fg-muted hover:bg-white/10"
                >
                  {source === "relay" ? <><Globe size={13} /> Relay</> : <><Wifi size={13} /> Wi-Fi</>}
                </button>
              ) : null
            }
          />
        </div>
      ) : simulated && cam.status !== "OFFLINE" && webgl ? (
        <View className="absolute inset-0">
          <LiveScene kind={cam.scene} paused={paused} night={night} />
        </View>
      ) : null}
      {!offline && simulated && <div className="pointer-events-none absolute inset-0 z-[2] bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.025)_0_1px,transparent_1px_3px)]" />}
      {/* the "weak signal" blur is only a simulation effect — never degrade a real stream */}
      {cam.status === "WEAK" && simulated && <div className="pointer-events-none absolute inset-0 z-[2] backdrop-blur-[1.5px] backdrop-grayscale" />}

      {/* top bar */}
      <div className="absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 rounded-lg bg-ink-950/75 px-3 py-1.5 text-[13px] font-semibold backdrop-blur">
          <span className={cn("dot", offline ? "!bg-bad" : "dot-live")} /> {cam.name} · {cam.code}
        </span>
        {offline ? (
          <span className="chip chip-bad !rounded-lg">{d.common.offline}</span>
        ) : (
          <span className={cn("chip chip-bad !rounded-lg uppercase", cam.status === "WEAK" && "opacity-60")}><span className="h-1.5 w-1.5 rounded-full bg-bad" /> {paused ? d.dash.live.paused : d.common.live}</span>
        )}
      </div>

      {noVideo ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#07090f] p-4 text-center">
          <div>
            <VideoOff size={28} className="mx-auto text-fg-dim" />
            <div className="mt-3 text-[15px] font-bold">{d.dash.live.noStream}</div>
            <div className="mx-auto mt-1 max-w-[260px] text-[12px] text-fg-muted">{d.dash.live.noStreamHint}</div>
            <Link href="/dashboard/cameras" onClick={(e) => e.stopPropagation()} className="btn btn-ghost btn-sm mt-3">{d.dash.camerasPage.edit}</Link>
          </div>
        </div>
      ) : offline ? (
        <div className="absolute inset-0 z-10 grid place-items-center p-4 text-center">
          <div>
            <WifiOff size={30} className="mx-auto text-bad-soft" />
            <div className="mt-3 text-[16px] font-bold">{d.dash.live.connectionLost}</div>
            <div className="mt-1 text-[13px] text-fg-muted">{diag ?? d.dash.live.cantReach}</div>
            <button onClick={(e) => { e.stopPropagation(); runDiag(); }} disabled={diagBusy} className="btn btn-ghost mt-4"><Activity size={15} /> {diagBusy ? d.dash.live.diagRunning : d.dash.live.diagnostics}</button>
          </div>
          {cam.lastSeenAt && <span className="absolute bottom-3 left-3 rounded-lg bg-ink-800 px-3 py-1.5 text-[12px] text-fg-muted">{fmt(d.dash.live.lastFrame, { t: new Date(cam.lastSeenAt).toTimeString().slice(0, 5) })}</span>}
        </div>
      ) : (
        <>
          {overlay && simulated && <Overlays cam={cam} big={big} paused={paused} />}
          {cam.status === "WEAK" && simulated && <span className="chip chip-warn absolute left-1/2 top-14 z-10 -translate-x-1/2 bg-ink-950/80">{d.common.weak} · {cam.fps} fps</span>}
          {!cam.streamUrl && (<>
          <span className="absolute bottom-14 right-4 z-10 font-mono text-[13px] text-white/90 [text-shadow:0_1px_2px_#000]">{stamp(now)}</span>
          <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-2">
            {simulated ? (
              <span className="chip !h-8 bg-ink-950/75 text-brand-300 backdrop-blur"><ScanFace size={13} /> {overlay ? d.dash.live.aiOverlay : d.dash.live.aiOverlayOff}</span>
            ) : (
              <span className={cn("chip !h-8 bg-ink-950/75 backdrop-blur", cam.streamUrl && isMjpeg(cam.streamUrl) && "text-brand-300")}>
                {cam.streamUrl && isMjpeg(cam.streamUrl) ? <><ScanFace size={13} /> Edge AI</> : cam.streamUrl && /\.m3u8/i.test(cam.streamUrl) ? "HLS" : "Video"}
              </span>
            )}
            <div className="flex gap-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              {big && (
                <>
                  <IconBtn onClick={onSnapshot} label="Snapshot"><Camera size={15} /></IconBtn>
                  <IconBtn onClick={onPause} label="Pause">{paused ? <Play size={15} /> : <Pause size={15} />}</IconBtn>
                </>
              )}
              <IconBtn onClick={onSelect} label="Focus"><Expand size={15} /></IconBtn>
            </div>
          </div>
          </>)}
          {cam.streamUrl && isMjpeg(cam.streamUrl) && (
            <div className="absolute right-3 top-12 z-20 flex flex-col items-end gap-1.5">
              <span className="chip !h-7 bg-ink-950/75 text-brand-300 backdrop-blur"><ScanFace size={13} /> Edge AI</span>
              {/* Night Vision (Pro): Auto / On / Off; glows green while the agent is brightening the picture */}
              <NightVisionControl cameraId={cam.id} mode={cam.nightMode} active={cam.nightActive} allowed={nightAllowed} canEdit />
            </div>
          )}
          {cam.streamUrl && stream === "loading" && <span className="absolute inset-0 z-[3] grid place-items-center text-sm text-fg-muted">{d.common.loading}</span>}
          {simulated && big && <span className="absolute bottom-14 left-4 z-10 max-w-[60%] text-[11px] text-white/60">{d.dash.live.simulated}</span>}
        </>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} className="grid h-9 w-9 place-items-center rounded-lg bg-ink-950/80 text-fg backdrop-blur hover:bg-ink-800">
      {children}
    </button>
  );
}

/** Simulated AI detections that drift like tracked objects */
function Overlays({ cam, big, paused }: { cam: LiveCam; big: boolean; paused: boolean }) {
  const { d } = useI18n();
  const [t, setT] = useState(0);
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    const start = performance.now() - t * 1000;
    const loop = () => {
      setT((performance.now() - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cam.scene === "classroom") {
    const occ = cam.stats.occupancy ?? (cam.capacity ? Math.round(cam.capacity * 0.73) : 0);
    const empty = cam.name.includes("3B");
    return (
      <>
        <span className="chip absolute right-4 top-14 z-10 bg-ink-950/80 text-ok-soft">{empty ? `Empty · 0 / ${cam.capacity ?? 30}` : `${d.solutions.tags.occupancy} ${occ} / ${cam.capacity ?? 30}`}</span>
        {!empty &&
          [[20, 38], [47, 34], [56, 46], [24, 58]].map(([x, y], i) => (
            <div key={i} className="absolute z-10 h-[18%] w-[13%] rounded-[3px] border-2 border-ok-soft/90" style={{ left: `${x! + Math.sin(t * 0.8 + i) * 0.6}%`, top: `${y}%` }}>
              <span className="absolute -top-5 left-0 rounded bg-ok px-1 text-[10px] font-bold">{d.solutions.tags.student}</span>
            </div>
          ))}
      </>
    );
  }
  if (cam.scene === "gate") {
    const people = [
      { x: 30 + Math.sin(t * 0.25) * 3, y: 54, w: 9, h: 28, label: "Person · 0.97", c: "#3b82f6" },
      { x: 44 + Math.sin(t * 0.3 + 1) * 4, y: 58, w: 8, h: 26, label: "ID #0248", c: "#10b981" },
      { x: 60 + Math.cos(t * 0.2) * 2, y: 50, w: 7, h: 22, label: "Person · 0.91", c: "#3b82f6" },
    ];
    return (
      <>
        {people.map((p, i) => (
          <div key={i} className="absolute z-10 rounded-[3px] border-2" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%`, borderColor: p.c, boxShadow: `0 0 14px -2px ${p.c}` }}>
            <span className="absolute -top-5 left-0 whitespace-nowrap rounded px-1 text-[10px] font-bold" style={{ background: p.c }}>{p.label}</span>
            <Silhouette color="#111827" className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] opacity-90" />
          </div>
        ))}
        {big && (
          <div className="absolute bottom-[12%] left-[8%] right-[8%] z-10 h-[22%] rounded border-2 border-dashed border-warn/70">
            <span className="absolute -bottom-6 right-0 text-[12px] font-bold uppercase text-warn-soft">{fmt(d.dash.live.entryZone, { a: cam.stats.entered, b: cam.stats.exited })}</span>
          </div>
        )}
      </>
    );
  }
  if (cam.scene === "house") {
    return (
      <div className="absolute z-10 h-[34%] w-[12%] rounded-[3px] border-2 border-warn" style={{ left: `${58 + Math.sin(t * 0.4) * 2}%`, top: "52%" }}>
        <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-warn px-1 text-[10px] font-bold text-black">Unknown · 0.88</span>
        <Silhouette color="#0b0f19" className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)]" />
      </div>
    );
  }
  return null;
}
