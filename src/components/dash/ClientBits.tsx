"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/format";

export function RangeTabs({ value, options, param = "range" }: { value: string; options: string[]; param?: string }) {
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <div className="flex rounded-xl border border-line-strong bg-ink-850 p-1">
      {options.map((o) => {
        const q = new URLSearchParams(sp.toString());
        q.set(param, o);
        return (
          <Link key={o} href={`${path}?${q.toString()}`} scroll={false} className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", value === o ? "bg-brand-500/25 text-fg" : "text-fg-muted hover:text-fg")}>
            {o.toUpperCase()}
          </Link>
        );
      })}
    </div>
  );
}

/** Button that runs a bound server action */
export function ActionButton({ action, children, className, confirm }: { action: () => Promise<unknown>; children: React.ReactNode; className?: string; confirm?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          await action();
        });
      }}
      className={className}
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  );
}
