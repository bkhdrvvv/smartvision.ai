"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound, Loader2, LogOut, ShieldCheck, ShieldOff } from "lucide-react";
import { changePassword, confirm2fa, disable2fa, signOutEverywhere, start2fa, type AccountResult } from "@/app/actions/account";
import { useI18n } from "@/lib/i18n/client";

/** Password change · sign out other devices · authenticator-app 2FA — shared by customer and admin settings */
export function SecurityPanel({ twofaEnabled }: { twofaEnabled: boolean }) {
  const { d } = useI18n();
  const a = d.auth;
  const [pw, pwAction, pwPending] = useActionState<AccountResult, FormData>(changePassword, undefined);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(twofaEnabled);
  const [setup, setSetup] = useState<{ secret: string; url: string } | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const run = async (fn: () => Promise<AccountResult>, after?: (r: AccountResult) => void) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    setMsg({ ok: !!r?.ok, t: r?.message ?? r?.error ?? d.common.error });
    if (r?.ok) after?.(r);
  };

  return (
    <div className="space-y-6">
      {/* password */}
      <form action={pwAction} className="space-y-3">
        <div className="flex items-center gap-2 font-semibold"><KeyRound size={16} className="text-brand-400" /> {d.dash.settingsPage.password}</div>
        <input name="current" type="password" autoComplete="current-password" required placeholder={d.dash.settingsPage.current} className="input" />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="next" type="password" autoComplete="new-password" minLength={8} required placeholder={d.dash.settingsPage.next} className="input" />
          <input name="next2" type="password" autoComplete="new-password" minLength={8} required placeholder={a.password2} className="input" />
        </div>
        <p className="text-[12px] text-fg-dim">{a.passwordChangeHint}</p>
        {pw?.error && <p className="err">{pw.error}</p>}
        {pw?.ok && <p className="text-sm text-ok-soft">{pw.message}</p>}
        <button disabled={pwPending} className="btn btn-primary">{pwPending ? <Loader2 size={15} className="animate-spin" /> : d.common.save}</button>
      </form>

      {/* other devices */}
      <div className="border-t border-line pt-5">
        <button disabled={busy} onClick={() => run(signOutEverywhere)} className="btn btn-ghost"><LogOut size={15} /> {a.signOutOthers}</button>
      </div>

      {/* 2FA */}
      <div className="space-y-3 border-t border-line pt-5">
        <div className="flex items-center gap-2 font-semibold">
          {enabled ? <ShieldCheck size={16} className="text-ok-soft" /> : <ShieldOff size={16} className="text-fg-dim" />} {a.twofaTitle}
          <span className={`chip !h-6 ${enabled ? "chip-ok" : ""}`}>{enabled ? a.twofaStateOn : a.twofaStateOff}</span>
        </div>
        <p className="text-[13px] text-fg-muted">{a.twofaText}</p>

        {!enabled && !setup && (
          <button disabled={busy} onClick={() => run(start2fa, (r) => setSetup({ secret: r!.secret!, url: r!.url! }))} className="btn btn-ghost !border-brand-400/40 text-brand-300">
            <ShieldCheck size={15} /> {a.twofaEnable}
          </button>
        )}

        {setup && (
          <div className="space-y-3 rounded-2xl border border-brand-400/30 bg-brand-500/5 p-4">
            <ol className="list-decimal space-y-1 pl-5 text-[13px] text-fg-muted">
              <li>{a.twofaStep1}</li>
              <li>{a.twofaStep2}</li>
            </ol>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg bg-ink-950 p-2 text-center font-mono text-[15px] tracking-widest">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(setup.secret);
                  setCopied(true);
                }}
                className="btn btn-ghost btn-sm"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <a href={setup.url} className="block text-center text-[12px] text-brand-400 hover:underline">{a.twofaOpenApp}</a>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={7} placeholder="000000" className="input text-center font-mono text-xl tracking-[0.4em]" />
            <button disabled={busy || code.replace(/\D/g, "").length !== 6} onClick={() => run(() => confirm2fa(code), () => { setEnabled(true); setSetup(null); setCode(""); })} className="btn btn-primary w-full">
              {busy ? <Loader2 size={15} className="animate-spin" /> : a.twofaConfirm}
            </button>
          </div>
        )}

        {enabled && (
          <div className="flex flex-wrap gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={7} placeholder="000000" className="input !w-40 text-center font-mono tracking-[0.3em]" aria-label={a.code} />
            <button disabled={busy || code.replace(/\D/g, "").length !== 6} onClick={() => run(() => disable2fa(code), () => { setEnabled(false); setCode(""); })} className="btn btn-bad">
              <ShieldOff size={15} /> {a.twofaDisable}
            </button>
          </div>
        )}
      </div>

      {msg && <p className={`text-sm ${msg.ok ? "text-ok-soft" : "text-bad-soft"}`}>{msg.t}</p>}
    </div>
  );
}
