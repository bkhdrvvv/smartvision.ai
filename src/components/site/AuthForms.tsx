"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Mail, MailCheck, ShieldCheck } from "lucide-react";
import { cancelSignup, loginAction, registerAction, signupEmailAction, type FormState } from "@/app/actions/auth";
import { useI18n } from "@/lib/i18n/client";
import { ConsentCheckbox } from "./LegalBits";
import { cn } from "@/lib/format";

function PasswordInput({ name, autoComplete, minLength, invalid }: { name: string; autoComplete: string; minLength?: number; invalid?: boolean }) {
  const { d } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength} className={cn("input !pr-11", invalid && "!border-bad/70")} aria-invalid={invalid || undefined} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-fg-dim hover:text-fg" aria-label={show ? d.auth.hidePassword : d.auth.showPassword} title={show ? d.auth.hidePassword : d.auth.showPassword}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function CodeInput({ name = "code" }: { name?: string }) {
  return <input name={name} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus className="input text-center font-mono text-2xl tracking-[0.4em]" placeholder="000000" />;
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return <button disabled={pending} className="btn btn-primary btn-lg w-full">{pending ? <Loader2 className="animate-spin" size={16} /> : children}</button>;
}

/** Google "G" mark (official colours) */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function GoogleButton({ next, plan }: { next?: string; plan?: string }) {
  const { d } = useI18n();
  const q = new URLSearchParams();
  if (next) q.set("next", next);
  if (plan) q.set("plan", plan);
  return (
    <>
      {/* plain link: a full-page navigation to Google is required */}
      <a href={`/api/auth/google${q.size ? `?${q}` : ""}`} className="btn btn-ghost btn-lg w-full !bg-white/[.04]">
        <GoogleMark /> {d.auth.google}
      </a>
      <div className="my-5 flex items-center gap-3 text-[12px] uppercase tracking-wider text-fg-dim">
        <span className="h-px flex-1 bg-white/10" /> {d.auth.or} <span className="h-px flex-1 bg-white/10" />
      </div>
    </>
  );
}

export function LoginForm({ next, google, initial2fa, initialError }: { next?: string; google: boolean; initial2fa?: boolean; initialError?: string }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, initial2fa ? { need2fa: true } : initialError ? { error: initialError } : undefined);
  const [tab, setTab] = useState<"password" | "code">(state?.fields?.mode === "code" ? "code" : "password");
  const email = state?.fields?.email;

  if (state?.need2fa)
    return (
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <input type="hidden" name="mode" value="2fa" />
        <div className="flex items-start gap-3 rounded-xl border border-brand-400/30 bg-brand-500/10 p-4 text-sm">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-400" />
          <span>{d.auth.codeHint}</span>
        </div>
        <Field label={d.auth.code}><CodeInput /></Field>
        {state.error && <p className="err" role="alert">{state.error}</p>}
        <Submit pending={pending}>{d.auth.signIn} <ArrowRight size={16} /></Submit>
        <Link href="/login" className="block text-center text-sm text-fg-muted hover:text-fg">{d.common.back}</Link>
      </form>
    );

  if (tab === "code" && state?.codeSent && email)
    return (
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <input type="hidden" name="mode" value="code-verify" />
        <input type="hidden" name="email" value={email} />
        <div className="flex items-start gap-3 rounded-xl border border-brand-400/30 bg-brand-500/10 p-4 text-sm">
          <MailCheck size={18} className="mt-0.5 shrink-0 text-brand-400" />
          <span>{d.auth.codeSentLogin.replace("{e}", email)}</span>
        </div>
        <Field label={d.auth.emailCode}><CodeInput /></Field>
        {state.error && <p className="err" role="alert">{state.error}</p>}
        <Submit pending={pending}>{d.auth.signIn} <ArrowRight size={16} /></Submit>
        <div className="flex justify-between text-sm">
          <button type="submit" formNoValidate name="resend" value="1" className="text-fg-muted hover:text-brand-400">{d.auth.resendCode}</button>
          <button type="button" onClick={() => location.assign("/login")} className="text-fg-muted hover:text-brand-400">{d.auth.changeEmail}</button>
        </div>
      </form>
    );

  return (
    <div>
      {google && <GoogleButton next={next} />}
      <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/10 bg-white/[.03] p-1 text-sm">
        {(["password", "code"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn("flex items-center justify-center gap-2 rounded-lg py-2 font-semibold transition", tab === k ? "bg-brand-500/20 text-fg" : "text-fg-muted hover:text-fg")}>
            {k === "password" ? <KeyRound size={15} /> : <Mail size={15} />} {k === "password" ? d.auth.password : d.auth.emailCodeTab}
          </button>
        ))}
      </div>
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <input type="hidden" name="mode" value={tab === "code" ? "code-send" : "password"} />
        <Field label={d.auth.email}>
          <input name="email" type="email" autoComplete="email" required defaultValue={email} className="input" />
        </Field>
        {tab === "password" ? (
          <Field label={d.auth.password} hint={google ? d.auth.sitePasswordHint : undefined}><PasswordInput name="password" autoComplete="current-password" /></Field>
        ) : (
          <p className="text-[13px] text-fg-muted">{d.auth.emailCodeHint}</p>
        )}
        {state?.error && <p className="err" role="alert">{state.error}</p>}
        <Submit pending={pending}>{tab === "code" ? d.auth.sendCode : d.auth.signIn} <ArrowRight size={16} /></Submit>
        <p className="text-center text-sm text-fg-muted">
          {d.auth.noAccount} <Link href="/register" className="font-semibold text-brand-400 hover:underline">{d.auth.signUp}</Link>
        </p>
      </form>
    </div>
  );
}

/** Sign-up step 1: the account can only be created for an email that received our code. */
export function SignupEmailForm({ plan, google }: { plan?: string; google: boolean }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(signupEmailAction, undefined);
  const email = state?.fields?.email;
  const sent = state?.codeSent && email;
  return (
    <div>
      <p className="mb-4 text-[12px] font-semibold uppercase tracking-wider text-brand-400">{d.auth.step1}</p>
      {google && !sent && <GoogleButton plan={plan} />}
      <form action={action} className="space-y-4">
        <input type="hidden" name="plan" value={plan ?? ""} />
        {sent ? (
          <>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="mode" value="verify" />
            <div className="flex items-start gap-3 rounded-xl border border-brand-400/30 bg-brand-500/10 p-4 text-sm">
              <MailCheck size={18} className="mt-0.5 shrink-0 text-brand-400" />
              <span>{d.auth.codeSentRegister.replace("{e}", email)}</span>
            </div>
            <Field label={d.auth.emailCode}><CodeInput /></Field>
          </>
        ) : (
          <>
            <input type="hidden" name="mode" value="send" />
            <Field label={d.auth.email} hint={d.auth.emailWhy}>
              <input name="email" type="email" autoComplete="email" required defaultValue={email} className={cn("input", state?.fieldErrors?.includes("email") && "!border-bad/70")} />
            </Field>
          </>
        )}
        {state?.error && <p className="err" role="alert">{state.error}</p>}
        <Submit pending={pending}>{sent ? d.auth.confirmCode : d.auth.sendCode} <ArrowRight size={16} /></Submit>
        {sent && (
          <div className="flex justify-between text-sm">
            <button type="submit" formNoValidate name="resend" value="1" className="text-fg-muted hover:text-brand-400">{d.auth.resendCode}</button>
            <button type="button" onClick={() => location.reload()} className="text-fg-muted hover:text-brand-400">{d.auth.changeEmail}</button>
          </div>
        )}
        <p className="text-center text-sm text-fg-muted">
          {d.auth.haveAccount} <Link href="/login" className="font-semibold text-brand-400 hover:underline">{d.auth.signIn}</Link>
        </p>
      </form>
    </div>
  );
}

/** Sign-up step 2: details. The email is fixed (already proven by the code or by Google). */
export function RegisterForm({ plan, service, email, google, googleName }: { plan?: string; service?: string; email: string; google: boolean; googleName?: string }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, undefined);
  const [mismatch, setMismatch] = useState(false);
  const f = state?.fields ?? {};
  const bad = (k: string) => state?.fieldErrors?.includes(k);
  const inputCls = (k: string) => cn("input", bad(k) && "!border-bad/70");
  return (
    <div>
      <p className="mb-4 text-[12px] font-semibold uppercase tracking-wider text-brand-400">{d.auth.step2}</p>
      <form action={cancelSignup} className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-ok/30 bg-ok/[.07] p-3 text-sm">
        <input type="hidden" name="plan" value={plan ?? ""} />
        <span className="flex min-w-0 items-center gap-2">{google ? <GoogleMark /> : <MailCheck size={16} className="shrink-0 text-ok-soft" />}<span className="truncate">{d.auth.emailConfirmed.replace("{e}", email)}</span></span>
        <button className="shrink-0 text-fg-muted hover:text-brand-400">{d.auth.changeEmail}</button>
      </form>
      <form
        action={action}
        onSubmit={(e) => {
          // catch a typo before sending — otherwise both password fields would have to be typed again
          const fd = new FormData(e.currentTarget);
          const bad = fd.get("password") !== fd.get("password2");
          setMismatch(bad);
          if (bad) e.preventDefault();
        }}
        className="space-y-4"
      >
        <input type="hidden" name="plan" value={plan ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={d.auth.name}><input name="name" required minLength={2} defaultValue={f.name ?? googleName} className={inputCls("name")} autoComplete="name" /></Field>
          <Field label={d.auth.phone}><input name="phone" required defaultValue={f.phone} placeholder="+998 90 123 45 67" className={inputCls("phone")} autoComplete="tel" inputMode="tel" /></Field>
        </div>
        <Field label={d.auth.orgName}><input name="orgName" required minLength={2} defaultValue={f.orgName} className={inputCls("orgName")} autoComplete="organization" /></Field>
        <Field label={d.auth.service}>
          {/* key: remount so the chosen value survives React's form reset after an error */}
          <select key={f.service ?? service ?? "SCHOOL"} name="service" defaultValue={f.service ?? service ?? "SCHOOL"} className="input">
            <option value="SCHOOL">Smart School</option>
            <option value="HOME">Smart Home</option>
            <option value="FARM">Smart Farm</option>
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={d.auth.password} hint={google ? d.auth.googlePasswordHint : d.auth.passwordMin}><PasswordInput name="password" autoComplete="new-password" minLength={8} invalid={bad("password") || mismatch} /></Field>
          <Field label={d.auth.password2}><PasswordInput name="password2" autoComplete="new-password" minLength={8} invalid={bad("password2") || mismatch} /></Field>
        </div>
        {mismatch ? <p className="err" role="alert">{d.auth.passwordMismatch}</p> : state?.error && <p className="err" role="alert">{state.error}</p>}
        <ConsentCheckbox invalid={bad("terms")} />
        <Submit pending={pending}>{d.auth.signUp} <ArrowRight size={16} /></Submit>
      </form>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-fg-dim">{hint}</span>}
    </label>
  );
}
