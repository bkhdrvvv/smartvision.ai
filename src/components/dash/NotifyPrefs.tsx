"use client";

import { useState } from "react";
import { Loader2, Mail, MessageSquare } from "lucide-react";
import { updateNotifyPrefs } from "@/app/actions/customer";
import { useI18n } from "@/lib/i18n/client";

export function NotifyPrefs({ email, sms, hasPhone, verified }: { email: boolean; sms: boolean; hasPhone: boolean; verified: boolean }) {
  const { d } = useI18n();
  const n = d.dash.notifyPrefs;
  const [e, setE] = useState(email);
  const [s, setS] = useState(sms);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 rounded-xl border border-line p-3">
        <input type="checkbox" checked={e} onChange={(x) => setE(x.target.checked)} className="mt-1 accent-brand-500" />
        <span><span className="flex items-center gap-2 font-semibold"><Mail size={15} /> {n.email}</span><span className="text-[12px] text-fg-dim">{verified ? n.emailHint : n.emailNeedsVerify}</span></span>
      </label>
      {/* SMS is paid per message — hidden unless it was already switched on (Telegram alerts are free) */}
      {sms && (
        <label className="flex items-start gap-3 rounded-xl border border-line p-3">
          <input type="checkbox" checked={s} disabled={!hasPhone} onChange={(x) => setS(x.target.checked)} className="mt-1 accent-brand-500" />
          <span><span className="flex items-center gap-2 font-semibold"><MessageSquare size={15} /> {n.sms}</span><span className="text-[12px] text-fg-dim">{hasPhone ? n.smsHint : n.smsNoPhone}</span></span>
        </label>
      )}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await updateNotifyPrefs({ email: e, sms: s });
          setBusy(false);
          setMsg(r?.message ?? r?.error ?? null);
        }}
        className="btn btn-primary"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : d.common.save}
      </button>
      {msg && <p className="text-sm text-ok-soft">{msg}</p>}
    </div>
  );
}
