"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Eye, Headset, ImagePlus, Loader2, Mic, Pause, Play, SendHorizontal, Square, Trash2, User, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

export type ChatMsg = {
  id: string;
  mine: boolean;
  fromAdmin: boolean;
  type: "TEXT" | "IMAGE" | "VOICE";
  body: string;
  file: string | null;
  duration: number | null;
  at: string;
  seen: boolean;
  seenAt?: string | null;
  author: string | null;
  pending?: boolean;
};
export type Presence = { online: boolean; since: string | null; lastSeen: string | null };

const MAX_FILE = 5 * 1024 * 1024;
const MAX_VOICE = 180;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
type T = { today: string; yesterday: string; unitSec: string; unitMin: string; unitHour: string };
/** "14:32" today, "kecha 14:32", "05.11 14:32" */
function whenLabel(iso: string, t: T) {
  const d = new Date(iso);
  const day = d.toDateString() === new Date().toDateString() ? t.today : d.toDateString() === new Date(Date.now() - 86400000).toDateString() ? t.yesterday : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  return `${day} ${time(iso)}`;
}
/** online for: "40 s", "12 daq", "1 soat 5 daq" */
function fmtDur(ms: number, t: T) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} ${t.unitSec}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ${t.unitMin}`;
  return `${Math.floor(m / 60)} ${t.unitHour} ${m % 60} ${t.unitMin}`;
}

/** Voice note player: play / pause, progress, length. */
function Voice({ src, duration, mine }: { src: string; duration: number | null; mine: boolean }) {
  const a = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = duration || 0;
  return (
    <div className="flex w-[230px] max-w-full items-center gap-3">
      <button
        type="button"
        onClick={() => (a.current?.paused ? a.current.play() : a.current?.pause())}
        className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", mine ? "bg-white/25 text-white" : "bg-brand-500/25 text-brand-200")}
        aria-label="play"
      >
        {playing ? <Pause size={17} /> : <Play size={17} className="translate-x-[1px]" />}
      </button>
      <div className="min-w-0 flex-1">
        {/* waveform-like bars that fill while playing */}
        <div className="flex h-7 items-center gap-[2px]">
          {Array.from({ length: 28 }, (_, i) => {
            const h = 25 + ((i * 37) % 70);
            const on = total ? i / 28 < pos / total : false;
            return <span key={i} style={{ height: `${h}%` }} className={cn("w-[3px] rounded-full", on ? (mine ? "bg-white" : "bg-brand-300") : mine ? "bg-white/40" : "bg-white/20")} />;
          })}
        </div>
        <div className={cn("text-[11px]", mine ? "text-white/75" : "text-fg-dim")}>{mmss(playing || pos ? pos : total)}</div>
      </div>
      <audio
        ref={a}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPos(0);
        }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
      />
    </div>
  );
}

export function Chat({ ticketId, initial, peerName, peerSub, closed, status: initialStatus, showStatus, presence: initialPresence }: { ticketId: string; initial: ChatMsg[]; peerName: string; peerSub?: string; closed?: boolean; status?: "OPEN" | "ANSWERED" | "CLOSED"; showStatus?: boolean; presence?: Presence | null }) {
  const { d } = useI18n();
  const t = d.support;
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [presence, setPresence] = useState<Presence | null>(initialPresence ?? null);
  const [, tick] = useState(0); // re-render so "online for …" keeps counting
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 10_000);
    // leaving the page / closing the tab → the other side sees "left at …" immediately
    const leave = () => navigator.sendBeacon?.(`/api/tickets/${ticketId}/presence`);
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(iv);
      window.removeEventListener("pagehide", leave);
    };
  }, [ticketId]);
  const [text, setText] = useState("");
  const [img, setImg] = useState<{ file: File; url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [rec, setRec] = useState<{ sec: number } | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const recRef = useRef<{ mr: MediaRecorder; chunks: Blob[]; start: number; timer: ReturnType<typeof setInterval>; cancel: boolean } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const atBottom = useRef(true);

  const scroll = (force = false) => requestAnimationFrame(() => {
    const el = list.current;
    if (el && (force || atBottom.current)) el.scrollTop = el.scrollHeight;
  });

  // poll for new messages and "seen" updates (every 3 s while the tab is visible)
  const refresh = useCallback(async () => {
    if (document.hidden) return;
    try {
      const r = await fetch(`/api/tickets/${ticketId}/messages`, { cache: "no-store" });
      if (!r.ok) return;
      const j: { messages: ChatMsg[]; status?: "OPEN" | "ANSWERED" | "CLOSED"; presence?: Presence | null } = await r.json();
      if (j.status) setStatus(j.status);
      if (j.presence !== undefined) setPresence(j.presence);
      setMsgs((prev) => {
        const pend = prev.filter((m) => m.pending);
        const grew = j.messages.length !== prev.filter((m) => !m.pending).length;
        if (grew) scroll();
        return [...j.messages, ...pend];
      });
    } catch {}
  }, [ticketId]);
  useEffect(() => {
    scroll(true);
    const iv = setInterval(refresh, 3000);
    const vis = () => !document.hidden && refresh();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [refresh]);

  const post = async (fd: FormData, optimistic: ChatMsg) => {
    setErr(null);
    setMsgs((m) => [...m, optimistic]);
    scroll(true);
    setSending(true);
    try {
      const r = await fetch(`/api/tickets/${ticketId}/messages`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "error");
      setMsgs((m) => m.map((x) => (x.id === optimistic.id ? j.message : x)));
    } catch (e) {
      setMsgs((m) => m.filter((x) => x.id !== optimistic.id));
      const code = (e as Error).message;
      setErr(code === "too_large" ? t.fileTooBig : code === "bad_file" ? t.badFile : code === "too_many" ? d.auth.tooMany : d.common.error);
    } finally {
      setSending(false);
    }
  };

  const optimistic = (p: Partial<ChatMsg>): ChatMsg => ({ id: `tmp-${Date.now()}`, mine: true, fromAdmin: false, type: "TEXT", body: "", file: null, duration: null, at: new Date().toISOString(), seen: false, author: null, pending: true, ...p });

  const sendText = async () => {
    const body = text.trim();
    if ((!body && !img) || sending) return;
    const fd = new FormData();
    if (body) fd.set("text", body);
    if (img) fd.set("file", img.file);
    const o = optimistic({ body, type: img ? "IMAGE" : "TEXT", file: img?.url ?? null });
    setText("");
    setImg(null);
    await post(fd, o);
  };

  const pickImage = (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr(t.badFile);
    if (f.size > MAX_FILE) return setErr(t.fileTooBig);
    setErr(null);
    setImg({ file: f, url: URL.createObjectURL(f) });
  };

  const startRec = async () => {
    setErr(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return setErr(t.micUnsupported);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const n = (e as DOMException)?.name;
      return setErr(n === "NotAllowedError" || n === "SecurityError" ? t.micDenied : n === "NotFoundError" || n === "OverconstrainedError" ? t.micMissing : t.micUnsupported);
    }
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m));
    const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const st = { mr, chunks: [] as Blob[], start: Date.now(), timer: setInterval(() => {
      const sec = Math.round((Date.now() - st.start) / 1000);
      setRec({ sec });
      if (sec >= MAX_VOICE) stopRec(false);
    }, 250), cancel: false };
    recRef.current = st;
    mr.ondataavailable = (e) => e.data.size && st.chunks.push(e.data);
    mr.onstop = async () => {
      clearInterval(st.timer);
      stream.getTracks().forEach((tr) => tr.stop());
      setRec(null);
      recRef.current = null;
      if (st.cancel) return;
      const sec = Math.max(1, Math.round((Date.now() - st.start) / 1000));
      const blob = new Blob(st.chunks, { type: mr.mimeType || "audio/webm" });
      if (blob.size < 200) return;
      if (blob.size > MAX_FILE) return setErr(t.fileTooBig);
      const fd = new FormData();
      fd.set("file", new File([blob], `voice.${blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm"}`, { type: blob.type }));
      fd.set("duration", String(sec));
      await post(fd, optimistic({ type: "VOICE", file: URL.createObjectURL(blob), duration: sec }));
    };
    mr.start(250);
    setRec({ sec: 0 });
  };
  const stopRec = (cancel: boolean) => {
    const r = recRef.current;
    if (!r) return;
    r.cancel = cancel;
    if (r.mr.state !== "inactive") r.mr.stop();
  };

  // date separators ("Bugun", "Kecha", 07.11.2026)
  const dayLabel = (iso: string) => {
    const dt = new Date(iso);
    const today = new Date();
    const y = new Date(Date.now() - 86400000);
    if (dt.toDateString() === today.toDateString()) return t.today;
    if (dt.toDateString() === y.toDateString()) return t.yesterday;
    return dt.toLocaleDateString("ru-RU");
  };
  const lastMineSeen = [...msgs].reverse().find((m) => m.mine && !m.pending);

  return (
    <div className="flex h-[calc(100svh-230px)] min-h-[480px] flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#0b1020]">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-white/[.03] px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 p-[2px]">
          <span className="grid h-full w-full place-items-center rounded-full bg-[#0b1020] text-[13px] font-bold">{peerName.slice(0, 2).toUpperCase()}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{peerName}</span>
            {showStatus && status && <span className={cn("chip !h-5 shrink-0 !px-2 !text-[10px]", status === "ANSWERED" ? "chip-ok" : status === "OPEN" ? "chip-warn" : "")}>{t.status[status]}</span>}
          </div>
          {/* presence: online now (and for how long) · or when they left */}
          <div className="flex items-center gap-1.5 truncate text-[12px] text-fg-dim">
            {presence?.online ? (
              <><span className="h-2 w-2 shrink-0 rounded-full bg-ok shadow-[0_0_8px_rgba(16,185,129,.8)]" /><span className="font-medium text-ok-soft">{t.online}</span>{presence.since && <span>· {fmtDur(Date.now() - new Date(presence.since).getTime(), t)}</span>}</>
            ) : presence?.lastSeen ? (
              <><span className="h-2 w-2 shrink-0 rounded-full bg-fg-dim/60" />{t.leftAt.replace("{t}", whenLabel(presence.lastSeen, t))}</>
            ) : (
              <><span className="h-2 w-2 shrink-0 rounded-full bg-fg-dim/40" />{t.neverHere}</>
            )}
            {peerSub && <span className="truncate">· {peerSub}</span>}
          </div>
        </div>
      </div>

      {/* messages */}
      <div ref={list} onScroll={(e) => (atBottom.current = e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight < 80)} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4 sm:px-5">
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
          const grouped = prev && !newDay && prev.mine === m.mine && new Date(m.at).getTime() - new Date(prev.at).getTime() < 120000;
          return (
            <div key={m.id}>
              {newDay && <div className="my-3 text-center text-[11px] font-semibold uppercase tracking-wider text-fg-dim">{dayLabel(m.at)}</div>}
              <div className={cn("flex items-end gap-2", m.mine ? "justify-end" : "justify-start", !grouped && "mt-3")}>
                {!m.mine && (
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", grouped && "invisible", m.fromAdmin ? "bg-brand-500/25 text-brand-200" : "bg-violet-500/25 text-violet-200")}>
                    {m.fromAdmin ? <Headset size={13} /> : <User size={13} />}
                  </span>
                )}
                <div className={cn("max-w-[78%]", m.pending && "opacity-60")}>
                  {m.type === "IMAGE" && m.file && (
                    <button type="button" onClick={() => setZoom(m.file)} className="block overflow-hidden rounded-[18px] border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.file} alt="" className="max-h-[320px] w-auto max-w-full object-cover" loading="lazy" />
                    </button>
                  )}
                  {(m.type === "VOICE" || m.body) && (
                    <div className={cn("rounded-[20px] px-3.5 py-2.5 text-[14.5px] leading-snug", m.type === "IMAGE" && "mt-1", m.mine ? "bg-gradient-to-br from-violet-600 to-brand-500 text-white" : "bg-white/[.08] text-fg", m.mine ? "rounded-br-md" : "rounded-bl-md")}>
                      {m.type === "VOICE" && m.file ? <Voice src={m.file} duration={m.duration} mine={m.mine} /> : <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    </div>
                  )}
                  <div className={cn("mt-0.5 flex items-center gap-1 px-1 text-[10.5px] text-fg-dim", m.mine ? "justify-end" : "justify-start")}>
                    {!m.mine && m.fromAdmin && m.author && <span>{m.author} ·</span>}
                    {time(m.at)}
                    {m.mine && (m.pending ? <Loader2 size={11} className="animate-spin" /> : m.seen ? <CheckCheck size={14} className="text-sky-400" aria-label={t.seen} /> : <Check size={13} aria-label={t.sentLabel} />)}
                  </div>
                </div>
              </div>
              {lastMineSeen?.id === m.id && (
                <div className={cn("mt-0.5 flex items-center justify-end gap-1 pr-1 text-[11px] font-medium", m.seen ? "text-sky-400" : "text-fg-dim")}>{m.seen ? <Eye size={12} /> : <Check size={12} />} {m.seen ? (m.seenAt ? `${t.seen} · ${whenLabel(m.seenAt, t)}` : t.seen) : t.sentLabel}</div>
              )}
            </div>
          );
        })}
        {msgs.length === 0 && <p className="py-10 text-center text-fg-dim">{t.none}</p>}
      </div>

      {(status ? status === "CLOSED" : closed) && <div className="border-t border-white/10 bg-white/[.03] px-4 py-2 text-center text-[12px] text-fg-dim">{t.closedNote}</div>}
      {err && <div className="border-t border-bad/30 bg-bad/10 px-4 py-2 text-[13px] text-bad-soft">{err}</div>}

      {/* photo preview before sending */}
      {img && (
        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt="" className="h-16 w-16 rounded-xl object-cover" />
          <span className="flex-1 truncate text-[13px] text-fg-muted">{img.file.name}</span>
          <button type="button" onClick={() => setImg(null)} className="btn btn-ghost !h-9 !w-9 !p-0" aria-label={t.cancel}><X size={16} /></button>
        </div>
      )}

      {/* composer */}
      <div className="border-t border-white/10 p-3">
        {rec ? (
          <div className="flex items-center gap-3 rounded-full border border-bad/40 bg-bad/10 px-4 py-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-bad" />
            <span className="flex-1 text-[14px]">{t.recording} {mmss(rec.sec)} <span className="text-fg-dim">/ {mmss(MAX_VOICE)}</span></span>
            <button type="button" onClick={() => stopRec(true)} className="grid h-9 w-9 place-items-center rounded-full text-fg-muted hover:text-bad-soft" aria-label={t.cancel}><Trash2 size={17} /></button>
            <button type="button" onClick={() => stopRec(false)} className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-brand-500 text-white" aria-label={t.send}><Square size={14} fill="currentColor" /></button>
          </div>
        ) : (
          <div className="flex items-end gap-2 rounded-[24px] border border-white/15 bg-white/[.04] px-2 py-1.5">
            <button type="button" onClick={() => fileIn.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-white/10 hover:text-fg" aria-label={t.photo} title={t.photo}><ImagePlus size={20} /></button>
            <input ref={fileIn} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
              onPaste={(e) => pickImage([...e.clipboardData.files].find((f) => f.type.startsWith("image/")))}
              rows={1}
              maxLength={4000}
              placeholder={t.typeHere}
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] outline-none placeholder:text-fg-dim"
            />
            {text.trim() || img ? (
              <button type="button" disabled={sending} onClick={sendText} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-brand-500 text-white" aria-label={t.send}><SendHorizontal size={18} /></button>
            ) : (
              <button type="button" onClick={startRec} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-white/10 hover:text-fg" aria-label={t.voice} title={t.voice}><Mic size={20} /></button>
            )}
          </div>
        )}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
