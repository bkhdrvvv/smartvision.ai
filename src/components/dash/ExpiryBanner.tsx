import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { renewAndGo } from "@/app/actions/customer";
import type { Dict } from "@/lib/i18n";
import { fmt } from "@/lib/i18n";

/** Shown at the top of every customer page: red when expired, amber when ≤3 days left */
export function ExpiryBanner({ d, state, daysLeft }: { d: Dict; state: "expired" | "ending" | null; daysLeft: number }) {
  if (!state) return null;
  const e = d.dash.expiry;
  if (state === "ending")
    return (
      <div className="flex flex-wrap items-center gap-3 border-b border-warn/30 bg-warn/[.08] px-4 py-3 pl-16 text-[14px] text-warn-soft sm:px-8 lg:pl-8">
        <Clock size={16} className="shrink-0" />
        <span className="flex-1">{fmt(e.endsIn, { n: daysLeft })}</span>
        <form action={renewAndGo}><button className="btn btn-sm !border-warn/40 !bg-warn/15 !text-warn-soft">{d.dash.renew}</button></form>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-bad/30 bg-bad/[.09] px-4 py-3.5 pl-16 sm:px-8 lg:pl-8">
      <AlertTriangle size={18} className="shrink-0 text-bad-soft" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-bad-soft">{e.bannerTitle}</div>
        <div className="text-[13px] text-fg-muted">{e.bannerText}</div>
      </div>
      <form action={renewAndGo}><button className="btn btn-primary btn-sm">{e.renewNow}</button></form>
      <Link href="/dashboard/subscription" className="btn btn-ghost btn-sm">{d.dash.menu.subscription}</Link>
    </div>
  );
}
