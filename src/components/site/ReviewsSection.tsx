import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { SectionTitle } from "./SectionTitle";
import { Stars } from "./Reviews";

/** Real customer reviews (published by the admin). Hidden while there are none — nothing is made up. */
export async function ReviewsSection() {
  const rows = await db.review.findMany({ where: { approved: true }, orderBy: { createdAt: "desc" }, take: 6, include: { organization: { select: { service: true } } } }).catch(() => []);
  if (!rows.length) return null;
  const { f } = await getDict();
  return (
    <section className="relative mx-auto max-w-[1240px] px-5 py-20">
      <SectionTitle eyebrow="★ ★ ★ ★ ★" a={f.x.reviewsTitle} b="" />
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <figure key={r.id} className="card p-6">
            <Stars n={r.rating} />
            <blockquote className="mt-3 text-[15px] leading-relaxed text-fg-muted">“{r.text}”</blockquote>
            <figcaption className="mt-4 text-[14px] font-semibold">{r.author} <span className="font-normal text-fg-dim">· {f.x.calcPlans[r.organization.service]}</span></figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
