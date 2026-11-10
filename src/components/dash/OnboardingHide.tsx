"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/** Lets the customer hide the first-steps card (remembered in this browser for 30 days). */
export function OnboardingHide({ label, children }: { label: string; children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem("sv_onboard_x"));
      if (v && Date.now() - v < 30 * 86400_000) setHidden(true);
    } catch {}
  }, []);
  if (hidden) return null;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => { try { localStorage.setItem("sv_onboard_x", String(Date.now())); } catch {} setHidden(true); }}
        className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg text-fg-dim hover:bg-white/5 hover:text-fg"
      >
        <X size={15} />
      </button>
      {children}
    </div>
  );
}
