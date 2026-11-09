"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyField({ value, copy, copied }: { value: string; copy: string; copied: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={value} className="input min-w-0 flex-1 font-mono text-[13px]" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        onClick={() => { navigator.clipboard?.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); }}
        className="btn btn-ghost shrink-0"
      >
        {ok ? <Check size={15} /> : <Copy size={15} />} {ok ? copied : copy}
      </button>
    </div>
  );
}
