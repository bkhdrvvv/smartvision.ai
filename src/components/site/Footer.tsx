import Link from "next/link";
import { Instagram, Mail, MapPin, Phone, Send, Youtube } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { getDict } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";

export async function Footer() {
  const { d } = await getDict();
  const s = await getSettings();
  return (
    <footer className="border-t border-line bg-ink-950/60">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-16 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-fg-muted">{d.footer.tagline}</p>
          <div className="mt-6 flex gap-2">
            {[
              { I: Send, href: "https://t.me/", label: "Telegram" },
              { I: Instagram, href: "https://instagram.com/", label: "Instagram" },
              { I: Youtube, href: "https://youtube.com/", label: "YouTube" },
              { I: Mail, href: `mailto:${s.supportEmail}`, label: "Email" },
            ].map(({ I, href, label }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} className="grid h-10 w-10 place-items-center rounded-xl border border-line-strong text-fg-muted transition hover:border-brand-400/50 hover:text-fg">
                <I size={16} />
              </a>
            ))}
          </div>
        </div>
        <FooterCol title={d.footer.solutions} links={[["/solutions/school", "Smart School"], ["/solutions/home", "Smart Home"], ["/solutions/farm", "Smart Farm"], ["/pricing", d.nav.pricing]]} />
        <FooterCol title={d.footer.navigation} links={[["/#how", d.nav.how], ["/about", d.nav.about], ["/#faq", d.footer.faq], ["/contact", d.nav.contact], ["/support", d.support.footer]]} />
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.22em] text-fg-dim">{d.footer.contact}</h4>
          <ul className="mt-5 space-y-3 text-sm text-fg-muted">
            <li className="flex items-center gap-3"><Phone size={15} /> <a href={`tel:${s.supportPhone.replace(/\s/g, "")}`} className="hover:text-fg">{s.supportPhone}</a></li>
            <li className="flex items-center gap-3"><Mail size={15} /> <a href={`mailto:${s.supportEmail}`} className="hover:text-fg">{s.supportEmail}</a></li>
            <li className="flex items-center gap-3"><MapPin size={15} /> {d.contact.address}</li>
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-3 border-t border-line px-5 py-6 text-xs text-fg-dim sm:flex-row sm:items-center">
        <span>© {new Date().getFullYear()} SMARTVISION AI. {d.footer.rights}</span>
        <span className="flex gap-2">
          <Link href="/terms" className="hover:text-fg">{d.footer.terms}</Link>·<Link href="/privacy" className="hover:text-fg">{d.footer.privacy}</Link>
        </span>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-[0.22em] text-fg-dim">{title}</h4>
      <ul className="mt-5 space-y-3 text-sm text-fg-muted">
        {links.map(([href, label]) => (
          <li key={href}><Link href={href} className="hover:text-fg">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
