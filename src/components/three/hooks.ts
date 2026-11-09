"use client";

import { useEffect, useState } from "react";

export function useWebGL() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setOk(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

export type Tier = "low" | "mid" | "high";

/** Rough device capability tier: phones / ≤4 cores / save-data → low */
export function useDeviceTier(): Tier {
  const [tier, setTier] = useState<Tier>("mid");
  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 4;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const small = window.matchMedia("(max-width: 768px)").matches;
    if (saveData || cores <= 4 || mem <= 4 || small) setTier("low");
    else if (cores >= 8 && mem >= 8) setTier("high");
    else setTier("mid");
  }, []);
  return tier;
}

export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}
