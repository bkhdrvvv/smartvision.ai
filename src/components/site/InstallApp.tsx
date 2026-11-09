"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Registers the service worker and offers "Install app" when the browser allows it (Android / desktop Chrome, Edge).
 * On iPhone (no install prompt) a one-line hint is shown instead. Hidden once installed or dismissed.
 */
export function InstallApp() {
  const { f } = useI18n();
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    let dismissed = false;
    try { dismissed = localStorage.getItem("sv_install_x") === "1"; } catch {}
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone || dismissed) return;
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", on);
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setIos(true);
      setHidden(false);
    }
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  if (hidden) return null;
  const close = () => {
    try { localStorage.setItem("sv_install_x", "1"); } catch {}
    setHidden(true);
  };
  return (
    <div className="fixed bottom-4 left-4 z-40 flex max-w-[calc(100vw-32px)] items-center gap-2 rounded-2xl border border-white/10 bg-[#0b1020]/95 p-2 pl-3 shadow-2xl backdrop-blur">
      <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
      {ios ? (
        <span className="text-[12.5px] text-fg-muted">{f.pwa.iosHint}</span>
      ) : (
        <button
          onClick={async () => {
            if (!evt) return;
            await evt.prompt();
            const c = await evt.userChoice.catch(() => ({ outcome: "dismissed" }));
            if (c.outcome === "accepted") setHidden(true);
          }}
          className="btn btn-primary btn-sm"
        >
          <Download size={14} /> {f.pwa.install}
        </button>
      )}
      <button aria-label="close" onClick={close} className="grid h-8 w-8 place-items-center text-fg-dim hover:text-fg"><X size={15} /></button>
    </div>
  );
}
