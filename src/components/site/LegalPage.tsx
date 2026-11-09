import Link from "next/link";
import type { LegalDoc } from "@/lib/legal";

/** Terms / Privacy page: contents list + numbered sections. */
type Operator = { name: string; tin: string; address: string; phone: string; email: string; labels: { operator: string; tin: string; address: string; contact: string; supportChat: string } };

export function LegalPage({ doc, other, operator: o }: { doc: LegalDoc; other: { href: string; label: string }; operator: Operator }) {
  return (
    <section className="mx-auto max-w-3xl px-5 pt-36 pb-24">
      <h1 className="font-display text-[clamp(32px,5vw,48px)] font-extrabold leading-tight">{doc.title}</h1>
      <p className="mt-2 text-sm text-fg-dim">{doc.updated}</p>
      <p className="mt-6 leading-relaxed text-fg-muted">{doc.intro}</p>
      {/* who provides the service (operator of personal data) */}
      <dl className="card mt-6 grid gap-x-6 gap-y-2 p-5 text-[14px] sm:grid-cols-[auto_1fr]">
        <dt className="text-fg-dim">{o.labels.operator}</dt><dd className="font-semibold">{o.name}</dd>
        {o.tin && <><dt className="text-fg-dim">{o.labels.tin}</dt><dd>{o.tin}</dd></>}
        <dt className="text-fg-dim">{o.labels.address}</dt><dd>{o.address}</dd>
        <dt className="text-fg-dim">{o.labels.contact}</dt><dd>{o.phone} · {o.email} · <Link href="/support" className="text-brand-400 hover:underline">{o.labels.supportChat}</Link></dd>
      </dl>
      <nav className="card mt-8 p-5">
        <ol className="grid gap-1.5 text-[14px] sm:grid-cols-2">
          {doc.sections.map((s, i) => (
            <li key={s.h}><a href={`#s${i + 1}`} className="text-fg-muted hover:text-brand-400">{s.h}</a></li>
          ))}
        </ol>
      </nav>
      <div className="mt-10 space-y-9">
        {doc.sections.map((s, i) => (
          <article key={s.h} id={`s${i + 1}`} className="scroll-mt-28">
            <h2 className="text-xl font-bold">{s.h}</h2>
            <div className="mt-3 space-y-3 leading-relaxed text-fg-muted">
              {s.p.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
            </div>
          </article>
        ))}
      </div>
      <p className="mt-12 border-t border-line pt-6 text-sm"><Link href={other.href} className="text-brand-400 hover:underline">{other.label} →</Link></p>
    </section>
  );
}
