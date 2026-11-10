"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { LangSegment } from "@/components/ui/LangSwitch";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/format";

export function Header({ authed, promo }: { authed: "CUSTOMER" | "ADMIN" | null; promo?: React.ReactNode }) {
  const { d, f } = useI18n();
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [path]);

  const links = [
    { href: "/", label: d.nav.home },
    { href: "/#solutions", label: d.nav.solutions },
    { href: "/#how", label: d.nav.how, wide: true },
    { href: "/pricing", label: d.nav.pricing },
    { href: "/demo", label: f.x.demoMenu },
    { href: "/try", label: f.y.tryMenu },
    { href: "/about", label: d.nav.about, wide: true },
    { href: "/contact", label: d.nav.contact },
  ];
  const dash = authed === "ADMIN" ? "/admin" : "/dashboard";

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-all duration-500", promo ? (scrolled ? "pb-2" : "pb-4") : scrolled ? "py-2" : "py-4")}>
      {promo && <div className={cn("transition-all duration-500", scrolled ? "mb-2" : "mb-4")}>{promo}</div>}
      <div
        className={cn(
          "mx-auto flex h-14 max-w-[1240px] items-center justify-between gap-4 rounded-2xl px-4 transition-all duration-500 sm:px-5",
          scrolled ? "glass mx-3 shadow-[0_20px_60px_-30px_rgba(0,0,0,.9)] xl:mx-auto" : "border border-transparent",
        )}
      >
        <Logo />
        <nav className="hidden items-center gap-1 whitespace-nowrap xl:flex" aria-label="Main">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn("rounded-lg px-2.5 py-2 text-[13.5px] transition-colors", "wide" in l && l.wide && "hidden 2xl:inline-block", active ? "text-fg" : "text-fg-muted hover:text-fg")}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <LangSegment />
          </div>
          {authed ? (
            <Link href={dash} className="btn btn-primary btn-sm hidden sm:inline-flex">
              {d.nav.dashboard} <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden px-2 text-[13.5px] text-fg-muted hover:text-fg sm:block">
                {d.nav.login}
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm hidden sm:inline-flex">
                {d.nav.getStarted} <ArrowRight size={14} />
              </Link>
            </>
          )}
          <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-line-strong bg-ink-850/70 xl:hidden" aria-label={d.nav.menu}>
            <Menu size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[60] xl:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="glass absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col gap-2 p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <Logo size={30} />
                <button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-line-strong" aria-label={d.common.close}>
                  <X size={18} />
                </button>
              </div>
              {links.map((l, i) => (
                <motion.div key={l.href} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                  <Link href={l.href} className="block rounded-xl px-4 py-3 text-lg font-semibold hover:bg-white/5">
                    {l.label}
                  </Link>
                </motion.div>
              ))}
              <div className="mt-auto space-y-3">
                <LangSegment />
                {authed ? (
                  <Link href={dash} className="btn btn-primary btn-lg w-full">{d.nav.dashboard}</Link>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/login" className="btn btn-ghost btn-lg">{d.nav.login}</Link>
                    <Link href="/register" className="btn btn-primary btn-lg">{d.nav.getStarted}</Link>
                  </div>
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
