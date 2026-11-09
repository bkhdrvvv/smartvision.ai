import Link from "next/link";
import { Clock, Mail, MapPin, MessageSquareWarning, Phone } from "lucide-react";
import { ContactForm } from "@/components/site/ContactForm";
import { getDict } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.nav.contact };
}

export default async function ContactPage() {
  const { d } = await getDict();
  const s = await getSettings();
  return (
    <section className="relative mx-auto max-w-[1240px] px-5 pt-36 pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40%_40%_at_80%_20%,rgba(37,99,235,.2),transparent)]" />
      <span className="eyebrow eyebrow-left">{d.contact.eyebrow}</span>
      <h1 className="display mt-5 text-[clamp(40px,6vw,76px)]">
        <span className="block">{d.contact.title1}</span>
        <span className="grad-blue block">{d.contact.title2}</span>
      </h1>
      <p className="mt-5 max-w-xl text-fg-muted">{d.contact.text}</p>
      <Link href="/support" className="btn btn-ghost mt-6"><MessageSquareWarning size={16} /> {d.support.publicTitle}</Link>
      <div className="mt-12 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="card p-6 sm:p-8"><ContactForm /></div>
        <div className="space-y-4">
          {[
            { I: Phone, t: s.supportPhone, href: `tel:${s.supportPhone.replace(/\s/g, "")}` },
            { I: Mail, t: s.supportEmail, href: `mailto:${s.supportEmail}` },
            { I: MapPin, t: d.contact.address },
            { I: Clock, t: d.contact.hours },
          ].map(({ I, t, href }) => (
            <div key={t} className="card flex items-center gap-4 p-5">
              <span className="icon-tile"><I size={18} /></span>
              {href ? <a href={href} className="font-medium hover:text-brand-400">{t}</a> : <span className="font-medium">{t}</span>}
            </div>
          ))}
          <div className="card overflow-hidden">
            <iframe
              title="Map"
              className="h-[240px] w-full grayscale invert-[.92] hue-rotate-180"
              loading="lazy"
              referrerPolicy="no-referrer"
              src="https://www.openstreetmap.org/export/embed.html?bbox=69.20%2C41.27%2C69.32%2C41.35&layer=mapnik&marker=41.311%2C69.279"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
