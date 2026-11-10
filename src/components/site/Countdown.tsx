"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";

/** "3 kun 4 soat 12 daqiqa qoldi" until the end of the given day (Tashkent time). */
export function Countdown({ until }: { until: string }) {
  const { f } = useI18n();
  const end = new Date(`${until}T23:59:59+05:00`).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);
  if (now === null) return null; // render on the client only (no server/client clock mismatch)
  const left = end - now;
  if (left <= 0) return <span className="opacity-80">· {f.y.promoEnded}</span>;
  const d = Math.floor(left / 86400_000), h = Math.floor((left % 86400_000) / 3600_000), m = Math.floor((left % 3600_000) / 60_000);
  return <span className="shrink-0 rounded-md bg-black/25 px-2 py-0.5 font-mono font-semibold">⏳ {fmt(f.y.promoLeft, { d, h, m })}</span>;
}
