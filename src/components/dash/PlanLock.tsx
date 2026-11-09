import Link from "next/link";
import { Lock } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { planFor } from "@/lib/plan";

/** Shown instead of (or above) a feature the customer's plan does not include. */
export async function PlanLock({ service, feature }: { service: "SCHOOL" | "HOME" | "FARM"; feature: string }) {
  const { d, f } = await getDict();
  const tier = await planFor(service, feature);
  const name = (d.planFeatures as Record<string, string>)[feature] ?? feature;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/20 text-violet-300"><Lock size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{name}</div>
        <div className="text-[13px] text-fg-muted">{f.lock.text.replace("{t}", d.pricing.tiers[tier])}</div>
      </div>
      <Link href="/dashboard/subscription" className="btn btn-primary btn-sm">{f.lock.upgrade}</Link>
    </div>
  );
}
