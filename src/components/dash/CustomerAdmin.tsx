"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Copy, KeyRound, Loader2, LogOut, MailCheck, Save, ShieldCheck, Trash2 } from "lucide-react";
import { adminResetPassword, adminSignOutUser, adminVerifyEmail, deleteCustomer, setCustomerBlocked, updateCustomer } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/customer";
import { useI18n } from "@/lib/i18n/client";

type C = { orgId: string; orgName: string; orgPhone: string; service: string; userId: string; userName: string; email: string; verified: boolean; blockedAt: string | null; blockReason: string };

export function CustomerAdmin({ c }: { c: C }) {
  const { d } = useI18n();
  const t = d.dash.adminCustomer;
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(updateCustomer.bind(null, c.orgId), undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState(c.blockReason);

  const run = async (key: string, fn: () => Promise<ActionResult>, ok: string) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    setMsg({ ok: !!r?.ok, t: r?.ok ? ok : `${d.common.error} (${r?.error})` });
    if (r?.ok) router.refresh();
    return r;
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <form action={action} className="card space-y-4 !rounded-[20px] p-6">
        <h2 className="text-lg font-bold">{t.edit}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="label">{d.auth.orgName}</span><input name="orgName" defaultValue={c.orgName} required className="input" /></label>
          <label><span className="label">{d.auth.phone}</span><input name="orgPhone" defaultValue={c.orgPhone} className="input" /></label>
          <label><span className="label">{d.auth.name}</span><input name="userName" defaultValue={c.userName} required className="input" /></label>
          <label>
            <span className="label">{d.auth.service}</span>
            <select name="service" defaultValue={c.service} className="input"><option value="SCHOOL">Smart School</option><option value="HOME">Smart Home</option><option value="FARM">Smart Farm</option></select>
          </label>
        </div>
        <label className="block"><span className="label">{d.auth.email}</span><input name="email" type="email" defaultValue={c.email} required className="input" /><span className="mt-1 block text-[11px] text-fg-dim">{t.emailChangeHint}</span></label>
        {state?.error && <p className="err">{state.error === "email_taken" ? d.auth.exists : state.error}</p>}
        {state?.ok && <p className="text-sm text-ok-soft">{d.common.saved}</p>}
        <button disabled={pending} className="btn btn-primary">{pending ? <Loader2 size={15} className="animate-spin" /> : <><Save size={15} /> {d.common.save}</>}</button>
      </form>

      <div className="space-y-5">
        <div className="card space-y-3 !rounded-[20px] p-6">
          <h2 className="text-lg font-bold">{t.access}</h2>
          <div className="flex flex-wrap gap-2">
            {!c.verified && (
              <button disabled={!!busy} onClick={() => run("v", () => adminVerifyEmail(c.userId), t.verifiedOk)} className="btn btn-ghost"><MailCheck size={15} /> {t.markVerified}</button>
            )}
            <button disabled={!!busy} onClick={() => run("l", () => adminResetPassword(c.userId, "link"), t.linkSent)} className="btn btn-ghost"><KeyRound size={15} /> {t.sendReset}</button>
            <button
              disabled={!!busy}
              onClick={async () => {
                const r = await run("t", () => adminResetPassword(c.userId, "temp"), t.tempCreated);
                if (r?.ok && r.message) setTemp(r.message);
              }}
              className="btn btn-ghost"
            >
              <KeyRound size={15} /> {t.tempPassword}
            </button>
            <button disabled={!!busy} onClick={() => run("s", () => adminSignOutUser(c.userId), t.signedOut)} className="btn btn-ghost"><LogOut size={15} /> {t.signOutAll}</button>
          </div>
          {temp && (
            <div className="rounded-xl border border-warn/40 bg-warn/[.06] p-3 text-sm">
              <div className="text-warn-soft">{t.tempShownOnce}</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-ink-950 p-2 font-mono">{temp}</code>
                <button onClick={async () => { await navigator.clipboard.writeText(temp); setCopied(true); }} className="btn btn-ghost btn-sm">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
              </div>
            </div>
          )}
          {busy && <Loader2 size={16} className="animate-spin text-fg-dim" />}
          {msg && <p className={`text-sm ${msg.ok ? "text-ok-soft" : "text-bad-soft"}`}>{msg.t}</p>}
        </div>

        <div className={`card space-y-3 !rounded-[20px] p-6 ${c.blockedAt ? "!border-warn/40" : ""}`}>
          <h2 className="text-lg font-bold">{t.blockTitle}</h2>
          {c.blockedAt ? (
            <>
              <p className="text-sm text-warn-soft">{t.blockedSince.replace("{d}", new Date(c.blockedAt).toLocaleString())}{c.blockReason ? ` · ${c.blockReason}` : ""}</p>
              <button disabled={!!busy} onClick={() => run("ub", () => setCustomerBlocked(c.orgId, false), t.unblocked)} className="btn btn-ghost"><ShieldCheck size={15} /> {t.unblock}</button>
            </>
          ) : (
            <>
              <p className="text-[13px] text-fg-muted">{t.blockHint}</p>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.blockReason} maxLength={300} className="input" />
              <button disabled={!!busy} onClick={() => run("b", () => setCustomerBlocked(c.orgId, true, reason), t.blockedOk)} className="btn btn-ghost !text-warn-soft"><Ban size={15} /> {t.block}</button>
            </>
          )}
        </div>

        <div className="card space-y-3 !rounded-[20px] !border-bad/30 p-6">
          <h2 className="text-lg font-bold text-bad-soft">{t.danger}</h2>
          <p className="text-[13px] text-fg-muted">{t.deleteHint.replace("{n}", c.orgName)}</p>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={c.orgName} className="input" />
          <button
            disabled={confirm.trim() !== c.orgName || !!busy}
            onClick={async () => {
              const r = await run("del", () => deleteCustomer(c.orgId, confirm), t.deleted);
              if (r?.ok) router.push("/admin/customers");
            }}
            className="btn btn-bad"
          >
            <Trash2 size={15} /> {t.delete}
          </button>
        </div>
      </div>
    </div>
  );
}
