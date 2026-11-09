"use client";

import { useId, useMemo, useState } from "react";

type Pt = { label: string; sub?: string; a: number; b: number };

function smooth(points: [number, number][]) {
  if (points.length < 2) return "";
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]!;
    const [x1, y1] = points[i]!;
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

/** Events (area) + alerts (dashed) with hover tooltip */
export function AreaChart({ data, labels }: { data: Pt[]; labels: { a: string; b: string } }) {
  const id = useId();
  const W = 900, H = 260, P = { l: 36, r: 12, t: 16, b: 30 };
  // "nice" axis: max is a multiple of 4 steps so labels are whole numbers (0, 5, 10, 15, 20 …)
  const raw = Math.max(4, ...data.map((d) => d.a));
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 250, 500, 1000, 2500, 5000].find((s) => s * 4 >= raw) ?? Math.ceil(raw / 4);
  const max = step * 4;
  const [hover, setHover] = useState<number | null>(null);
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const lineA = useMemo(() => smooth(data.map((d, i) => [x(i), y(d.a)])), [data, max]); // eslint-disable-line react-hooks/exhaustive-deps
  const lineB = useMemo(() => smooth(data.map((d, i) => [x(i), y(d.b)])), [data, max]); // eslint-disable-line react-hooks/exhaustive-deps
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const every = Math.max(1, Math.round(data.length / 5));
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[240px] w-full md:h-[280px]" onMouseLeave={() => setHover(null)} role="img" aria-label={labels.a}>
        <defs>
          <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b82f6" stopOpacity=".45" />
            <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="rgb(148 163 184 / .08)" />
            <text x={P.l - 10} y={y(t) + 4} textAnchor="end" className="fill-fg-dim text-[11px]">{t}</text>
          </g>
        ))}
        <path d={`${lineA} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id}-f)`} />
        <path d={lineA} fill="none" stroke="#5b9dff" strokeWidth="2.5" style={{ filter: "drop-shadow(0 0 6px rgba(91,157,255,.6))" }} />
        <path d={lineB} fill="none" stroke="#8b7bff" strokeWidth="2" strokeDasharray="5 6" />
        {data.map((d, i) => (
          <g key={i}>
            {i % every === 0 || i === data.length - 1 ? (
              <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-fg-dim text-[11px]">{d.label}</text>
            ) : null}
            <rect x={x(i) - (W / data.length) / 2} y={0} width={W / data.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        ))}
        {h && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="rgb(148 163 184 / .35)" strokeDasharray="3 4" />
            <circle cx={x(hover)} cy={y(h.a)} r="6" fill="#0b1226" stroke="#5b9dff" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div className="glass pointer-events-none absolute top-0 rounded-xl px-3 py-2 text-xs" style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% + 12px), calc(100% - 160px))` }}>
          <div className="text-fg-dim">{h.sub ?? h.label}</div>
          <div className="mt-0.5 font-semibold">
            {h.a} {labels.a.toLowerCase()} <span className="ml-1 text-violet-400">{h.b} {labels.b.toLowerCase()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function Donut({ parts, total, caption }: { parts: { label: string; value: number; color: string }[]; total: number; caption: string }) {
  const R = 80, C = 2 * Math.PI * R;
  const sum = parts.reduce((s, p) => s + p.value, 0) || 1;
  let acc = 0;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[220px]">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={R} fill="none" stroke="rgb(148 163 184 / .08)" strokeWidth="22" />
        {parts.map((p) => {
          const len = (p.value / sum) * C;
          const el = <circle key={p.label} cx="100" cy="100" r={R} fill="none" stroke={p.color} strokeWidth="22" strokeDasharray={`${Math.max(0, len - 3)} ${C}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-4xl font-extrabold">{total}</div>
          <div className="text-xs text-fg-dim">{caption}</div>
        </div>
      </div>
    </div>
  );
}

export function Spark({ values, color = "#5b9dff" }: { values: number[]; color?: string }) {
  const id = useId();
  const W = 200, H = 40;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i * W) / Math.max(1, values.length - 1), H - 4 - ((v - min) / (max - min || 1)) * (H - 8)] as [number, number]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".45" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function BarList({ values, labels, highlightLast = true }: { values: number[]; labels: string[]; highlightLast?: boolean }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-28 items-end gap-2">
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div
            className="w-full rounded-md"
            title={String(v)}
            style={{
              height: `${(v / max) * 88 + 4}px`,
              background: highlightLast && i === values.length - 1 ? "linear-gradient(180deg,#8b7bff,#6d4dff)" : "linear-gradient(180deg,#4b8dff,#1e4fd8)",
            }}
          />
          <span className="text-[10px] text-fg-dim">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}
