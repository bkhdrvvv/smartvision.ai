"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Bell, Bot, CarFront, Cctv, ContactRound, Gift, Play, Star, GraduationCap, ShieldAlert, Sparkles, LifeBuoy, MessageSquareWarning, CreditCard, FileText, LayoutGrid, LogOut, Mail, Search, Server, Settings, ShieldCheck, Layers, ScanFace, Send, Users, Video, Wallet, X, Menu,
} from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import { LangMenu } from "@/components/ui/LangSwitch";
import { logoutAction } from "@/app/actions/auth";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

export type ShellInfo = {
  variant: "customer" | "admin";
  user: { name: string; email: string; initials: string };
  badges: Record<string, number>;
  edge?: { serial: string; firmware: string; heartbeatSec: number | null } | null;
  unread: number;
  notifications: { id: string; title: string; body: string; ago: string }[];
  /** role inside the customer's organization (team members see fewer pages) */
  orgRole?: string;
};

const Ctx = createContext<ShellInfo | null>(null);
export const useShell = () => useContext(Ctx)!;

const ICONS = { overview: LayoutGrid, cameras: Cctv, live: Video, events: ScanFace, analytics: BarChart3, reports: FileText, notifications: Bell, subscription: Wallet, payments: CreditCard, settings: Settings, customers: Users, requests: Send, plans: Layers, devices: Server, system: Settings, outbox: Mail, security: ShieldAlert, ai: Sparkles, tickets: MessageSquareWarning, support: LifeBuoy, cai: Bot, students: GraduationCap, referral: Gift, plates: CarFront, visitors: ContactRound, reviews: Star, demo: Play };

export function Shell({ info, children }: { info: ShellInfo; children: React.ReactNode }) {
  const { d, f } = useI18n();
  const label = (k: keyof typeof ICONS) => (k === "cai" ? f.menu.ai : k === "students" ? f.menu.students : k === "referral" ? f.menu.referral : k === "plates" ? f.menu.plates : k === "visitors" ? f.x.visitorsMenu : k === "reviews" ? f.x.reviewsAdmin : k === "demo" ? f.x.demoMenu : d.dash.menu[k]);
  const isOwner = (info.orgRole ?? "OWNER") === "OWNER";
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const base = info.variant === "admin" ? "/admin" : "/dashboard";
  const items: { key: keyof typeof ICONS; href: string }[] =
    info.variant === "admin"
      ? [
          { key: "overview", href: "/admin" },
          { key: "customers", href: "/admin/customers" },
          { key: "security", href: "/admin/security" },
          { key: "ai", href: "/admin/ai" },
          { key: "tickets", href: "/admin/tickets" },
          { key: "reviews", href: "/admin/reviews" },
          { key: "requests", href: "/admin/requests" },
          { key: "plans", href: "/admin/plans" },
          { key: "payments", href: "/admin/payments" },
          { key: "devices", href: "/admin/devices" },
          { key: "notifications", href: "/admin/messages" },
          { key: "outbox", href: "/admin/outbox" },
          { key: "system", href: "/admin/settings" },
        ]
      : ([
          { key: "overview", href: "/dashboard" },
          { key: "cameras", href: "/dashboard/cameras" },
          { key: "live", href: "/dashboard/live" },
          { key: "events", href: "/dashboard/events" },
          { key: "cai", href: "/dashboard/ai" },
          { key: "students", href: "/dashboard/students" },
          { key: "plates", href: "/dashboard/plates" },
          { key: "visitors", href: "/dashboard/visitors" },
          { key: "analytics", href: "/dashboard/analytics" },
          { key: "reports", href: "/dashboard/reports" },
          { key: "notifications", href: "/dashboard/notifications" },
          isOwner && { key: "subscription", href: "/dashboard/subscription" },
          isOwner && { key: "payments", href: "/dashboard/payments" },
          isOwner && { key: "referral", href: "/dashboard/referral" },
          { key: "support", href: "/dashboard/support" },
          { key: "settings", href: "/dashboard/settings" },
        ].filter(Boolean) as { key: keyof typeof ICONS; href: string }[]);
  useEffect(() => setOpen(false), [path]);

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const I = ICONS[it.key];
        const active = it.href === base ? path === base : path.startsWith(it.href);
        const badge = info.badges[it.key];
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14.5px] transition-colors",
              active ? "border border-brand-400/30 bg-brand-500/12 text-fg" : "border border-transparent text-fg-muted hover:bg-white/[.03] hover:text-fg",
            )}
          >
            {active && <motion.span layoutId={`nav-${info.variant}`} className="absolute -left-[13px] top-2 h-[calc(100%-16px)] w-[3px] rounded-r bg-brand-400" />}
            <I size={18} className={active ? "text-brand-400" : ""} />
            <span className="flex-1">{label(it.key)}</span>
            {badge ? <span className="rounded-md bg-brand-500/20 px-1.5 py-0.5 text-[11px] font-bold text-brand-300">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href={base} className="flex items-center gap-3 px-2 pt-1 font-bold tracking-wide">
        <LogoMark size={40} />
        <span className="text-[17px]">SMARTVISION <span className="font-medium text-brand-400">AI</span></span>
      </Link>
      <div className="mt-7 mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-fg-dim">{info.variant === "admin" ? d.dash.admin : d.dash.customer}</div>
      {/* the menu scrolls on its own; the account block below always stays visible */}
      <div className="scrollbar-thin -mx-4 min-h-0 flex-1 overflow-y-auto px-4 pb-2">{nav}</div>
      <div className="shrink-0 space-y-3 pt-4">
        {info.variant === "admin" ? (
          <div className="card !rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[14px] font-semibold"><ShieldCheck size={15} className="text-ok-soft" /> {d.dash.adminSession.title}</div>
            <div className="mt-1 text-[12px] text-fg-dim">{d.dash.adminSession.text}</div>
          </div>
        ) : info.edge ? (
          <div className="card !rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[14px] font-semibold">
              <span className={cn("dot", info.edge.heartbeatSec !== null && info.edge.heartbeatSec < 300 ? "dot-live" : "!bg-bad")} /> {d.dash.edge.title}
            </div>
            <div className="mt-1 text-[12px] text-fg-dim">{info.edge.serial} · {info.edge.firmware}</div>
            {info.edge.heartbeatSec !== null && <div className="text-[12px] text-fg-dim">{d.dash.edge.heartbeat} {fmtSec(info.edge.heartbeatSec)} {d.dash.edge.ago}</div>}
          </div>
        ) : (
          <div className="card !rounded-2xl p-4 text-[12px] text-fg-dim">{d.dash.edge.none}</div>
        )}
        <div className="flex items-center gap-3 border-t border-line px-1 pt-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-brand-500 text-sm font-bold">{info.user.initials}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold">{info.user.name}</div>
            <div className="truncate text-[12px] text-fg-dim">{info.user.email}</div>
          </div>
          <form action={logoutAction}>
            <button className="grid h-9 w-9 place-items-center rounded-lg text-fg-dim hover:bg-white/5 hover:text-fg" aria-label={d.common.logout} title={d.common.logout}><LogOut size={17} /></button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <Ctx.Provider value={info}>
      <div className="min-h-dvh bg-ink-900 lg:grid lg:grid-cols-[288px_1fr]">
        <aside className="sticky top-0 hidden h-dvh overflow-hidden border-r border-line bg-ink-950/50 p-5 lg:block">{sidebar}</aside>
        <AnimatePresence>
          {open && (
            <motion.div className="fixed inset-0 z-[70] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
              <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="absolute inset-y-0 left-0 w-[290px] overflow-y-auto border-r border-line bg-ink-900 p-5">
                <button onClick={() => setOpen(false)} className="absolute right-4 top-5 grid h-9 w-9 place-items-center rounded-lg border border-line-strong" aria-label={d.common.close}><X size={16} /></button>
                {sidebar}
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>
        {/* bottom padding keeps the last content (e.g. a player's control bar) clear of the phone tab bar */}
        <div className="min-w-0 pb-28 md:pb-0">
          <button onClick={() => setOpen(true)} className="fixed left-4 top-4 z-40 grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-ink-850/90 backdrop-blur lg:hidden" aria-label={d.nav.menu}><Menu size={18} /></button>
          {children}
        </div>
        {info.variant === "customer" && <MobileTabs />}
      </div>
    </Ctx.Provider>
  );
}

function fmtSec(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function MobileTabs() {
  const { d } = useI18n();
  const path = usePathname();
  const tabs = [
    { href: "/dashboard", I: LayoutGrid, l: d.dash.menu.overview },
    { href: "/dashboard/live", I: Cctv, l: d.dash.menu.cameras },
    { href: "/dashboard/events", I: ScanFace, l: d.dash.menu.events },
    { href: "/dashboard/reports", I: BarChart3, l: d.dash.menu.reports },
    { href: "/dashboard/subscription", I: Wallet, l: d.dash.menu.subscription },
  ];
  return (
    <nav className="glass fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl px-1 py-2 md:hidden">
      {tabs.map((t) => {
        const on = t.href === "/dashboard" ? path === t.href : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 text-[10px]", on ? "text-brand-400" : "text-fg-dim")}>
            <t.I size={20} />
            <span className="max-w-full truncate px-0.5">{t.l}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Page header row: breadcrumb + title on the left, search / status / bell / lang / avatar on the right */
export function Topbar({ crumb, title, chip, demo }: { crumb: string; title: string; chip?: React.ReactNode; demo?: boolean }) {
  const { d, f } = useI18n();
  const info = useShell();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [bell, setBell] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setBell(false);
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, []);
  const base = info.variant === "admin" ? "/admin" : "/dashboard";
  const path = usePathname();
  // /admin/customers/cm123…/live → /admin/customers/[id]/live
  const key = path.split("/").map((s) => (s.length > 15 ? "[id]" : s)).join("/");
  const help = (d.pageHelp as Record<string, string>)[key] ?? (f.help as Record<string, string>)[key];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink-900/80 px-4 pb-5 pt-5 backdrop-blur-xl sm:px-8 sm:pt-7">
      <div className="flex flex-wrap items-center gap-4 pl-14 lg:pl-0">
        <div className="mr-auto min-w-0">
          <div className="text-[13px] text-fg-dim">{crumb}</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate font-display text-[26px] font-extrabold tracking-tight sm:text-[32px]">{title}</h1>
            {demo && <span className="chip chip-demo">{d.common.demoMode}</span>}
          </div>
          {/* plain-language help: what this page is for and what to do here */}
          {help && <p className="mt-1.5 max-w-3xl text-[13px] leading-snug text-fg-muted">💡 {help}</p>}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push(info.variant === "admin" ? `/admin/customers?q=${encodeURIComponent(q)}` : `/dashboard/events?q=${encodeURIComponent(q)}`);
          }}
          className="relative hidden xl:block"
        >
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-dim" />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={info.variant === "admin" ? d.dash.adminSecurity.search : d.common.search} className="input !h-11 w-[300px] !rounded-xl !pl-11 !pr-14" />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-line-strong px-1.5 text-[11px] text-fg-dim">⌘K</kbd>
        </form>
        {chip}
        <div ref={ref} className="relative">
          <button onClick={() => setBell((b) => !b)} className="relative grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-ink-850" aria-label={d.dash.menu.notifications}>
            <Bell size={18} />
            {info.unread > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1 text-[11px] font-bold">{info.unread}</span>}
          </button>
          <AnimatePresence>
            {bell && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="glass absolute right-0 top-13 z-50 w-80 rounded-2xl p-2">
                {info.notifications.length === 0 && <div className="p-4 text-sm text-fg-dim">{d.common.noData}</div>}
                {info.notifications.map((n) => (
                  <div key={n.id} className="rounded-xl p-3 hover:bg-white/5">
                    <div className="text-sm font-semibold">{n.title}</div>
                    <div className="text-xs text-fg-dim">{n.body} · {n.ago}</div>
                  </div>
                ))}
                <Link href={info.variant === "admin" ? "/admin/messages" : "/dashboard/notifications"} className="mt-1 block rounded-xl p-2 text-center text-xs font-semibold text-brand-400 hover:bg-white/5">{d.common.viewAll}</Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <LangMenu />
        <Link href={`${base}/settings`} className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-brand-500 text-sm font-bold">{info.user.initials}</Link>
      </div>
    </header>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-5 px-4 py-6 sm:px-8 sm:py-7", className)}>{children}</div>;
}

export function Panel({ title, sub, action, children, className }: { title?: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("card !rounded-[20px] p-5 sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[18px] font-bold">{title}</h2>}
            {sub && <div className="mt-0.5 text-[13px] text-fg-dim">{sub}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
