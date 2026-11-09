"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Lock, MoonStar } from "lucide-react";
import { setCameraNightMode } from "@/app/actions/customer";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

type Mode = "auto" | "on" | "off";

/**
 * Night Vision for one camera (Pro plan): Auto (when the picture is dark) / Always on / Off.
 * Shows "Night Vision active" when the Edge agent reports the enhancement is running.
 * Other plans: a locked chip linking to the subscription page.
 */
export function NightVisionControl({ cameraId, mode, active, allowed, canEdit }: { cameraId: string; mode: Mode; active: boolean; allowed: boolean; canEdit: boolean }) {
  const { d } = useI18n();
  const t = d.dash.night;
  const [cur, setCur] = useState<Mode>(mode);
  const [on, setOn] = useState(active);
  // live status from the Edge agent (heartbeat every 10 s)
  useEffect(() => {
    if (!allowed) return;
    const tick = async () => {
      try {
        const r = await fetch(`/api/cameras/${cameraId}/night`, { cache: "no-store" });
        if (r.ok) setOn(!!(await r.json()).active);
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 5_000);
    return () => clearInterval(iv);
  }, [cameraId, allowed]);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setCur(mode), [mode]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!allowed)
    return (
      <Link href="/dashboard/subscription" onClick={(e) => e.stopPropagation()} title={t.proOnly} className="chip !h-8 gap-1.5 bg-ink-950/80 text-fg-muted backdrop-blur hover:text-fg">
        <Lock size={12} /> <MoonStar size={13} /> Night Vision · <span className="text-violet-300">{t.proOnly}</span>
      </Link>
    );

  const choose = (m: Mode) =>
    start(async () => {
      setCur(m);
      setOpen(false);
      if (m === "off") setOn(false); // off = off right now, no waiting for the camera
      await setCameraNightMode(cameraId, m);
    });

  return (
    <div ref={box} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "chip !h-8 gap-1.5 backdrop-blur transition",
          on ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,.45)]" : "bg-ink-950/80 text-fg-muted hover:text-fg",
        )}
        aria-label="Night Vision"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <MoonStar size={13} />}
        {on ? t.active : `Night Vision · ${t.modes[cur]}`}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-60 rounded-xl border border-white/10 bg-[#0b1020]/95 p-1.5 shadow-2xl backdrop-blur">
          {(["auto", "on", "off"] as const).map((m) => (
            <button key={m} type="button" onClick={() => choose(m)} className={cn("flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/5", cur === m && "bg-white/[.06]")}>
              <span className="mt-0.5 w-4">{cur === m && <Check size={14} className="text-emerald-300" />}</span>
              <span>
                <span className="block text-[13px] font-semibold">{t.modes[m]}</span>
                <span className="block text-[11.5px] text-fg-dim">{t.hints[m]}</span>
              </span>
            </button>
          ))}
          <p className="px-3 pb-1 pt-1.5 text-[11px] text-fg-dim">{t.applyNote}</p>
        </div>
      )}
    </div>
  );
}
