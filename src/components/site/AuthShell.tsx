"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Scene3D } from "@/components/three/Scene3D";

const CtaScene = dynamic(() => import("@/components/three/scenes/ProductScenes").then((m) => m.CtaScene), { ssr: false });

export function AuthShell({ title, text, hint, children }: { title: string; text: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="relative min-h-[100svh] overflow-hidden pt-28 pb-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_75%_40%,rgba(37,99,235,.25),transparent_70%)]" />
      <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-5 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="glass mx-auto w-full max-w-[480px] rounded-3xl p-7 sm:p-9">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 mb-7 text-sm text-fg-muted">{text}</p>
          {children}
          {hint && <p className="mt-6 border-t border-line pt-4 text-center text-[11px] text-fg-dim">{hint}</p>}
        </motion.div>
        <Scene3D eager className="hidden h-[560px] lg:block" camera={{ position: [0, 0.6, 9], fov: 32 }}>
          <CtaScene />
        </Scene3D>
      </div>
    </section>
  );
}
