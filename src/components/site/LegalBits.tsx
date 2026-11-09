"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Cookie, Loader2, ScrollText } from "lucide-react";
import { acceptTerms } from "@/app/actions/account";
import { useI18n } from "@/lib/i18n/client";

/** "I accept the Terms of Use and the Privacy Policy and consent to personal data processing" — required at sign-up. */
export function ConsentCheckbox({ invalid }: { invalid?: boolean }) {
  const { d } = useI18n();
  const t = d.legalUi;
  const [a, b] = t.consent.split("{terms}");
  const [b1, b2] = (b ?? "").split("{privacy}");
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-[13px] leading-snug ${invalid ? "border-bad/60 bg-bad/5" : "border-white/10 bg-white/[.02]"}`}>
      <input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 shrink-0 accent-[#3b82f6]" />
      <span className="text-fg-muted">
        {a}
        <Link href="/terms" target="_blank" className="font-semibold text-brand-400 hover:underline">{t.termsLink}</Link>
        {b1}
        <Link href="/privacy" target="_blank" className="font-semibold text-brand-400 hover:underline">{t.privacyLink}</Link>
        {b2}
      </span>
    </label>
  );
}

/** Existing customers must accept a new version of the terms before using the dashboard. */
export function TermsGate({ version }: { version: string }) {
  const { d } = useI18n();
  const t = d.legalUi;
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-lg space-y-4 !rounded-[22px] p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-300"><ScrollText size={20} /></span>
          <h2 className="text-lg font-bold">{t.updateTitle}</h2>
        </div>
        <p className="text-[14px] leading-relaxed text-fg-muted">{t.updateText.replace("{v}", version)}</p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/terms" target="_blank" className="text-brand-400 hover:underline">{t.readTerms} ↗</Link>
          <Link href="/privacy" target="_blank" className="text-brand-400 hover:underline">{t.readPrivacy} ↗</Link>
        </div>
        <button
          disabled={pending}
          onClick={() => start(async () => { await acceptTerms(); setDone(true); })}
          className="btn btn-primary w-full"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : t.accept}
        </button>
      </div>
    </div>
  );
}

/** Necessary-cookies notice (no consent needed for strictly necessary cookies, but people should be told). */
export function CookieNotice() {
  const { d } = useI18n();
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem("sv_cookie_ok") !== "1");
    } catch {}
  }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1020]/95 p-3 pl-4 text-[13px] shadow-2xl backdrop-blur sm:bottom-5">
      <Cookie size={18} className="shrink-0 text-brand-400" />
      <span className="flex-1 text-fg-muted">{d.legalUi.cookie} <Link href="/privacy#s8" className="text-brand-400 hover:underline">{d.legalUi.more}</Link></span>
      <button
        onClick={() => {
          try {
            localStorage.setItem("sv_cookie_ok", "1");
          } catch {}
          setShow(false);
        }}
        className="btn btn-primary btn-sm shrink-0"
      >
        {d.legalUi.cookieOk}
      </button>
    </div>
  );
}
