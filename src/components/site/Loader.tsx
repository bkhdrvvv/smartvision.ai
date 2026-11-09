"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/** Premium entrance: rotating 3D-ish lens rings + progress, fades into the hero once WebGL is ready. */
export function Loader() {
  const [show, setShow] = useState(false);
  const [p, setP] = useState(0);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("sv_intro") === "1";
    } catch {}
    if (seen) return;
    setShow(true);
    document.documentElement.style.overflow = "hidden";
    let ready = false;
    const start = performance.now();
    const onReady = () => (ready = true);
    window.addEventListener("sv:scene-ready", onReady);
    let raf = 0;
    let done = false;
    // progress follows the clock, not the frame count: slow / throttled devices must not see a stuck loader
    const tick = () => {
      const t = performance.now() - start;
      const target = ready ? 100 : Math.min(88, (t / 1800) * 88);
      setP((cur) => Math.max(cur, ready ? cur + (100 - cur) * 0.25 : target));
      if (ready && t > 900) return finish();
      raf = requestAnimationFrame(tick);
    };
    // hard limit: the visitor sees the site after 2.5 s at most, even if the 3D scene is still loading
    const hard = setTimeout(() => finish(), 2500);
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(hard);
      setP(100);
      setTimeout(() => {
        setShow(false);
        document.documentElement.style.overflow = "";
        try {
          sessionStorage.setItem("sv_intro", "1");
        } catch {}
      }, 250);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hard);
      window.removeEventListener("sv:scene-ready", onReady);
      document.documentElement.style.overflow = "";
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-ink-950"
          exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
          transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
          role="progressbar"
          aria-valuenow={Math.round(p)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="flex flex-col items-center [perspective:600px]">
            <div className="relative h-28 w-28 [transform-style:preserve-3d]">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute inset-0 rounded-full border-2"
                  style={{ borderColor: ["#5b9dff", "#22d3ee", "#7c5cff"][i], opacity: 0.8 - i * 0.2, inset: i * 10 }}
                  animate={{ rotateX: [0, 360], rotateY: [i * 40, 360 + i * 40] }}
                  transition={{ duration: 3 + i, repeat: Infinity, ease: "linear" }}
                />
              ))}
              <span className="absolute inset-[42px] rounded-full bg-white shadow-[0_0_30px_8px_rgba(91,157,255,.8)]" />
            </div>
            <div className="mt-10 text-sm font-bold tracking-[0.3em]">
              SMARTVISION <span className="text-brand-400">AI</span>
            </div>
            <div className="mt-5 h-[2px] w-48 overflow-hidden rounded bg-white/10">
              <div className="h-full bg-gradient-to-r from-brand-500 to-cyan-400" style={{ width: `${p}%` }} />
            </div>
            <div className="mt-3 font-mono text-[11px] text-fg-dim">{String(Math.round(p)).padStart(3, "0")}%</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
