"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Square } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

type Det = { bbox: [number, number, number, number]; class: string; score: number };
type Model = { detect: (v: HTMLVideoElement) => Promise<Det[]> };

/** load a script once */
function loadScript(src: string) {
  return new Promise<void>((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => res();
    s.onerror = () => rej(new Error("load " + src));
    document.head.appendChild(s);
  });
}

let modelPromise: Promise<Model> | null = null;
/** TensorFlow.js + COCO-SSD (Apache-2.0) from a CDN — runs in the visitor's browser, nothing is uploaded. */
function getModel() {
  modelPromise ??= (async () => {
    await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
    await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js");
    const w = window as unknown as { cocoSsd: { load: (o?: object) => Promise<Model> } };
    return w.cocoSsd.load({ base: "lite_mobilenet_v2" });
  })();
  return modelPromise;
}

const COLOR: Record<string, string> = { person: "#22d3ee", car: "#a78bfa", truck: "#a78bfa", bus: "#a78bfa", motorcycle: "#a78bfa", dog: "#34d399", cat: "#34d399", cow: "#34d399", sheep: "#34d399", horse: "#34d399", knife: "#f43f5e" };

export function LiveTry() {
  const { f } = useI18n();
  const y = f.y;
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const [state, setState] = useState<"idle" | "loading" | "on" | "denied" | "nocam">("idle");
  const [seen, setSeen] = useState<Record<string, number>>({});

  const stop = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setState("idle");
    setSeen({});
  };
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setState("nocam");
    setState("loading");
    try {
      const [m, s] = await Promise.all([getModel(), navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 } }, audio: false })]);
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      setState("on");
      let last = 0;
      const loop = async (t: number) => {
        if (!stream.current) return;
        if (t - last > 120 && v.videoWidth) {
          last = t;
          const dets = (await m.detect(v)).filter((d) => d.score >= 0.5);
          const c = canvas.current!;
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const g = c.getContext("2d")!;
          g.clearRect(0, 0, c.width, c.height);
          const count: Record<string, number> = {};
          for (const d of dets) {
            const [x, yy, w, h] = d.bbox;
            const col = COLOR[d.class] ?? "#60a5fa";
            const name = (y.labels as Record<string, string>)[d.class] ?? d.class;
            count[name] = (count[name] ?? 0) + 1;
            g.lineWidth = Math.max(3, c.width / 260);
            g.strokeStyle = col;
            g.strokeRect(x, yy, w, h);
            const tag = `${name} · ${Math.round(d.score * 100)}%`;
            g.font = `bold ${Math.max(16, c.width / 40)}px Segoe UI, Arial`;
            const tw = g.measureText(tag).width + 14;
            const th = Math.max(24, c.width / 28);
            g.fillStyle = col;
            g.fillRect(x - 1, Math.max(0, yy - th), tw, th);
            g.fillStyle = "#05070d";
            g.fillText(tag, x + 6, Math.max(th - 6, yy - 6));
          }
          setSeen(count);
        }
        raf.current = requestAnimationFrame(loop);
      };
      raf.current = requestAnimationFrame(loop);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      const n = (e as DOMException)?.name;
      setState(n === "NotAllowedError" || n === "SecurityError" ? "denied" : n === "NotFoundError" ? "nocam" : "nocam");
    }
  };

  return (
    <div className="card overflow-hidden !rounded-[24px]">
      <div className="relative aspect-video bg-[#04060d]">
        {/* mirrored like a selfie: easier to understand on a laptop */}
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        {state !== "on" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="max-w-md">
              {state === "loading" ? (
                <p className="flex items-center justify-center gap-2 text-fg-muted"><Loader2 size={18} className="animate-spin" /> {y.tryLoading}</p>
              ) : (
                <>
                  {state === "denied" && <p className="mb-4 text-amber-300">{y.tryDenied}</p>}
                  {state === "nocam" && <p className="mb-4 text-amber-300">{y.tryNoCam}</p>}
                  <button onClick={start} className="btn btn-primary btn-lg"><Camera size={18} /> {y.tryStart}</button>
                  <p className="mt-3 text-[12.5px] text-fg-dim">{y.tryPrivacy}</p>
                </>
              )}
            </div>
          </div>
        )}
        {state === "on" && <span className="absolute left-3 top-3 rounded-full bg-rose-500 px-3 py-1 text-[12px] font-bold text-white">● LIVE · AI</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3 p-4">
        {state === "on" ? (
          <>
            <span className="text-[13px] text-fg-muted">{y.trySeen}:</span>
            {Object.keys(seen).length ? Object.entries(seen).map(([k, n]) => <span key={k} className="chip chip-blue">{k}{n > 1 ? ` ×${n}` : ""}</span>) : <span className="text-[13px] text-fg-dim">{y.tryNothing}</span>}
            <button onClick={stop} className="btn btn-ghost btn-sm ml-auto"><Square size={13} /> {y.tryStop}</button>
          </>
        ) : (
          <Link href="/pricing" className="text-[13.5px] font-semibold text-brand-300 hover:underline">{y.tryCta} →</Link>
        )}
      </div>
    </div>
  );
}
