"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Save } from "lucide-react";
import { createCoupon, grantTrial, registerDevice, rotateDeviceToken, updatePlan, updateSettings } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/customer";
import { useI18n } from "@/lib/i18n/client";

/** One-time 7-day free trial for a customer (disabled once used) */
export function TrialButton({ orgId, used }: { orgId: string; used: boolean }) {
  const { d } = useI18n();
  const g = d.dash.adminGrant;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (used) return <span className="chip" title={g.used}>{g.used}</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(g.confirm)) return;
          setBusy(true);
          const r = await grantTrial(orgId);
          setBusy(false);
          if (r?.ok) router.refresh();
          else setErr(r?.error === "used" ? g.used : r?.error === "active" ? d.dash.trial.active : `${d.common.error} (${r?.error})`);
        }}
        className="btn btn-ghost btn-sm !border-violet-500/40 text-violet-400"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : g.button}
      </button>
      {err && <span className="mt-1 text-[11px] text-bad-soft">{err}</span>}
    </span>
  );
}

export function PlanRow({ plan }: { plan: { id: string; label: string; priceMonthly: number; maxCameras: number; recommended: boolean; active: boolean } }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<ActionResult, FormData>(updatePlan, undefined);
  return (
    <form action={action} className="grid items-end gap-3 border-t border-line py-4 sm:grid-cols-[1.2fr_1fr_0.7fr_auto_auto_auto]">
      <input type="hidden" name="id" value={plan.id} />
      <div className="font-semibold">{plan.label}</div>
      <label><span className="label">{d.dash.adminPlans.price}</span><input name="priceMonthly" type="number" min={0} defaultValue={plan.priceMonthly} className="input" /></label>
      <label><span className="label">{d.dash.adminPlans.maxCameras}</span><input name="maxCameras" type="number" min={1} defaultValue={plan.maxCameras} className="input" /></label>
      <label className="flex h-11 items-center gap-2 text-sm"><input type="checkbox" name="recommended" defaultChecked={plan.recommended} className="accent-brand-500" /> {d.pricing.recommended}</label>
      <label className="flex h-11 items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={plan.active} className="accent-brand-500" /> {d.common.active}</label>
      <button disabled={pending} className="btn btn-ghost !h-11" aria-label={d.common.save}>{pending ? <Loader2 size={15} className="animate-spin" /> : state?.ok ? <Check size={15} className="text-ok-soft" /> : <Save size={15} />}</button>
    </form>
  );
}

export function CouponForm() {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<ActionResult, FormData>(createCoupon, undefined);
  const p = d.dash.adminPlans;
  return (
    <form action={action} className="grid items-end gap-3 sm:grid-cols-[1fr_0.6fr_0.6fr_auto]">
      <label><span className="label">{p.code}</span><input name="code" required className="input uppercase" placeholder="SPRING15" /></label>
      <label><span className="label">{p.percent}</span><input name="percentOff" type="number" min={1} max={100} required className="input" /></label>
      <label><span className="label">{p.uses}</span><input name="maxRedemptions" type="number" min={1} className="input" /></label>
      <button disabled={pending} className="btn btn-primary !h-11">{p.newCoupon}</button>
      {state?.error && <p className="err sm:col-span-4">{d.common.error} ({state.error})</p>}
    </form>
  );
}

function TokenBox({ token }: { token: string }) {
  const { d } = useI18n();
  const [ok, setOk] = useState(false);
  return (
    <div className="rounded-xl border border-warn/40 bg-warn/[.06] p-4">
      <div className="text-sm text-warn-soft">{d.dash.adminDevices.token}</div>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 break-all rounded-lg bg-ink-950 p-2 font-mono text-[12px]">{token}</code>
        <button type="button" onClick={async () => { await navigator.clipboard.writeText(token); setOk(true); }} className="btn btn-ghost btn-sm">{ok ? <Check size={14} /> : <Copy size={14} />}</button>
      </div>
    </div>
  );
}

export function DeviceForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<ActionResult, FormData>(registerDevice, undefined);
  const p = d.dash.adminDevices;
  return (
    <div className="space-y-4">
      <form action={action} className="grid items-end gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
        <label><span className="label">{p.serial}</span><input name="serial" required className="input uppercase" placeholder="EDGE-FRM-0040" /></label>
        <label><span className="label">{p.org}</span><select name="organizationId" className="input">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <button disabled={pending} className="btn btn-primary !h-11">{p.create}</button>
      </form>
      {state?.error && <p className="err">{d.common.error} ({state.error})</p>}
      {state?.ok && state.message && <TokenBox token={state.message} />}
    </div>
  );
}

export function RotateToken({ id }: { id: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return token ? (
    <TokenBox token={token} />
  ) : (
    <button disabled={busy} onClick={async () => { setBusy(true); const r = await rotateDeviceToken(id); setToken(r?.message ?? null); setBusy(false); }} className="btn btn-ghost btn-sm">
      {busy ? <Loader2 size={14} className="animate-spin" /> : "Token ↻"}
    </button>
  );
}

export function SettingsForm({ values }: { values: Record<string, string> }) {
  const { d } = useI18n();
  const [state, action, pending] = useActionState<ActionResult, FormData>(updateSettings, undefined);
  const s = d.dash.adminSettings;
  const fields: [string, string][] = [["paymentCard", s.paymentCard], ["supportPhone", s.supportPhone], ["supportEmail", s.supportEmail], ["monthlyExpenses", s.expenses], ["companyName", s.companyName], ["companyTin", s.companyTin], ["companyAddress", s.companyAddress]];
  return (
    <form action={action} className="space-y-4">
      {fields.map(([k, l]) => (
        <label key={k} className="block"><span className="label">{l}</span><input name={k} defaultValue={values[k]} className="input" /></label>
      ))}
      {state?.ok && <p className="text-sm text-ok-soft">{d.common.saved}</p>}
      <button disabled={pending} className="btn btn-primary">{pending ? <Loader2 size={15} className="animate-spin" /> : d.common.save}</button>
    </form>
  );
}
