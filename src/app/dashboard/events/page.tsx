import Link from "next/link";
import type { EventType, Prisma, Severity } from "@prisma/client";
import { Download, Search } from "lucide-react";
import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { EVENT_ICON, PlateBadge, SeverityChip } from "@/components/dash/Bits";
import { ActionButton } from "@/components/dash/ClientBits";
import { FalseAlarmButton } from "@/components/dash/MorePanels";
import { resolveEvent } from "@/app/actions/customer";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { eventTime } from "@/lib/format";

const TYPES: EventType[] = ["ENTRY", "EXIT", "PERSON", "UNKNOWN_PERSON", "OCCUPANCY", "SAFETY", "CAMERA_STATUS", "LIVESTOCK", "VEHICLE", "FIRE_SMOKE", "INTRUSION", "FALL", "ZONE", "STUDENT", "TAMPER", "LOITER", "CAMERA_HEALTH", "CORRIDOR", "ANIMAL_OUT"];
const SEV: Severity[] = ["INFO", "WARNING", "CRITICAL"];
const PER = 25;

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ type?: string; sev?: string; q?: string; page?: string }> }) {
  const user = await requireCustomer();
  const { d, f } = await getDict();
  const org = user.organization;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.EventWhereInput = {
    organizationId: org.id,
    ...(TYPES.includes(sp.type as EventType) && { type: sp.type as EventType }),
    ...(SEV.includes(sp.sev as Severity) && { severity: sp.sev as Severity }),
    // search across camera name / code, event type (in the user's language) and track ID
    ...(sp.q && {
      OR: [
        { camera: { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { code: { contains: sp.q, mode: "insensitive" } }, { location: { contains: sp.q, mode: "insensitive" } }] } },
        { trackId: { contains: sp.q.replace(/^#?/, ""), mode: "insensitive" } },
        ...(sp.q.replace(/[^A-Za-z0-9]/g, "").length >= 2 ? [{ plate: { contains: sp.q.replace(/[^A-Za-z0-9]/g, "").toUpperCase() } }] : []),
        ...(() => {
          const ql = sp.q!.toLowerCase();
          const types = TYPES.filter((t) => d.dash.eventTitles[t].toLowerCase().includes(ql) || d.dash.categories[t].toLowerCase().includes(ql) || t.toLowerCase().includes(ql));
          return types.length ? [{ type: { in: types } }] : [];
        })(),
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    db.event.findMany({ where, orderBy: { occurredAt: "desc" }, include: { camera: true }, take: PER, skip: (page - 1) * PER }),
    db.event.count({ where }),
  ]);
  const p = d.dash.eventsPage;
  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `?${u.toString()}`;
  };

  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${d.dash.menu.events}`} title={p.title} demo={org.demo} />
      <PageBody>
        <Panel
          action={<a href="/api/reports/events?days=30" className="btn btn-ghost btn-sm"><Download size={14} /> {d.common.exportCsv}</a>}
          title={`${total}`}
          sub={d.dash.events}
        >
          <form className="mb-5 flex flex-wrap gap-3">
            <select name="type" defaultValue={sp.type ?? ""} className="input !w-auto">
              <option value="">{p.filterType}</option>
              {TYPES.map((t) => <option key={t} value={t}>{d.dash.categories[t]}</option>)}
            </select>
            <select name="sev" defaultValue={sp.sev ?? ""} className="input !w-auto">
              <option value="">{p.filterSeverity}</option>
              {SEV.map((s) => <option key={s} value={s}>{d.dash.severity[s]}</option>)}
            </select>
            <input name="q" defaultValue={sp.q} placeholder={p.camera} className="input !w-48" />
            <button className="btn btn-ghost !h-11" aria-label="Search"><Search size={15} /></button>
          </form>
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[720px]">
              <thead><tr><th>{p.time}</th><th>{p.type}</th><th>{p.camera}</th><th>{d.dash.confidence}</th><th>{d.common.status}</th><th /></tr></thead>
              <tbody>
                {rows.map((e) => {
                  const I = EVENT_ICON[e.type];
                  return (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap font-mono text-[13px] text-fg-muted">{eventTime(e.occurredAt, d)}</td>
                      <td>
                        <span className="flex items-center gap-3 font-semibold">
                          {e.snapshotKey ? (
                            <a href={`/api/events/${e.id}/snapshot`} target="_blank" className="shrink-0 overflow-hidden rounded-lg border border-line-strong">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`/api/events/${e.id}/snapshot`} alt="" loading="lazy" className="h-10 w-10 object-cover" />
                            </a>
                          ) : (
                            <I size={15} className="text-brand-400" />
                          )}
                          {d.dash.eventTitles[e.type]} {e.trackId && <span className="font-mono text-[12px] font-normal text-fg-dim">{e.trackId}</span>}
                          {e.plate && <PlateBadge plate={e.plate} />}
                        </span>
                      </td>
                      <td className="text-fg-muted">{e.camera ? `${e.camera.name} · ${e.camera.code}` : "—"}</td>
                      <td className="font-mono text-[13px]">{e.confidence?.toFixed(2) ?? "—"}</td>
                      <td><SeverityChip s={e.severity} resolved={e.resolved} label={e.resolved ? d.dash.severity.RESOLVED : d.dash.severity[e.severity]} /></td>
                      <td className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {e.falseAlarm ? (
                            <span className="chip">{f.more.falseAlarm}</span>
                          ) : (
                            <>
                              {e.severity !== "INFO" && e.camera && <FalseAlarmButton id={e.id} />}
                              {!e.resolved && <ActionButton action={resolveEvent.bind(null, e.id)} className="btn btn-ghost btn-sm">{p.markResolved}</ActionButton>}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-fg-dim">{d.common.noData}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex items-center justify-between text-sm text-fg-dim">
            <span>{d.common.showing} {rows.length} {d.common.of} {total}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-ghost btn-sm">←</Link>}
              {page * PER < total && <Link href={qs({ page: String(page + 1) })} className="btn btn-ghost btn-sm">→</Link>}
            </div>
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
