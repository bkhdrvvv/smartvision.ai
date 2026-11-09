import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, MessageSquareWarning } from "lucide-react";
import { TicketForm } from "@/components/support/TicketForms";
import { STATUS_CHIP } from "@/components/support/Thread";
import { getSession } from "@/lib/auth";
import { guestTickets } from "@/lib/chat";
import { getDict } from "@/lib/i18n/server";
import { cn } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.support.title };
}

/** Public complaints & appeals: visitors start a chat; signed-in customers use the dashboard version. */
export default async function SupportPage() {
  const s = await getSession();
  if (s?.role === "ADMIN") redirect("/admin/tickets");
  if (s) redirect("/dashboard/support");
  const { d } = await getDict();
  const mine = await guestTickets();
  return (
    <section className="relative mx-auto max-w-[900px] px-5 pt-36 pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40%_40%_at_80%_20%,rgba(124,92,255,.18),transparent)]" />
      <span className="eyebrow eyebrow-left">{d.support.title}</span>
      <h1 className="display mt-5 text-[clamp(34px,6vw,64px)]">{d.support.publicTitle}</h1>
      <p className="mt-4 max-w-xl text-fg-muted">{d.support.publicText}</p>

      {mine.length > 0 && (
        <div className="card mt-8 p-5">
          <div className="mb-3 text-sm font-semibold text-fg-muted">{d.support.yourAppeals}</div>
          <ul className="divide-y divide-line">
            {mine.map((t) => (
              <li key={t.id}>
                <Link href={`/support/t/${t.id}`} className="flex items-center gap-3 py-3 hover:text-brand-300">
                  <MessageCircle size={17} className="shrink-0 text-brand-400" />
                  <span className="font-mono text-[13px] text-fg-dim">#{t.number}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{t.subject}</span>
                  {t.unreadCustomer && <span className="chip chip-blue !h-5 !px-2 !text-[10px]">{d.support.unread}</span>}
                  <span className={cn("chip shrink-0", STATUS_CHIP[t.status])}>{d.support.status[t.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card mt-8 p-6 sm:p-8">
        <TicketForm guest />
      </div>
      <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-fg-dim">
        <MessageSquareWarning size={15} className="text-brand-400" /> {d.support.loginHint}{" "}
        <Link href="/login?next=%2Fdashboard%2Fsupport" className="font-semibold text-brand-400 hover:underline">{d.auth.signIn}</Link>
      </p>
    </section>
  );
}
