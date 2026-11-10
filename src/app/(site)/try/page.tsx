import { LiveTry } from "@/components/site/LiveTry";
import { BeforeAfter } from "@/components/site/Engage";
import { getDict } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { f } = await getDict();
  return { title: f.y.tryTitle, description: f.y.tryLead };
}

/** Try the AI on your own camera (in the browser) + before/after comparison. */
export default async function TryPage() {
  const { f } = await getDict();
  const y = f.y;
  return (
    <section className="mx-auto max-w-[1100px] px-5 pb-24 pt-32">
      <h1 className="font-display text-[34px] font-extrabold tracking-tight sm:text-[46px]">{y.tryTitle}</h1>
      <p className="mt-2 max-w-2xl text-fg-muted">{y.tryLead}</p>
      <div className="mt-8"><LiveTry /></div>
      <h2 className="mt-20 text-center font-display text-[28px] font-extrabold">{y.baTitle}</h2>
      <p className="mb-6 mt-2 text-center text-fg-muted">{y.baLead}</p>
      <BeforeAfter />
    </section>
  );
}
