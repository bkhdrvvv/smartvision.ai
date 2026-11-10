import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getPromo } from "@/lib/promo";
import { getDict } from "@/lib/i18n/server";
import { Countdown } from "./Countdown";

/** Thin promo strip at the very top (text set by the admin; hidden when empty or expired). */
export async function PromoBar({ dash = false }: { dash?: boolean }) {
  const p = await getPromo();
  if (!p.text) return null;
  const { f } = await getDict();
  const inner = (
    <>
      <Megaphone size={15} className="shrink-0" />
      <span className="min-w-0 truncate">{p.text}</span>
      {p.until && <Countdown until={p.until} />}
      {p.link && <span className="shrink-0 font-semibold underline underline-offset-2">{f.promo.more} →</span>}
    </>
  );
  const cls = `relative z-[60] flex items-center justify-center gap-2 bg-[linear-gradient(90deg,#0891b2,#4f46e5,#7c3aed)] px-4 py-2 text-[13px] text-white ${dash ? "rounded-xl mb-4" : ""}`;
  return p.link ? <Link href={p.link} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
