"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type StreamState = "loading" | "playing" | "error";
export type Quality = "auto" | "high" | "medium" | "low";

/** MJPEG: the Edge agent's stream (.mjpg) or the platform relay (/api/cameras/:id/stream) */
export const isMjpeg = (src: string) => /\.mjpe?g($|\?)|mjpeg|video_feed|\/api\/cameras\/[^/]+\/stream($|\?)/i.test(src);

export type PlayerHandle = {
  /** current frame as a PNG data URL (for snapshots / pause) */
  capture: () => string | null;
  /** seconds behind live the player can go back */
  maxDelay: () => number;
};

type Props = {
  src: string;
  paused?: boolean;
  /** seconds behind live (0 = live) */
  delay?: number;
  quality?: Quality;
  onState?: (s: StreamState) => void;
  className?: string;
};

/**
 * Plays a browser-compatible camera stream:
 *  - MJPEG from the Edge AI agent (boxes drawn in) — supports delay (replay buffer) and quality via query params
 *  - HLS (.m3u8) via hls.js (Chrome/Firefox/Edge) or natively (Safari) — delay via the DVR window, quality via levels
 *  - MP4 / WebM directly
 * RTSP cannot be played by browsers — publish it as HLS with MediaMTX / go2rtc, or run the Edge agent.
 */
export const StreamPlayer = forwardRef<PlayerHandle, Props>(function StreamPlayer(props, ref) {
  return isMjpeg(props.src) ? <MjpegPlayer {...props} ref={ref} /> : <VideoPlayer {...props} ref={ref} />;
});

function grab(el: HTMLImageElement | HTMLVideoElement | null) {
  if (!el) return null;
  const w = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
  const h = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  if (!w || !h) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  try {
    c.getContext("2d")!.drawImage(el, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.92);
  } catch {
    return null; // cross-origin source without CORS headers
  }
}

const MjpegPlayer = forwardRef<PlayerHandle, Props>(function MjpegPlayer({ src, paused, delay = 0, quality = "auto", onState, className }, ref) {
  const img = useRef<HTMLImageElement>(null);
  const frozen = useRef<string | null>(null);
  const cb = useRef(onState);
  cb.current = onState;
  // bumping this reconnects the stream; used for automatic retries after an error
  const [attempt, setAttempt] = useState(0);

  useImperativeHandle(ref, () => ({ capture: () => grab(img.current), maxDelay: () => 115 }), []);

  // build the stream URL: the agent understands ?delay=<s>&q=<high|medium|low>
  const url = (() => {
    if (typeof window === "undefined") return src; // server render
    const u = new URL(src, window.location.href);
    if (delay > 0) u.searchParams.set("delay", String(Math.round(delay)));
    if (quality !== "auto") u.searchParams.set("q", quality);
    if (attempt) u.searchParams.set("r", String(attempt)); // cache-buster for reconnects
    return u.toString();
  })();

  // freeze the last frame while paused (an MJPEG stream itself cannot pause)
  if (paused && !frozen.current) frozen.current = grab(img.current);
  if (!paused) frozen.current = null;

  useEffect(() => {
    if (paused) return;
    cb.current?.("loading");
    const el = img.current;
    if (!el) return;
    let failed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const onErr = () => {
      if (failed) return;
      failed = true;
      cb.current?.("error");
      // never give up: the Edge agent may be restarting or the network blipped — reconnect in 5 s
      retry = setTimeout(() => setAttempt((a) => a + 1), 5000);
    };
    el.addEventListener("error", onErr);
    // multipart streams don't reliably fire "load": poll for the first decoded frame
    const t = setInterval(() => {
      if (!failed && el.naturalWidth > 0) {
        cb.current?.("playing");
        clearInterval(t);
      }
    }, 400);
    // a slow first frame (model warm-up) is not fatal — it just triggers a reconnect
    const giveUp = setTimeout(() => el.naturalWidth === 0 && onErr(), 20000);
    return () => {
      clearInterval(t);
      clearTimeout(giveUp);
      clearTimeout(retry);
      el.removeEventListener("error", onErr);
    };
  }, [url, paused]);

  /* eslint-disable-next-line @next/next/no-img-element */
  return <img ref={img} src={paused ? frozen.current ?? undefined : url} alt="" crossOrigin="anonymous" draggable={false} className={className} />;
});

const VideoPlayer = forwardRef<PlayerHandle, Props>(function VideoPlayer({ src, paused, delay = 0, quality = "auto", onState, className }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void; levels: unknown[]; currentLevel: number } | null>(null);
  const cb = useRef(onState);
  cb.current = onState;

  useImperativeHandle(
    ref,
    () => ({
      capture: () => grab(video.current),
      maxDelay: () => {
        const v = video.current;
        if (!v || !v.seekable.length) return 0;
        return Math.max(0, v.seekable.end(v.seekable.length - 1) - v.seekable.start(0) - 1);
      },
    }),
    [],
  );

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let destroyed = false;
    cb.current?.("loading");
    const isHls = /\.m3u8($|\?)/i.test(src);
    const onPlaying = () => cb.current?.("playing");
    const onError = () => cb.current?.("error");
    v.addEventListener("playing", onPlaying);
    v.addEventListener("error", onError);

    if (isHls && !v.canPlayType("application/vnd.apple.mpegurl")) {
      import("hls.js").then(({ default: Hls }) => {
        if (destroyed) return;
        if (!Hls.isSupported()) return cb.current?.("error");
        const h = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 2, manifestLoadingMaxRetry: 3, backBufferLength: 120 });
        h.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) cb.current?.("error");
        });
        h.loadSource(src);
        h.attachMedia(v);
        hlsRef.current = h as unknown as typeof hlsRef.current;
      });
    } else {
      v.src = src;
    }
    v.play().catch(() => {});

    return () => {
      destroyed = true;
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("error", onError);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      v.removeAttribute("src");
      v.load();
    };
  }, [src]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused]);

  // seek relative to the live edge (or to the end for recorded files)
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const apply = () => {
      if (v.seekable.length) {
        const end = v.seekable.end(v.seekable.length - 1);
        const start = v.seekable.start(0);
        v.currentTime = Math.max(start, end - delay);
      } else if (Number.isFinite(v.duration)) {
        v.currentTime = Math.max(0, v.duration - delay);
      }
    };
    if (v.readyState >= 1) apply();
    else v.addEventListener("loadedmetadata", apply, { once: true });
  }, [delay]);

  // quality: hls.js levels are ordered low → high
  useEffect(() => {
    const h = hlsRef.current;
    if (!h || !h.levels?.length) return;
    const n = h.levels.length;
    h.currentLevel = quality === "auto" ? -1 : quality === "high" ? n - 1 : quality === "low" ? 0 : Math.floor((n - 1) / 2);
  }, [quality]);

  return <video ref={video} muted playsInline autoPlay crossOrigin="anonymous" className={className} />;
});
