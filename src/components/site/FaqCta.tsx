"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Scene3D } from "@/components/three/Scene3D";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

const CtaScene = dynamic(() => import("@/components/three/scenes/ProductScenes").then((m) => m.CtaScene), { ssr: false });

export function Faq() {
  const { d } = useI18n();
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="mx-auto grid max-w-[1240px] scroll-mt-24 gap-12 px-5 py-28 md:py-36 lg:grid-cols-[1fr_1.6fr]">
      <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
        <span className="eyebrow">{d.faq.eyebrow}</span>
        <h2 className="mt-5 font-display text-[clamp(36px,4.5vw,52px)] font-extrabold leading-[1] tracking-tight">
          {d.faq.title1}
          <br />
          <span className="grad-blue">{d.faq.title2}</span>
        </h2>
        <p className="mt-5 max-w-sm text-fg-muted">{d.faq.text}</p>
        <Link href="/contact" className="btn btn-ghost mt-7">{d.faq.contact} <ArrowRight size={14} /></Link>
      </motion.div>
      <div className="space-y-3">
        {d.faq.items.map((f, i) => {
          const on = open === i;
          return (
            <div key={f.q} className={cn("card overflow-hidden transition-colors", on && "!border-brand-400/40")}>
              <button onClick={() => setOpen(on ? -1 : i)} aria-expanded={on} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[15px] font-semibold">
                {f.q}
                <ChevronDown size={16} className={cn("shrink-0 text-fg-dim transition-transform duration-300", on && "rotate-180 text-brand-400")} />
              </button>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                    <p className="px-6 pb-6 text-[14px] leading-relaxed text-fg-muted">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Cta() {
  const { d } = useI18n();
  return (
    <section className="mx-auto max-w-[1240px] px-5 pb-28">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="card relative grid overflow-hidden !rounded-[28px] bg-[radial-gradient(60%_80%_at_75%_40%,rgba(37,99,235,.35),transparent_70%),radial-gradient(40%_50%_at_100%_100%,rgba(124,92,255,.25),transparent)] lg:grid-cols-2"
      >
        <div className="relative z-10 p-8 sm:p-14">
          <span className="chip mb-7 uppercase tracking-[0.18em] !text-[11px]"><span className="dot dot-live" /> {d.cta.badge}</span>
          <h2 className="display break-words text-[clamp(28px,8vw,68px)] sm:text-[clamp(40px,5.5vw,68px)]">
            <span className="block">{d.cta.title1}</span>
            <span className="block">{d.cta.title2}</span>
            <span className="grad-text block pb-1">{d.cta.title3}</span>
          </h2>
          <p className="mt-6 text-fg-muted">{d.cta.text}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn btn-primary btn-lg">{d.cta.primary} <ArrowRight size={16} /></Link>
            <Link href="/contact" className="btn btn-ghost btn-lg">{d.cta.secondary}</Link>
          </div>
        </div>
        <Scene3D className="h-[300px] lg:h-auto" camera={{ position: [0, 0.6, 9], fov: 32 }}>
          <CtaScene />
        </Scene3D>
      </motion.div>
    </section>
  );
}
