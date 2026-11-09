"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { contactAction, type ContactState } from "@/app/actions/contact";
import { Field } from "./AuthForms";
import { useI18n } from "@/lib/i18n/client";

export function ContactForm() {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<ContactState, FormData>(contactAction, undefined);
  if (state?.ok)
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <CheckCircle2 size={44} className="text-ok-soft" />
        <p className="text-lg font-semibold">{d.contact.sent}</p>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={d.contact.name}><input name="name" required minLength={2} className="input" /></Field>
        <Field label={d.contact.phone}><input name="phone" required placeholder="+998 90 123 45 67" className="input" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={d.contact.email}><input name="email" type="email" className="input" /></Field>
        <Field label={d.contact.service}>
          <select name="service" className="input" defaultValue="">
            <option value="">—</option>
            <option value="SCHOOL">Smart School</option>
            <option value="HOME">Smart Home</option>
            <option value="FARM">Smart Farm</option>
          </select>
        </Field>
      </div>
      <Field label={d.contact.message}><textarea name="message" required minLength={5} rows={5} className="input" /></Field>
      {state?.error && <p className="err">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary btn-lg w-full sm:w-auto">
        {pending ? <Loader2 size={16} className="animate-spin" /> : <><Send size={15} /> {d.contact.send}</>}
      </button>
    </form>
  );
}
