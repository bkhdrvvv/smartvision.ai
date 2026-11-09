"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/format";

export function SectionTitle({ eyebrow, a, b, text, align = "center", className }: { eyebrow: string; a: string; b: string; text?: string; align?: "center" | "left"; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className={cn(align === "center" ? "mx-auto text-center" : "", "max-w-3xl", className)}
    >
      <span className={cn("eyebrow", align === "left" && "eyebrow-left")}>{eyebrow}</span>
      <h2 className="display mt-5 text-[clamp(36px,5.4vw,64px)]">
        <span className="block">{a}</span>
        <span className="grad-blue block pb-1">{b}</span>
      </h2>
      {text && <p className="mt-5 text-[16px] text-fg-muted">{text}</p>}
    </motion.div>
  );
}
