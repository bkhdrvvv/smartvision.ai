"use client";

import { BadgePercent } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

/** Monthly / Yearly switch. Yearly shows the "up to 50 000" saving hint. */
export function BillingToggle({ months, onChange, center = false }: { months: 1 | 12; onChange: (m: 1 | 12) => void; center?: boolean }) {
  const { f } = useI18n();
  return (
    <div className={cn("flex flex-wrap items-center gap-3", center && "justify-center")}>
      <div className="glass inline-flex rounded-2xl p-1" role="tablist">
        {([1, 12] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={months === m}
            onClick={() => onChange(m)}
            className={cn("rounded-xl px-4 py-2 text-[13.5px] font-semibold transition-colors", months === m ? "border border-brand-400/40 bg-brand-500/15 text-fg" : "text-fg-muted hover:text-fg")}
          >
            {m === 1 ? f.bill.monthly : f.bill.yearly}
          </button>
        ))}
      </div>
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ok-soft"><BadgePercent size={15} /> {f.bill.hint}</span>
    </div>
  );
}
