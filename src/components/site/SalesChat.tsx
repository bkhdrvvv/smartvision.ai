"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";
import { askSales } from "@/app/actions/sales";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/format";

type Turn = { role: "user" | "assistant"; text: string; error?: boolean };

/** Floating AI consultant on the public website. */
export function SalesChat({ phone }: { phone: string }) {
  const { f } = useI18n();
  const x = f.x;
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns, busy]);

  const send = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    const next: Turn[] = [...turns, { role: "user", text }];
    setTurns(next);
    setInput("");
    setBusy(true);
    const r = await askSales(next.filter((t) => !t.error).map(({ role, text }) => ({ role, text }))).catch(() => ({ error: "network" }) as { text?: string; error?: string });
    setBusy(false);
    setTurns((p) => [...p, r.text ? { role: "assistant", text: r.text } : { role: "assistant", text: fmt(x.salesErr, { p: phone }), error: true }]);
  };

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-[70] flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2563eb,#7c3aed)] px-4 py-3 text-[14px] font-semibold text-white shadow-[0_10px_40px_-8px_rgba(99,102,241,.8)]" aria-label={x.salesTitle}>
        <MessageCircle size={18} /> <span className="hidden sm:inline">{x.salesBtn}</span>
      </button>
    );
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex h-[min(560px,calc(100svh-32px))] w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1020]/97 shadow-2xl backdrop-blur" role="dialog" aria-label={x.salesTitle}>
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/25"><Bot size={16} /></span>
        <span className="flex-1 font-semibold">{x.salesTitle}</span>
        <button onClick={() => setOpen(false)} aria-label="close" className="text-fg-dim hover:text-fg"><X size={18} /></button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-[14px]">
        <div className="rounded-2xl bg-white/[.05] px-3.5 py-2.5">{x.salesHello}</div>
        {turns.length === 0 && (
          <div className="flex flex-col gap-2">
            {x.salesEx.map((e) => <button key={e} onClick={() => send(e)} className="btn btn-ghost btn-sm !h-auto !justify-start !whitespace-normal py-2 text-left">{e}</button>)}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={cn("max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5", t.role === "user" ? "ml-auto bg-brand-500/20" : t.error ? "border border-amber-400/30 bg-amber-400/10" : "bg-white/[.05]")}>{t.text.replace(/\*\*(.+?)\*\*/g, "$1")}</div>
        ))}
        {busy && <div className="flex items-center gap-2 text-fg-dim"><Loader2 size={14} className="animate-spin" /> …</div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-white/10 p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1500} placeholder={x.salesPh} className="input flex-1" />
        <button disabled={busy || !input.trim()} className="btn btn-primary !w-11 !p-0" aria-label="send"><Send size={16} /></button>
      </form>
    </div>
  );
}
