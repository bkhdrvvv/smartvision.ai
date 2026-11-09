import Link from "next/link";
import { FlaskConical, GraduationCap, ShieldCheck } from "lucide-react";
import type { EventType } from "@prisma/client";
import { EVENT_ICON, PlateBadge } from "@/components/dash/Bits";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { f } = await getDict();
  return { title: f.x.demoTitle };
}

// Sample data only (clearly marked on the page) — shows what a customer's dashboard looks like.
const EVENTS: { t: string; type: EventType; cam: string; sev: "INFO" | "WARNING" | "CRITICAL"; plate?: string }[] = [
  { t: "08:02", type: "STUDENT", cam: "Darvoza", sev: "INFO" },
  { t: "08:15", type: "VEHICLE", cam: "Darvoza", sev: "INFO", plate: "01A123BC" },
  { t: "10:41", type: "CORRIDOR", cam: "2-qavat koridor", sev: "WARNING" },
  { t: "13:05", type: "LOITER", cam: "Orqa hovli", sev: "WARNING" },
  { t: "22:47", type: "INTRUSION", cam: "Orqa hovli", sev: "CRITICAL" },
];
const HOURS = [0, 0, 0, 0, 0, 1, 3, 12, 30, 14, 8, 9, 15, 18, 22, 10, 6, 4, 3, 2, 1, 1, 0, 0];

export default async function DemoPage() {
  const { d, f } = await getDict();
  const x = f.x;
  const max = Math.max(...HOURS);
  return (
    <section className="mx-auto max-w-[1240px] px-5 pb-24 pt-32">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[34px] font-extrabold tracking-tight sm:text-[44px]">{x.demoTitle}</h1>
        <span className="chip chip-warn"><FlaskConical size={13} /> {x.demoBadge}</span>
      </div>
      <p className="mt-2 max-w-2xl text-fg-muted">{x.demoLead}</p>

      <div className="mt-8 flex flex-wrap items-center gap-5 rounded-[20px] border border-emerald-400/50 bg-emerald-400/10 p-5 text-emerald-100">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-400 text-ink-950 shadow-[0_0_30px_6px_rgba(52,211,153,.5)]"><ShieldCheck size={30} /></span>
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.18em] opacity-80">{x.safetyTitle}</div>
          <div className="font-display text-[26px] font-extrabold">{x.green}</div>
          <div className="text-[13.5px] opacity-90">{x.rOk}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="card p-6">
          <h2 className="text-[17px] font-bold">{d.dash.menu.events}</h2>
          <ul className="mt-4 divide-y divide-line">
            {EVENTS.map((e) => {
              const I = EVENT_ICON[e.type];
              return (
                <li key={e.t} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-12 font-mono text-[13px] text-fg-dim">{e.t}</span>
                  <span className={`grid h-9 w-9 place-items-center rounded-lg ${e.sev === "CRITICAL" ? "bg-rose-500/15 text-rose-300" : e.sev === "WARNING" ? "bg-amber-400/15 text-amber-300" : "bg-brand-500/15 text-brand-300"}`}><I size={16} /></span>
                  <span className="min-w-0 flex-1 font-semibold">{d.dash.eventTitles[e.type]} <span className="font-normal text-fg-dim">· {e.cam}</span></span>
                  {e.plate && <PlateBadge plate={e.plate} />}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="space-y-5">
          <div className="card p-6">
            <h2 className="flex items-center gap-2 text-[17px] font-bold"><GraduationCap size={18} /> {f.students.title}</h2>
            <div className="mt-3 font-display text-[34px] font-extrabold">412 / 430</div>
            <div className="text-[13px] text-fg-muted">{f.students.today} · {f.more.late}: 7</div>
          </div>
          <div className="card p-6">
            <h2 className="text-[17px] font-bold">{x.busyTitle}</h2>
            <div className="mt-4 flex h-32 items-end gap-[3px]">
              {HOURS.map((v, h) => <div key={h} className="flex-1 rounded-t-sm bg-brand-500" style={{ height: `${(v / max) * 100}%` }} title={`${h}:00`} />)}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10.5px] text-fg-dim"><span>0:00</span><span>12:00</span><span>23:00</span></div>
          </div>
        </div>
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/register" className="btn btn-primary btn-lg">{x.demoCta}</Link>
        <Link href="/pricing#calculator" className="btn btn-ghost btn-lg">{x.calcTitle}</Link>
      </div>
    </section>
  );
}
