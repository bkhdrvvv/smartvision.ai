"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Cctv, Cpu, LayoutGrid, Lock, ScanFace, ShieldCheck, Zap } from "lucide-react";
import { Scene3D } from "@/components/three/Scene3D";
import { BBox, Silhouette } from "@/components/ui/Silhouette";
import { useI18n } from "@/lib/i18n/client";

const HeroScene = dynamic(() => import("@/components/three/scenes/HeroScene"), { ssr: false });

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const { d } = useI18n();
  const section = useRef<HTMLElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const progress = useRef(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section.current,
        start: "top top",
        end: "bottom top",
        scrub: true,
        onUpdate: (s) => (progress.current = s.progress),
      });
      gsap.to(copy.current, { yPercent: -25, opacity: 0, ease: "none", scrollTrigger: { trigger: section.current, start: "top top", end: "70% top", scrub: true } });
      gsap.to(hud.current, { yPercent: -12, opacity: 0, ease: "none", scrollTrigger: { trigger: section.current, start: "20% top", end: "80% top", scrub: true } });
    }, section);
    return () => ctx.revert();
  }, []);

  return (
    <>
      <section ref={section} className="relative min-h-[100svh] overflow-hidden" aria-label="Hero">
        <Scene3D
          eager
          className="absolute inset-0"
          camera={{ position: [0, 0.4, 10], fov: 34 }}
          onCreated={() => window.dispatchEvent(new Event("sv:scene-ready"))}
          fallback={<div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_70%_40%,rgba(59,130,246,.25),transparent)]" />}
        >
          <HeroScene progress={progress} />
        </Scene3D>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_20%_50%,rgba(6,10,21,.85),transparent_70%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-900 to-transparent" />

        <div className="relative mx-auto flex min-h-[100svh] max-w-[1240px] items-center px-5 pb-40 pt-28 lg:pb-24">
          <div ref={copy} className="relative z-10 max-w-[620px]">
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }} className="chip chip-ok mb-7 tracking-[0.18em] uppercase !text-[11px]">
              <span className="dot dot-live" /> {d.hero.badge}
            </motion.span>
            <h1 className="display text-[clamp(44px,7vw,100px)]">
              <motion.span className="block" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.1, ease }}>
                {d.hero.title1}
              </motion.span>
              <motion.span className="grad-text block pb-2" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2, ease }}>
                {d.hero.title2}
              </motion.span>
            </h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.45 }} className="mt-6 max-w-[480px] text-[17px] leading-relaxed text-fg-muted">
              {d.hero.text}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.55, ease }} className="mt-9 flex flex-wrap gap-3">
              <Link href="/#solutions" className="btn btn-primary btn-lg">
                {d.hero.ctaPrimary} <ArrowRight size={16} />
              </Link>
              <Link href="/pricing" className="btn btn-ghost btn-lg">
                {d.hero.ctaSecondary}
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-fg-dim">
              <span className="flex items-center gap-2"><Cctv size={15} className="text-brand-400" /> {d.hero.worksWith}</span>
              <span className="flex items-center gap-2"><Lock size={14} className="text-brand-400" /> {d.hero.localProcessing}</span>
            </motion.div>
          </div>

          {/* Floating HUD — desktop */}
          <div ref={hud} className="pointer-events-none absolute inset-0 hidden lg:block">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 1, ease }} className="glass absolute right-[22%] top-[15%] w-[210px] rounded-2xl p-4">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-dim">
                {d.hero.edgeNode}
                <span className="flex items-center gap-1.5 text-ok-soft"><span className="dot dot-live" /> {d.common.online}</span>
              </div>
              <div className="mt-2 text-sm font-semibold">{d.hero.entranceCam}</div>
              <Bars />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15, duration: 1, ease }} className="glass absolute left-[46%] top-[30%] flex items-center gap-3 rounded-xl px-3 py-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-brand-400/40 text-brand-400"><ScanFace size={15} /></span>
              <div>
                <div className="text-[12px] font-semibold">{d.hero.motionZone}</div>
                <div className="text-[10px] text-fg-dim">Zone A · 06:00 — 22:00</div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 1 }} className="absolute left-[46%] top-[56%] h-[230px] w-[95px]">
              <BBox label={`${d.hero.person} · 0.97`} color="#3b82f6" className="inset-0">
                <Silhouette color="#5b9dff" className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)] animate-[pulse_4s_ease-in-out_infinite]" />
              </BBox>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.45, duration: 1 }} className="absolute left-[56%] top-[63%] h-[180px] w-[80px]">
              <BBox label="ID #0247" color="#10b981" className="inset-0">
                <Silhouette color="#34d399" className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)]" />
              </BBox>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6, duration: 1, ease }} className="glass absolute right-[3%] top-[60%] w-[200px] rounded-2xl p-4 text-[12px]">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-dim">{d.hero.liveDetection}</div>
              <Row k={d.hero.person} v={<LiveCount />} />
              <Row k={d.hero.zone} v={d.hero.entranceA} />
              <Row k={d.common.status} v={<span className="chip chip-ok !h-5 !px-2 !text-[10px]">{d.hero.tracking}</span>} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="relative z-10 mx-auto -mt-28 max-w-[1240px] px-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {d.strip.map((s, i) => {
            const I = [Cpu, Zap, LayoutGrid, ShieldCheck][i]!;
            return (
              <motion.div key={s.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.8, ease }} className="glass flex gap-4 rounded-2xl p-5">
                <span className="icon-tile shrink-0"><I size={18} /></span>
                <div>
                  <div className="text-[15px] font-semibold">{s.title}</div>
                  <div className="mt-1 text-[13px] leading-snug text-fg-dim">{s.text}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-fg-dim">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}

function Bars() {
  return (
    <div className="mt-3 flex h-9 items-end gap-[3px]" aria-hidden>
      {[40, 65, 50, 80, 60, 95, 70, 85, 55, 100, 75, 90].map((h, i) => (
        <motion.span
          key={i}
          className="w-[9px] rounded-sm bg-gradient-to-t from-brand-600 to-brand-400"
          animate={{ height: [`${h}%`, `${Math.max(25, (h * 7) % 100)}%`, `${h}%`] }}
          transition={{ duration: 2.4 + (i % 4) * 0.4, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function LiveCount() {
  return <span className="font-mono">2</span>;
}
