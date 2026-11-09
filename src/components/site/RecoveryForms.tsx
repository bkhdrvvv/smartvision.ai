"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { requestPasswordReset, resendVerification, resetPassword, type FormState } from "@/app/actions/auth";
import { Field } from "./AuthForms";
import { useI18n } from "@/lib/i18n/client";

type S = (FormState) | undefined;

export function ForgotForm() {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<S, FormData>(requestPasswordReset, undefined);
  if (state?.ok)
    return (
      <div className="space-y-4 text-center">
        <MailCheck size={40} className="mx-auto text-ok-soft" />
        <p className="text-fg-muted">{d.auth.resetSent}</p>
        <Link href="/login" className="btn btn-ghost">{d.auth.signIn}</Link>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <Field label={d.auth.email}><input name="email" type="email" required autoComplete="email" className="input" /></Field>
      {state?.error && <p className="err">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary btn-lg w-full">{pending ? <Loader2 size={16} className="animate-spin" /> : d.auth.resetSend}</button>
      <Link href="/login" className="block text-center text-sm text-fg-muted hover:text-fg">{d.common.back}</Link>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<S, FormData>(resetPassword, undefined);
  if (state?.ok)
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 size={40} className="mx-auto text-ok-soft" />
        <p className="text-fg-muted">{d.auth.resetDone}</p>
        <Link href="/login" className="btn btn-primary">{d.auth.signIn}</Link>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="t" value={token} />
      <Field label={d.auth.newPassword} hint={d.auth.passwordMin}><input name="password" type="password" minLength={8} required autoComplete="new-password" className="input" /></Field>
      <Field label={d.auth.password2}><input name="password2" type="password" minLength={8} required autoComplete="new-password" className="input" /></Field>
      {state?.error && <p className="err">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary btn-lg w-full">{pending ? <Loader2 size={16} className="animate-spin" /> : d.common.save}</button>
    </form>
  );
}

/** Banner for unverified accounts (dashboard) */
export function VerifyBanner({ email }: { email: string }) {
  const { d } = useI18n();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-brand-400/30 bg-brand-500/[.08] px-4 py-3 pl-16 text-[14px] sm:px-8 lg:pl-8">
      <MailCheck size={16} className="shrink-0 text-brand-400" />
      <span className="flex-1">{msg ?? d.auth.verifyBanner.replace("{e}", email)}</span>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await resendVerification();
          setBusy(false);
          setMsg(r?.error ?? d.auth.verifyResent);
        }}
        className="btn btn-ghost btn-sm"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : d.auth.verifyResend}
      </button>
    </div>
  );
}
