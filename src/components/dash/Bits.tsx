import { Bell, CameraOff, CircleDollarSign, Flame, LogIn, LogOut, ScanFace, ShieldAlert, Users, UserX, Car, Rabbit, Cctv, PersonStanding, OctagonAlert, GraduationCap, EyeOff, Hourglass, Activity, DoorOpen, Fence } from "lucide-react";
import type { EventType, Severity, CameraStatus } from "@prisma/client";
import { cn } from "@/lib/format";

export const EVENT_ICON: Record<EventType, typeof Bell> = {
  ENTRY: LogIn, EXIT: LogOut, PERSON: ScanFace, UNKNOWN_PERSON: UserX, OCCUPANCY: Users, SAFETY: ShieldAlert,
  CAMERA_STATUS: CameraOff, LIVESTOCK: Rabbit, VEHICLE: Car, FIRE_SMOKE: Flame, INTRUSION: UserX,
  FALL: PersonStanding, ZONE: OctagonAlert, STUDENT: GraduationCap, TAMPER: EyeOff, LOITER: Hourglass, CAMERA_HEALTH: Activity, CORRIDOR: DoorOpen, ANIMAL_OUT: Fence,
};

export const CATEGORY_COLOR: Partial<Record<EventType, string>> & Record<string, string> = {
  ENTRY: "#3b82f6", EXIT: "#3b82f6", OCCUPANCY: "#60a5fa", PERSON: "#8b5cf6", UNKNOWN_PERSON: "#a78bfa",
  SAFETY: "#f59e0b", CAMERA_STATUS: "#ef4444", LIVESTOCK: "#10b981", VEHICLE: "#22d3ee", FIRE_SMOKE: "#f97316", INTRUSION: "#f43f5e",
  FALL: "#fb7185", ZONE: "#e11d48", STUDENT: "#34d399", TAMPER: "#dc2626", LOITER: "#eab308", CAMERA_HEALTH: "#94a3b8", CORRIDOR: "#f59e0b", ANIMAL_OUT: "#16a34a",
};

/** Uzbek-style licence plate: "01 A 123 BC" / "01 123 ABC" (other formats shown as read) */
export function formatPlate(p: string) {
  const m = p.match(/^(\d{2})([A-Z])(\d{3})([A-Z]{2})$/) ?? p.match(/^(\d{2})(\d{3})([A-Z]{3})$/);
  return m ? m.slice(1).join(" ") : p;
}

export function PlateBadge({ plate, big }: { plate: string; big?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border-2 border-[#1f2937] bg-white font-mono font-bold tracking-wider text-[#111827]", big ? "px-3 py-1 text-[18px]" : "px-1.5 py-0.5 text-[12px]")}>
      <span className={cn("rounded-sm bg-[#1d4ed8]", big ? "h-5 w-2" : "h-3 w-1")} />
      {formatPlate(plate)}
    </span>
  );
}

export function SeverityChip({ s, resolved, label }: { s: Severity | "ENTRY"; resolved?: boolean; label: string }) {
  const cls = resolved ? "" : s === "CRITICAL" ? "chip-bad" : s === "WARNING" ? "chip-warn" : "chip-blue";
  return <span className={cn("chip", cls)}>{label}</span>;
}

export function CamStatusChip({ s, label }: { s: CameraStatus; label: string }) {
  return <span className={cn("chip min-w-[110px] justify-center", s === "ONLINE" ? "chip-ok" : s === "WEAK" ? "chip-warn" : "chip-bad")}>{label}</span>;
}

/** Tiny monochrome "frame" thumbnail for event lists */
export function EventThumb({ type, severity }: { type: EventType; severity: Severity }) {
  const c = severity === "CRITICAL" ? "#ef4444" : severity === "WARNING" ? "#f59e0b" : "#5b9dff";
  if (type === "CAMERA_STATUS")
    return (
      <div className="grid h-[76px] w-[120px] shrink-0 place-items-center rounded-xl bg-[#07090f] text-bad-soft">
        <CameraOff size={22} />
      </div>
    );
  return (
    <div className="relative h-[76px] w-[120px] shrink-0 overflow-hidden rounded-xl bg-[linear-gradient(180deg,#5d6576,#2b3140)]">
      <svg viewBox="0 0 120 76" className="absolute inset-0 h-full w-full" aria-hidden>
        <rect x="20" y="22" width="80" height="34" fill="#c9ced8" opacity=".75" />
        <rect x="44" y="12" width="32" height="44" fill="#e2e6ee" opacity=".85" />
        {[26, 34, 84, 92].map((x) => <rect key={x} x={x} y="30" width="5" height="6" fill="#5a6478" />)}
        <rect x="0" y="56" width="120" height="20" fill="#3b4254" />
      </svg>
      <div className="absolute left-[52px] top-[30px] h-[34px] w-[16px] rounded-[2px] border-2" style={{ borderColor: c, boxShadow: `0 0 10px ${c}` }} />
    </div>
  );
}

export function KpiCard({ icon: I, tint, value, label, foot, right, children }: { icon: typeof Cctv; tint: string; value: React.ReactNode; label: string; foot?: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col !rounded-[20px] p-5">
      <div className="flex items-start justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-xl border" style={{ color: tint, borderColor: `${tint}55`, background: `${tint}1a` }}>
          <I size={20} />
        </span>
        {right}
      </div>
      <div className="mt-4 font-display text-[36px] font-extrabold leading-none tracking-tight">{value}</div>
      <div className="mt-1.5 text-[14px] text-fg-muted">{label}</div>
      {children && <div className="mt-3">{children}</div>}
      {foot && <div className="mt-auto pt-2 text-[13px] text-fg-dim">{foot}</div>}
    </div>
  );
}

/** Simple ratio bar (0..1) for KPI cards — shows a real current value, not invented history */
export function Meter({ value, color }: { value: number; color: string }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.round(v * 100)}%`, background: color }} />
    </div>
  );
}

export const chipFor = (s: string) => (s === "APPROVED" || s === "ACTIVE" ? "chip-ok" : s === "REJECTED" || s === "EXPIRED" ? "chip-bad" : s === "UNDER_REVIEW" ? "chip-violet" : s === "RECEIPT_SUBMITTED" ? "chip-blue" : "chip-warn");

export { CircleDollarSign };
