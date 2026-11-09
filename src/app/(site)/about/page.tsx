import { Eye, MapPin, Users } from "lucide-react";
import { ModelViewer } from "@/components/site/ModelViewer";
import { Ecosystem } from "@/components/site/Sections";
import { Cta } from "@/components/site/FaqCta";
import { getDict } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.nav.about };
}

export default async function AboutPage() {
  const { d } = await getDict();
  return (
    <>
      <section className="mx-auto max-w-[1240px] px-5 pt-36">
        <span className="eyebrow eyebrow-left">{d.about.eyebrow}</span>
        <h1 className="display mt-5 max-w-4xl text-[clamp(40px,6.5vw,88px)]">
          <span className="block">{d.about.title1}</span>
          <span className="grad-text block pb-2">{d.about.title2}</span>
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-fg-muted">{d.about.text}</p>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {d.about.stats.map((s) => (
            <div key={s.label} className="card p-6">
              <div className="font-display text-4xl font-extrabold tracking-tight grad-blue">{s.value}</div>
              <div className="mt-1 text-sm text-fg-muted">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-16 grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
          <ModelViewer models={[{ id: "server", label: d.viewer.server }, { id: "camera", label: d.viewer.camera }]} labels={{ angles: d.viewer.angles, hint: d.viewer.hint }} />
          <div className="space-y-4">
            {d.about.values.map((v, i) => {
              const I = [Eye, MapPin, Users][i]!;
              return (
                <div key={v.title} className="card flex gap-4 p-6">
                  <span className="icon-tile shrink-0"><I size={18} /></span>
                  <div>
                    <h3 className="font-semibold">{v.title}</h3>
                    <p className="mt-1 text-sm text-fg-muted">{v.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <Ecosystem />
      <Cta />
    </>
  );
}
