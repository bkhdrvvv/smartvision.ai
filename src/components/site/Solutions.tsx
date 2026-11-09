"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, GraduationCap, House, Sprout } from "lucide-react";
import { Scene3D } from "@/components/three/Scene3D";
import { SectionTitle } from "./SectionTitle";
import { useI18n } from "@/lib/i18n/client";
import { cn, money } from "@/lib/format";
import { fmt } from "@/lib/i18n";

const SolutionScene = dynamic(() => import("@/components/three/scenes/ProductScenes").then((m) => m.SolutionScene), { ssr: false });

export type Kind = "school" | "home" | "farm";
export const KIND_ICON = { school: GraduationCap, home: House, farm: Sprout };

export function Solutions({ minPrice }: { minPrice: Record<Kind, number> }) {
  const { d } = useI18n();
  const kinds: Kind[] = ["school", "home", "farm"];
  return (
    <section id="solutions" className="relative mx-auto max-w-[1240px] scroll-mt-24 px-5 py-28 md:py-36">
      <SectionTitle eyebrow={d.solutions.eyebrow} a={d.solutions.title1} b={d.solutions.title2} />
      <div className="mt-16 grid gap-5 lg:grid-cols-3">
        {kinds.map((k, i) => (
          <SolutionCard key={k} kind={k} index={i} price={minPrice[k]} highlight={k === "home"} />
        ))}
      </div>
    </section>
  );
}

function SolutionCard({ kind, index, price, highlight }: { kind: Kind; index: number; price: number; highlight?: boolean }) {
  const { d } = useI18n();
  const s = d.solutions[kind];
  const [hover, setHover] = useState(false);
  const I = KIND_ICON[kind];
  const tags = {
    school: [
      { t: `${d.solutions.tags.student} · 12`, c: "#3b82f6", cls: "left-[22%] top-[34%] h-[22%] w-[18%]" },
      { t: d.solutions.tags.entry, c: "#10b981", cls: "left-[44%] top-[22%] h-[30%] w-[15%]" },
      { t: `${d.solutions.tags.occupancy} 78%`, c: "#f59e0b", cls: "left-[66%] top-[42%] h-[24%] w-[16%]" },
    ],
    home: [
      { t: d.solutions.tags.window, c: "#3b82f6", cls: "left-[26%] top-[46%] h-[18%] w-[18%]" },
      { t: `${d.solutions.tags.unknown} · 0.91`, c: "#f59e0b", cls: "left-[56%] top-[42%] h-[42%] w-[12%]" },
    ],
    farm: [
      { t: d.solutions.tags.feedSilo, c: "#3b82f6", cls: "left-[66%] top-[14%] h-[62%] w-[14%]" },
      { t: `${d.solutions.tags.gate} 24`, c: "#10b981", cls: "left-[34%] top-[50%] h-[38%] w-[20%]" },
    ],
  }[kind];

  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: index * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className={cn("card group flex flex-col overflow-hidden transition-[transform,box-shadow,border-color] duration-500 hover:-translate-y-1.5", highlight && "card-hl")}
    >
      <div className="relative h-[240px] overflow-hidden border-b border-line bg-[radial-gradient(80%_80%_at_50%_100%,rgba(59,130,246,.25),transparent_70%),linear-gradient(180deg,#0b1430,#070c1b)]">
        <Scene3D className="absolute inset-0" camera={{ position: [4.2, 2.4, 6.4], fov: 32 }}>
          <SolutionScene kind={kind} hovered={hover} />
        </Scene3D>
        <span className="chip absolute left-4 top-4 !h-6 bg-ink-950/70 !text-[10px] uppercase tracking-[0.16em] text-fg">
          <span className="dot dot-live" /> {s.cam}
        </span>
        <div className={cn("pointer-events-none absolute inset-0 transition-opacity duration-700", hover ? "opacity-100" : "opacity-80")}>
          {tags.map((t) => (
            <div key={t.t} className={cn("absolute rounded-[3px] border", t.cls)} style={{ borderColor: t.c, boxShadow: `0 0 16px -6px ${t.c}` }}>
              <span className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: t.c }}>
                {t.t}
              </span>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 h-16 animate-scan bg-gradient-to-b from-transparent via-brand-400/10 to-transparent opacity-0 group-hover:opacity-100" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-3">
          <span className="icon-tile !h-10 !w-10"><I size={18} /></span>
          <h3 className="text-xl font-extrabold uppercase tracking-tight">{s.name}</h3>
        </div>
        <p className="mt-4 text-[14px] leading-relaxed text-fg-muted">{s.text}</p>
        <ul className="mt-5 space-y-2.5">
          {s.items.map((it) => (
            <li key={it} className="flex items-center gap-2.5 text-[13.5px] text-fg/90">
              <Check size={14} className="text-ok-soft" /> {it}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center justify-between border-t border-line pt-5 mt-7">
          <Link href={`/solutions/${kind}`} className={cn("btn btn-sm", highlight ? "btn-primary" : "btn-ghost")}>
            {d.common.explore} <ArrowRight size={13} />
          </Link>
          <span className="text-[12px] text-fg-dim">{fmt(d.common.priceFrom, { p: money(price) })}</span>
        </div>
      </div>
    </motion.article>
  );
}
