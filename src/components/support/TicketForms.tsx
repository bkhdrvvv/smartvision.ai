"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { createTicket, type TicketState } from "@/app/actions/tickets";
import { useI18n } from "@/lib/i18n/client";

const KINDS = ["COMPLAINT", "QUESTION", "SUGGESTION", "TECHNICAL", "PAYMENT"] as const;

/** New appeal. `guest` adds name / email / phone (public site, not signed in). */
export function TicketForm({ guest }: { guest: boolean }) {
  const { d } = useI18n();
  const t = d.support;
  const [state, action, pending] = useActionState<TicketState, FormData>(createTicket, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="space-y-4">
      {guest && (
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block"><span className="label">{d.auth.name}</span><input name="name" required minLength={2} maxLength={80} defaultValue={f.name} className="input" autoComplete="name" /></label>
          <label className="block"><span className="label">{d.auth.phone}</span><input name="phone" required defaultValue={f.phone} placeholder="+998 90 123 45 67" className="input" autoComplete="tel" inputMode="tel" /></label>
          <label className="block"><span className="label">{d.auth.email} <span className="text-fg-dim">({t.optional})</span></span><input name="email" type="email" defaultValue={f.email} className="input" autoComplete="email" /></label>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <label className="block">
          <span className="label">{t.kind}</span>
          <select key={f.kind ?? "COMPLAINT"} name="kind" defaultValue={f.kind ?? "COMPLAINT"} className="input">
            {KINDS.map((k) => <option key={k} value={k}>{t.kinds[k]}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">{t.subject}</span><input name="subject" required minLength={3} maxLength={150} defaultValue={f.subject} className="input" /></label>
      </div>
      <label className="block"><span className="label">{t.message}</span><textarea name="message" required minLength={2} maxLength={4000} rows={5} defaultValue={f.message} className="input min-h-[140px] resize-y py-3" /></label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary btn-lg">{pending ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> {t.send}</>}</button>
    </form>
  );
}
