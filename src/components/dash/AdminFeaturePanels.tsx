"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { botTest, saveBotToken, savePromo } from "@/app/actions/features";
import type { ActionResult } from "@/app/actions/customer";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";

export function BotPanel({ username }: { username: string | null }) {
  const { f } = useI18n();
  const b = f.bot;
  const [state, run, pending] = useActionState<ActionResult, FormData>(saveBotToken, undefined);
  const [msg, setMsg] = useState<ActionResult>(undefined);
  const [busy, start] = useTransition();
  return (
    <div className="space-y-3">
      <span className={`chip ${username ? "chip-ok" : "chip-warn"}`}>{username ? fmt(b.ok, { u: username }) : b.none}</span>
      <form action={run} className="space-y-3">
        <label className="block">
          <span className="label">{b.token}</span>
          <input name="token" type="password" autoComplete="off" placeholder="1234567890:AA…" className="input font-mono" />
        </label>
        <p className="text-[12px] text-fg-dim">{b.tokenHint}</p>
        {state?.error && <p className="err">{state.error}</p>}
        {state?.ok && state.message && <p className="text-sm text-ok-soft">{state.message}</p>}
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} className="btn btn-primary">{pending ? <Loader2 size={15} className="animate-spin" /> : b.save}</button>
          {username && <button name="remove" value="1" className="btn btn-ghost">{b.remove}</button>}
        </div>
      </form>
      {username && (
        <div className="border-t border-line pt-3">
          <button disabled={busy} onClick={() => start(async () => setMsg(await botTest()))} className="btn btn-ghost btn-sm"><Send size={14} /> {b.test}</button>
          {msg?.error && <p className="err mt-2">{msg.error}</p>}
          {msg?.ok && <p className="mt-2 text-sm text-ok-soft">{msg.message}</p>}
        </div>
      )}
    </div>
  );
}

export function PromoPanel({ text, link, until }: { text: string; link: string; until: string }) {
  const { f } = useI18n();
  const p = f.promo;
  const [state, run, pending] = useActionState<ActionResult, FormData>(savePromo, undefined);
  return (
    <form action={run} className="space-y-3">
      <label className="block"><span className="label">{p.text}</span><input name="text" defaultValue={text} maxLength={200} className="input" placeholder="🎉 Noyabr aksiyasi: birinchi oy 20% chegirma — kod NOYABR20" /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">{p.link}</span><input name="link" defaultValue={link} className="input" placeholder="/pricing" /></label>
        <label className="block"><span className="label">{p.until}</span><input name="until" type="date" defaultValue={until} className="input" /></label>
      </div>
      {state?.error && <p className="err">{state.error}</p>}
      {state?.ok && <p className="text-sm text-ok-soft">{p.saved}</p>}
      <button disabled={pending} className="btn btn-primary">{pending ? <Loader2 size={15} className="animate-spin" /> : p.save}</button>
    </form>
  );
}
