import Link from "next/link";
import { Cctv, ShieldAlert } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { BlockToggle } from "@/components/dash/BlockToggle";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { cn, maskPhone } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.dash.menu.security };
}

const DAY = 86400_000;

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ q?: string; days?: string }> }) {
  await requireAdmin();
  const { d } = await getDict();
  const t = d.dash.adminSecurity;
  const { q, days: daysRaw } = await searchParams;
  const days = [1, 7, 30].includes(Number(daysRaw)) ? Number(daysRaw) : 7;
  const since = new Date(Date.now() - days * DAY);

  const [orgs, alerts, failed] = await Promise.all([
    db.organization.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { users: { some: { email: { contains: q, mode: "insensitive" } } } }] } : undefined,
      include: { users: { select: { email: true }, take: 1 }, _count: { select: { cameras: true } } },
      orderBy: [{ blockedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    }),
    // unusual behaviour seen by the AI: everything that is not a routine count
    db.event.findMany({
      where: { severity: { in: ["WARNING", "CRITICAL"] }, occurredAt: { gte: since } },
      orderBy: { occurredAt: "desc" },
      take: 60,
      include: { camera: { select: { name: true } }, organization: { select: { id: true, name: true } } },
    }),
    // suspicious account activity: wrong passwords / 2FA codes, sign-in attempts of blocked accounts
    db.auditLog.findMany({
      where: { action: { in: ["auth.login_failed", "auth.2fa_failed", "auth.login_blocked"] }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { user: { select: { email: true, organization: { select: { id: true, name: true } } } } },
    }),
  ]);

  const alertCount = new Map<string, number>();
  for (const a of alerts) alertCount.set(a.organizationId, (alertCount.get(a.organizationId) ?? 0) + 1);
  // group failed sign-ins per account
  const byUser = new Map<string, { email: string; org?: { id: string; name: string } | null; n: number; last: Date; kinds: Set<string> }>();
  for (const f of failed) {
    const k = f.userId ?? "?";
    const row = byUser.get(k) ?? { email: f.user?.email ?? "—", org: f.user?.organization, n: 0, last: f.createdAt, kinds: new Set<string>() };
    row.n++;
    row.kinds.add(f.action);
    byUser.set(k, row);
  }
  const suspicious = [...byUser.values()].sort((a, b) => b.n - a.n);
  const blocked = orgs.filter((o) => o.blockedAt).length;

  return (
    <>
      <Topbar crumb={`Admin / ${d.dash.menu.security}`} title={t.title} />
      <PageBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={t.customers} value={orgs.length} />
          <Stat label={t.blockedCount} value={blocked} tone={blocked ? "bad" : undefined} />
          <Stat label={t.alertsCount.replace("{n}", String(days))} value={alerts.length} tone={alerts.length ? "warn" : undefined} />
        </div>

        <Panel title={t.blockTitle} sub={t.blockSub}>
          <form className="mb-4 flex flex-wrap gap-2">
            <input name="q" defaultValue={q} placeholder={t.search} className="input max-w-sm" />
            <input type="hidden" name="days" value={days} />
          </form>
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[760px]">
              <thead><tr><th>{d.dash.adminPay.customer}</th><th>{t.status}</th><th>{t.alerts}</th><th>{d.dash.adminCustomers.cameras}</th><th /></tr></thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/customers/${o.id}`} className="font-semibold hover:text-brand-400 hover:underline">{o.name}</Link>
                      <div className="text-[13px] text-fg-dim">{o.users[0]?.email} · {maskPhone(o.phone)}</div>
                    </td>
                    <td>
                      {o.blockedAt ? <span className="chip chip-bad">{d.dash.adminCustomer.blockedChip}</span> : <span className="chip chip-ok">{t.active}</span>}
                      {o.blockReason && <div className="mt-1 max-w-[220px] truncate text-[12px] text-fg-dim" title={o.blockReason}>{o.blockReason}</div>}
                    </td>
                    <td>{alertCount.get(o.id) ? <span className="chip chip-warn">{alertCount.get(o.id)}</span> : <span className="text-fg-dim">0</span>}</td>
                    <td>{o._count.cameras}</td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-2">
                        {o._count.cameras > 0 && (
                          <Link href={`/admin/customers/${o.id}/live`} className="btn btn-ghost btn-sm"><Cctv size={14} /> {t.watch}</Link>
                        )}
                        <BlockToggle orgId={o.id} blocked={!!o.blockedAt} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel
            title={t.unusualTitle}
            sub={t.unusualSub}
            action={
              <div className="flex gap-1">
                {[1, 7, 30].map((n) => (
                  <Link key={n} href={`/admin/security?days=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cn("btn btn-sm", n === days ? "btn-primary" : "btn-ghost")}>{n}D</Link>
                ))}
              </div>
            }
          >
            {alerts.length === 0 ? (
              <p className="py-6 text-center text-fg-dim">{t.noAlerts}</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    {a.snapshotKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/events/${a.id}/snapshot`} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg", a.severity === "CRITICAL" ? "bg-bad/15 text-bad-soft" : "bg-warn/15 text-warn-soft")}><ShieldAlert size={18} /></span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{d.dash.eventTitles[a.type as keyof typeof d.dash.eventTitles] ?? a.type}</div>
                      <div className="truncate text-[13px] text-fg-dim">{a.organization.name} · {a.camera?.name ?? "—"} · {a.occurredAt.toLocaleString("ru-RU")}</div>
                    </div>
                    <Link href={`/admin/customers/${a.organization.id}/live`} className="btn btn-ghost btn-sm shrink-0"><Cctv size={14} /></Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t.loginsTitle} sub={t.loginsSub}>
            {suspicious.length === 0 ? (
              <p className="py-6 text-center text-fg-dim">{t.noLogins}</p>
            ) : (
              <table className="tbl w-full">
                <thead><tr><th>{d.auth.email}</th><th>{t.attempts}</th><th>{t.last}</th></tr></thead>
                <tbody>
                  {suspicious.map((s) => (
                    <tr key={s.email}>
                      <td>
                        <div className="font-semibold">{s.email}</div>
                        {s.org && <Link href={`/admin/customers/${s.org.id}`} className="text-[13px] text-fg-dim hover:text-brand-400">{s.org.name}</Link>}
                        {s.kinds.has("auth.login_blocked") && <span className="chip chip-bad ml-2">{d.dash.adminCustomer.blockedChip}</span>}
                      </td>
                      <td><span className={cn("chip", s.n >= 5 ? "chip-bad" : "chip-warn")}>{s.n}</span></td>
                      <td className="text-[13px] text-fg-dim">{s.last.toLocaleString("ru-RU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </PageBody>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "bad" | "warn" }) {
  return (
    <div className="card !rounded-[20px] p-5">
      <div className="text-[13px] text-fg-muted">{label}</div>
      <div className={cn("mt-1 font-display text-3xl font-extrabold", tone === "bad" && "text-bad-soft", tone === "warn" && "text-warn-soft")}>{value}</div>
    </div>
  );
}
