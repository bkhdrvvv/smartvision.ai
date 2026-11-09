/** Wireframe person used in detection overlays */
export function Silhouette({ color = "#5b9dff", className }: { color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 60 150" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id={`sg-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity=".04" />
        </linearGradient>
      </defs>
      <g stroke={color} strokeWidth="1.6" fill={`url(#sg-${color.slice(1)})`}>
        <circle cx="30" cy="17" r="11" />
        <path d="M14 36c3-4 9-6 16-6s13 2 16 6l4 44-7 2-3-30-2 0 0 92h-8l-2-58-2 58h-8l0-92-2 0-3 30-7-2z" />
      </g>
    </svg>
  );
}

/** Corner-bracket bounding box */
export function BBox({ label, color = "#5b9dff", className, children, style }: { label?: string; color?: string; className?: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={`absolute ${className ?? ""}`} style={style}>
      {label && (
        <span className="absolute -top-6 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: color }}>
          {label}
        </span>
      )}
      <div className="absolute inset-0 rounded-[3px] border" style={{ borderColor: `${color}aa`, boxShadow: `0 0 18px -4px ${color}` }} />
      {(["top-0 left-0 border-t-2 border-l-2", "top-0 right-0 border-t-2 border-r-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"] as const).map((c) => (
        <span key={c} className={`absolute h-2.5 w-2.5 ${c}`} style={{ borderColor: color }} />
      ))}
      {children}
    </div>
  );
}
