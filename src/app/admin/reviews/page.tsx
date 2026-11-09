import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { ReviewToggle, Stars } from "@/components/site/Reviews";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { eventTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Customer reviews: nothing is shown on the public site until the admin publishes it. */
export default async function AdminReviews() {
  await requireAdmin();
  const { d, f } = await getDict();
  const rows = await db.review.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { organization: { select: { name: true } } } });
  return (
    <>
      <Topbar crumb={`Admin / ${f.x.reviewsAdmin}`} title={f.x.reviewsAdmin} />
      <PageBody>
        <Panel>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-fg-dim">{f.x.noReviews}</p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><Stars n={r.rating} /> <b>{r.author}</b> <span className="text-fg-dim">· {r.organization.name} · {eventTime(r.createdAt, d)}</span></div>
                    <p className="mt-1.5 text-[14px] text-fg-muted">{r.text}</p>
                  </div>
                  <span className={`chip ${r.approved ? "chip-ok" : "chip-warn"}`}>{r.approved ? f.x.published : f.x.pending}</span>
                  <ReviewToggle id={r.id} approved={r.approved} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
