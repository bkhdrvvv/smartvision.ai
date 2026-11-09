import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { ModelViewer } from "@/components/site/ModelViewer";
import { Pricing } from "@/components/site/Pricing";
import { HowItWorks } from "@/components/site/Sections";
import { getDict } from "@/lib/i18n/server";
import { getPlans } from "@/lib/plans";
import { getSession } from "@/lib/auth";

const MAP = { school: "SCHOOL", home: "HOME", farm: "FARM" } as const;
type Slug = keyof typeof MAP;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { d } = await getDict();
  if (!(slug in MAP)) return {};
  const s = d.solutions[slug as Slug];
  return { title: s.name, description: s.text };
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in MAP)) notFound();
  const k = slug as Slug;
  const { d } = await getDict();
  const [plans, session] = await Promise.all([getPlans(), getSession()]);
  const s = d.solutions[k];

  return (
    <>
      <section className="relative mx-auto max-w-[1240px] px-5 pt-32">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <span className="eyebrow eyebrow-left">{d.solutions.eyebrow}</span>
            <h1 className="display mt-5 text-[clamp(44px,6.5vw,84px)]">
              <span className="grad-text">{s.name}</span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-fg-muted">{s.text}</p>
            <h2 className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-fg-dim">{d.solutions.detail.useCases}</h2>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {s.items.map((it) => (
                <li key={it} className="flex items-center gap-2.5 text-[14px]"><Check size={15} className="text-ok-soft" /> {it}</li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="#pricing" className="btn btn-primary btn-lg">{d.solutions.detail.cta} <ArrowRight size={16} /></Link>
              <Link href="/contact" className="btn btn-ghost btn-lg">{d.cta.secondary}</Link>
            </div>
          </div>
          <ModelViewer
            models={[
              { id: k, label: d.viewer.site },
              { id: "camera", label: d.viewer.camera },
              { id: "server", label: d.viewer.server },
            ]}
            labels={{ angles: d.viewer.angles, hint: d.viewer.hint }}
          />
        </div>
      </section>
      <HowItWorks />
      <Pricing plans={plans} authed={!!session} initial={MAP[k]} />
    </>
  );
}
