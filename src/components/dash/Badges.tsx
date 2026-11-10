import { Award, CarFront, Cctv, Crown, GraduationCap, Medal, Send, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { getActiveSubscription } from "@/lib/subscription";
import { getDict } from "@/lib/i18n/server";
import { Panel } from "@/components/dash/Shell";

const DAY = 86400_000;

/** Little achievements that make the dashboard fun to come back to — all computed from real data. */
export async function Badges({ orgId, telegram, since }: { orgId: string; telegram: boolean; since: Date }) {
  const { f } = await getDict();
  const b = f.y.badges;
  const [lastCrit, events, cams, plates, att, org, sub] = await Promise.all([
    db.event.findFirst({ where: { organizationId: orgId, severity: "CRITICAL", falseAlarm: false, type: { not: "CAMERA_STATUS" } }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } }),
    db.event.count({ where: { organizationId: orgId } }),
    db.camera.count({ where: { organizationId: orgId } }),
    db.event.count({ where: { organizationId: orgId, plate: { not: null } } }),
    db.attendance.count({ where: { student: { organizationId: orgId } } }),
    db.organization.findUnique({ where: { id: orgId }, select: { guardMode: true } }),
    getActiveSubscription(orgId),
  ]);
  const calm = Math.floor((Date.now() - (lastCrit?.occurredAt ?? since).getTime()) / DAY);
  const list = [
    { k: b.safe7, ok: cams > 0 && calm >= 7, I: ShieldCheck, c: "#34d399" },
    { k: b.safe30, ok: cams > 0 && calm >= 30, I: Trophy, c: "#fbbf24" },
    { k: b.ev100, ok: events >= 100, I: Medal, c: "#60a5fa" },
    { k: b.ev1000, ok: events >= 1000, I: Award, c: "#a78bfa" },
    { k: b.cams3, ok: cams >= 3, I: Cctv, c: "#22d3ee" },
    { k: b.tg, ok: telegram, I: Send, c: "#38bdf8" },
    { k: b.guard, ok: !!org && org.guardMode !== "off", I: Sparkles, c: "#f472b6" },
    { k: b.pro, ok: sub?.plan.tier === "PRO", I: Crown, c: "#facc15" },
    { k: b.plates, ok: plates >= 10, I: CarFront, c: "#c084fc" },
    { k: b.kids, ok: att >= 20, I: GraduationCap, c: "#4ade80" },
  ];
  const got = list.filter((x) => x.ok).length;
  return (
    <Panel title={`${f.y.badgesTitle} · ${got} / ${list.length}`} sub={got ? undefined : f.y.badgesNone} className="mb-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {list.map(({ k, ok, I, c }) => (
          <div key={k} className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center ${ok ? "border-white/15 bg-white/[.04]" : "border-line opacity-45 grayscale"}`} title={ok ? k : `${k} · ${f.y.locked}`}>
            <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: ok ? `${c}22` : "rgba(255,255,255,.05)", color: ok ? c : "#64748b", boxShadow: ok ? `0 0 22px -6px ${c}` : undefined }}><I size={22} /></span>
            <span className="text-[12.5px] font-semibold leading-tight">{k}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
