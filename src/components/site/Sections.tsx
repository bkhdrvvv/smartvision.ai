"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Activity, BarChart3, Bell, Cctv, Cloud, Cpu, CreditCard, GraduationCap, House, Move3d, ScanFace, Server, ShieldCheck, Smartphone, Sprout,
} from "lucide-react";
import { Scene3D } from "@/components/three/Scene3D";
import { SectionTitle } from "./SectionTitle";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

const EcosystemScene = dynamic(() => import("@/components/three/scenes/ProductScenes").then((m) => m.EcosystemScene), { ssr: false });
const ease = [0.16, 1, 0.3, 1] as const;

/* ───────────────────────── HOW IT WORKS ───────────────────────── */
export function HowItWorks() {
  const { d } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const icons = [Cctv, Cpu, ScanFace, Bell, BarChart3];
  const tints = ["#3b82f6", "#3b82f6", "#3b82f6", "#3b82f6", "#7c5cff"];

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(line.current, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top 75%", end: "bottom 60%", scrub: true } });
      gsap.utils.toArray<HTMLElement>(".how-step").forEach((el, i) => {
        gsap.fromTo(el, { y: 50, opacity: 0, rotateX: -20 }, { y: 0, opacity: 1, rotateX: 0, duration: 1, delay: i * 0.08, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="how" className="relative mx-auto max-w-[1240px] scroll-mt-24 px-5 py-28 md:py-36">
      <SectionTitle eyebrow={d.how.eyebrow} a={d.how.title1} b={d.how.title2} />
      <div ref={root} className="relative mt-16 [perspective:1200px]">
        <div className="absolute left-[8%] right-[8%] top-[68px] hidden h-px bg-line lg:block">
          <div ref={line} className="h-full origin-left bg-gradient-to-r from-brand-500 via-brand-400 to-violet-500 shadow-[0_0_12px_rgba(91,157,255,.8)]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {d.how.steps.map((s, i) => {
            const I = icons[i]!;
            return (
              <div key={s.title} className="how-step card relative p-6">
                <div className="font-mono text-xs font-semibold text-brand-400">0{i + 1}</div>
                <div className="mt-4 grid h-14 w-14 place-items-center rounded-full" style={{ background: `radial-gradient(circle at 30% 30%, ${tints[i]}66, ${tints[i]}22)`, boxShadow: `0 0 30px -6px ${tints[i]}`, border: `1px solid ${tints[i]}66` }}>
                  <I size={22} />
                </div>
                <h3 className="mt-6 text-[14px] font-bold uppercase tracking-wide">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">{s.text}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            { I: Server, t: d.how.edgeTitle, x: d.how.edgeText, c: "text-brand-400" },
            { I: Cloud, t: d.how.cloudTitle, x: d.how.cloudText, c: "text-violet-400" },
          ].map(({ I, t, x, c }) => (
            <motion.div key={t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease }} className="card flex gap-4 p-6">
              <span className={cn("icon-tile shrink-0", c)}><I size={18} /></span>
              <div>
                <div className="font-semibold">{t}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-dim">{x}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── ECOSYSTEM ───────────────────────── */
const NODES = [
  { k: "school", I: GraduationCap, x: 15, y: 20, side: "l" },
  { k: "home", I: House, x: 14, y: 52, side: "l" },
  { k: "farm", I: Sprout, x: 15, y: 84, side: "l" },
  { k: "cloud", I: Cloud, x: 85, y: 20, side: "r", violet: true },
  { k: "cams", I: Cctv, x: 86, y: 52, side: "r" },
  { k: "mobile", I: Smartphone, x: 85, y: 84, side: "r" },
] as const;

export function Ecosystem() {
  const { d } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const CX = 500, CY = 300;

  return (
    <section className="relative mx-auto max-w-[1240px] px-5 py-28 md:py-36">
      <SectionTitle eyebrow={d.ecosystem.eyebrow} a={d.ecosystem.title1} b={d.ecosystem.title2} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.1, ease }}
        className="card relative mt-16 overflow-hidden !rounded-[28px] bg-[radial-gradient(50%_60%_at_50%_55%,rgba(37,99,235,.28),transparent_70%),radial-gradient(40%_30%_at_50%_100%,rgba(124,92,255,.18),transparent)]"
      >
        <div className="relative h-[420px] lg:h-[620px]">
          <svg viewBox="0 0 1000 600" preserveAspectRatio="none" className="absolute inset-0 hidden h-full w-full lg:block" aria-hidden>
            <defs>
              <linearGradient id="eco-l" x1="0" x2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity=".2" /><stop offset="1" stopColor="#5b9dff" stopOpacity=".9" /></linearGradient>
              <linearGradient id="eco-v" x1="1" x2="0"><stop offset="0" stopColor="#7c5cff" stopOpacity=".2" /><stop offset="1" stopColor="#8b7bff" stopOpacity=".9" /></linearGradient>
            </defs>
            {NODES.map((n, i) => {
              const nx = n.side === "l" ? n.x * 10 + 120 : n.x * 10 - 120;
              const ny = n.y * 6;
              const cx = n.side === "l" ? CX - 140 : CX + 140;
              const path = `M${nx},${ny} C${(nx + cx) / 2},${ny} ${(nx + cx) / 2},${(ny + CY) / 2} ${cx},${CY + (ny - CY) * 0.15}`;
              const on = active === i;
              return (
                <g key={n.k}>
                  <path d={path} fill="none" stroke={`url(#${"violet" in n ? "eco-v" : "eco-l"})`} strokeWidth={on ? 2.2 : 1.1} vectorEffect="non-scaling-stroke" style={{ transition: "stroke-width .3s" }} />
                  <circle r="3.5" fill="#dbe7ff">
                    <animateMotion dur={`${3 + i * 0.4}s`} repeatCount="indefinite" path={path} keyPoints={n.side === "l" ? "0;1" : "0;1"} keyTimes="0;1" />
                  </circle>
                </g>
              );
            })}
          </svg>

          <Scene3D className="absolute inset-x-0 top-0 h-[300px] cursor-grab active:cursor-grabbing lg:inset-0 lg:h-auto" camera={{ position: [0, 2.4, 8.5], fov: 34 }}>
            <EcosystemScene active={active} />
          </Scene3D>

          <span className="chip chip-blue absolute bottom-[90px] left-1/2 -translate-x-1/2 uppercase tracking-wide lg:bottom-[22%]">
            <span className="dot !bg-brand-400" /> {d.ecosystem.core}
          </span>

          {NODES.map((n, i) => {
            const node = d.ecosystem.nodes[n.k];
            return (
              <button
                key={n.k}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className={cn(
                  "glass absolute hidden w-[230px] -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-2xl p-3 text-left transition-all duration-300 lg:flex",
                  active === i && "!border-brand-400/60 shadow-[0_0_40px_-10px_rgba(59,130,246,.9)]",
                )}
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
              >
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl border bg-ink-700", "violet" in n ? "border-violet-500/40 text-violet-400" : "border-brand-400/30 text-brand-400")}>
                  <n.I size={18} />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold">{node.title}</span>
                  <span className="block text-[12px] text-fg-dim">{node.sub}</span>
                </span>
              </button>
            );
          })}

          <span className="absolute bottom-4 right-5 hidden items-center gap-1.5 text-[12px] text-fg-dim lg:flex">
            <Move3d size={13} /> {d.common.dragHint}
          </span>
        </div>

        {/* mobile node grid */}
        <div className="grid grid-cols-2 gap-2 p-3 lg:hidden">
          {NODES.map((n) => {
            const node = d.ecosystem.nodes[n.k];
            return (
              <div key={n.k} className="glass flex items-center gap-2.5 rounded-xl p-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand-400/30 text-brand-400"><n.I size={16} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{node.title}</span>
                  <span className="block truncate text-[11px] text-fg-dim">{node.sub}</span>
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}

/* ───────────────────────── FEATURES ───────────────────────── */
export function Features() {
  const { d } = useI18n();
  const icons = [Activity, ScanFace, Cctv, Server, Bell, BarChart3, ShieldCheck, CreditCard];
  return (
    <section className="relative mx-auto max-w-[1240px] px-5 py-28 md:py-36">
      <SectionTitle eyebrow={d.features.eyebrow} a={d.features.title1} b={d.features.title2} />
      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {d.features.items.map((f, i) => {
          const I = icons[i]!;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: (i % 4) * 0.07, duration: 0.8, ease }}
              whileHover={{ y: -6 }}
              className="card group relative overflow-hidden p-7 transition-colors hover:border-brand-400/40"
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-500/0 blur-3xl transition-all duration-700 group-hover:bg-brand-500/25" />
              <span className="icon-tile"><I size={18} /></span>
              <h3 className="mt-8 text-[17px] font-semibold">{f.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">{f.text}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
