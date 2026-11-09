"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, ShieldCheck } from "lucide-react";
import { setCustomerBlocked } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";

/** One-click block / unblock for the admin customer list (asks for an optional reason when blocking). */
export function BlockToggle({ orgId, blocked }: { orgId: string; blocked: boolean }) {
  const { d } = useI18n();
  const t = d.dash.adminCustomer;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        let reason = "";
        if (!blocked) {
          const r = window.prompt(t.blockReason, "");
          if (r === null) return; // cancelled
          reason = r;
        }
        setBusy(true);
        const res = await setCustomerBlocked(orgId, !blocked, reason);
        setBusy(false);
        if (res?.ok) router.refresh();
        else alert(`${d.common.error} (${res?.error})`);
      }}
      className={`btn btn-sm ${blocked ? "btn-ghost" : "btn-ghost !text-warn-soft"}`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : blocked ? <ShieldCheck size={14} /> : <Ban size={14} />} {blocked ? t.unblock : t.block}
    </button>
  );
}
