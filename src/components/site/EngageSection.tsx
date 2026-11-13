import Link from "next/link";
import { Camera, ShieldQuestion } from "lucide-react";
import { Consultation, ShareDiscount } from "./Engage";
import { getDict } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/notify";

export const SHARE_COUPON = "ULASH10";

/** Home page: try the AI, take the security test, free consultation, share for 10%. */
export async function EngageSection() {
  const { f } = await getDict();
  const y = f.y;
  return (
    <section className="relative mx-auto max-w-[1240px] px-5 py-20">
      <div className="grid gap-5 md:grid-cols-2">
        <a href="/try" className="card group flex items-center gap-4 !rounded-[24px] p-6 hover:border-brand-400/50">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-500/15 text-brand-300"><Camera size={26} /></span>
          <span><span className="block text-[19px] font-bold">{y.tryTitle}</span><span className="block text-[13.5px] text-fg-muted">{y.tryPrivacy}</span></span>
          <span className="ml-auto text-brand-300 transition group-hover:translate-x-1">→</span>
        </a>
        <Link href="/test" className="card group flex items-center gap-4 !rounded-[24px] p-6 hover:border-violet-400/50">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><ShieldQuestion size={26} /></span>
          <span><span className="block text-[19px] font-bold">{y.quizTitle}</span><span className="block text-[13.5px] text-fg-muted">{y.quizLead}</span></span>
          <span className="ml-auto text-violet-300 transition group-hover:translate-x-1">→</span>
        </Link>
        <Consultation />
        <ShareDiscount code={SHARE_COUPON} url={siteUrl("/")} />
      </div>
    </section>
  );
}
