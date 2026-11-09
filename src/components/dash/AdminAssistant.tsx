"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, RotateCcw, Send, User } from "lucide-react";
import { askAssistant } from "@/app/actions/assistant";
import { askCustomer } from "@/app/actions/features";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

type Turn = { role: "user" | "assistant"; text: string; error?: boolean };
const KEY = "sv_admin_ai_chat";

/** Very small Markdown subset: **bold**, `code`, bullet lists, paragraphs. Text is escaped first. */
function Md({ text }: { text: string }) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, '<code class="rounded bg-white/10 px-1">$1</code>');
  const html = text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l)))
        return `<ul class="list-disc space-y-1 pl-5">${lines.map((l) => `<li>${inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>`).join("")}</ul>`;
      if (/^#{1,4}\s/.test(lines[0])) return `<p class="font-bold">${inline(lines[0].replace(/^#+\s/, ""))}</p>${lines.slice(1).map((l) => `<p>${inline(l)}</p>`).join("")}`;
      return `<p>${lines.map(inline).join("<br/>")}</p>`;
    })
    .join("");
  return <div className="space-y-2 text-[14px] leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
}

type AskFn = (h: { role: "user" | "assistant"; text: string }[]) => Promise<{ text?: string; error?: string }>;

/** Customer variant: same chat, the customer's own read-only tools (see src/lib/customerAi.ts). */
export function CustomerAssistant({ configured }: { configured: boolean }) {
  const { d, f } = useI18n();
  const t = { ...d.dash.adminAi, ...f.ai, setupTitle: f.ai.notConfigured, setupText: "" };
  return <AdminAssistant configured={configured} ask={askCustomer} texts={t} storageKey="sv_customer_ai_chat" />;
}

export function AdminAssistant({ configured, ask = askAssistant, texts, storageKey = KEY }: { configured: boolean; ask?: AskFn; texts?: Record<string, unknown>; storageKey?: string }) {
  const { d } = useI18n();
  const t = (texts ?? d.dash.adminAi) as typeof d.dash.adminAi;
  const KEY = storageKey;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(KEY);
      if (s) setTurns(JSON.parse(s));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(turns.slice(-40)));
    } catch {}
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const send = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    const next: Turn[] = [...turns, { role: "user", text }];
    setTurns(next);
    setInput("");
    setBusy(true);
    const r = await ask(next.filter((x) => !x.error).map(({ role, text }) => ({ role, text }))).catch(() => ({ error: "network" }) as { error: string; text?: string });
    setBusy(false);
    if (r.text) setTurns((p) => [...p, { role: "assistant", text: r.text! }]);
    else setTurns((p) => [...p, { role: "assistant", text: (t.errors as Record<string, string>)[r.error ?? ""] ?? `${d.common.error} (${r.error})`, error: true }]);
  };

  if (!configured)
    return (
      <div className="card space-y-3 !rounded-[20px] p-6">
        <h2 className="text-lg font-bold">{t.setupTitle}</h2>
        <p className="text-fg-muted">{t.setupText}</p>
        <ol className="list-decimal space-y-1 pl-5 text-[14px] text-fg-muted">
          <li>{t.setup1}</li>
          <li>{t.setup2}</li>
          <li><code className="rounded bg-white/10 px-1">ANTHROPIC_API_KEY=&quot;sk-ant-…&quot;</code> — {t.setup3}</li>
        </ol>
      </div>
    );

  return (
    <div className="card flex h-[calc(100svh-210px)] min-h-[460px] flex-col !rounded-[20px]">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {turns.length === 0 && (
          <div className="mx-auto max-w-xl py-8 text-center">
            <Bot size={34} className="mx-auto text-brand-400" />
            <p className="mt-3 text-fg-muted">{t.hello}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {t.examples.map((ex) => (
                <button key={ex} onClick={() => send(ex)} className="btn btn-ghost btn-sm !h-auto !whitespace-normal py-2 text-left">{ex}</button>
              ))}
            </div>
          </div>
        )}
        {turns.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", m.role === "user" ? "bg-brand-500/25" : "bg-violet-500/25")}>{m.role === "user" ? <User size={15} /> : <Bot size={15} />}</span>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-3", m.role === "user" ? "bg-brand-500/15" : m.error ? "border border-bad/30 bg-bad/10 text-bad-soft" : "bg-white/[.04]")}>
              {m.role === "user" ? <p className="whitespace-pre-wrap text-[14px]">{m.text}</p> : <Md text={m.text} />}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-fg-dim"><Loader2 size={15} className="animate-spin" /> {t.thinking}</div>
        )}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-white/10 p-3"
      >
        <button type="button" title={t.clear} onClick={() => setTurns([])} className="btn btn-ghost !h-11 !w-11 !p-0"><RotateCcw size={16} /></button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder={t.placeholder}
          className="input max-h-40 min-h-11 flex-1 resize-y py-2.5"
        />
        <button disabled={busy || !input.trim()} className="btn btn-primary !h-11 !w-11 !p-0"><Send size={16} /></button>
      </form>
    </div>
  );
}
