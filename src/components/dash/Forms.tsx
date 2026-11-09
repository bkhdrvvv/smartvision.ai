"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/app/actions/customer";
import { useI18n } from "@/lib/i18n/client";

type Field = { name: string; label: string; type?: string; defaultValue?: string; required?: boolean; placeholder?: string };

/** Generic small form bound to a server action returning ActionResult */
export function ActionForm({ action, fields, submit }: { action: (s: ActionResult, f: FormData) => Promise<ActionResult>; fields: Field[]; submit?: string }) {
  const { d } = useI18n();
  const [state, run, pending] = useActionState<ActionResult, FormData>(action, undefined);
  return (
    <form action={run} className="space-y-4">
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="label">{f.label}</span>
          <input name={f.name} type={f.type ?? "text"} defaultValue={f.defaultValue} required={f.required} placeholder={f.placeholder} className="input" />
        </label>
      ))}
      {state?.error && <p className="err">{state.error}</p>}
      {state?.ok && <p className="text-sm text-ok-soft">{state.message ?? d.common.saved}</p>}
      <button disabled={pending} className="btn btn-primary">{pending ? <Loader2 size={15} className="animate-spin" /> : submit ?? d.common.save}</button>
    </form>
  );
}
