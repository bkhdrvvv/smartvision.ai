"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Mic, Volume2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { featureDicts } from "@/lib/i18n/features";
import { playAlarm, unlockAudio } from "@/lib/alarm";

type St = "granted" | "denied" | "prompt" | "unsupported";

const TEXT = {
  uz: {
    title: "Ruxsat bering",
    lead: "Sayt to'liq ishlashi uchun brauzer ruxsati kerak.",
    notif: "Bildirishnomalar",
    notifHint: "Kamerada hodisa bo'lsa yoki to'lov tasdiqlansa, darhol xabar chiqadi.",
    mic: "Mikrofon",
    micHint: "Murojaatlar chatida ovozli xabar yuborish uchun.",
    allow: "Ruxsat berish",
    later: "Keyinroq",
    ok: "Ruxsat berilgan ✓",
    denied: "Bloklangan — manzil satridagi 🔒 belgisini bosib, «Ruxsat berish»ni tanlang",
    insecure: "Brauzer ruxsatlari faqat https:// (yoki localhost) manzilda ishlaydi. Sayt domenga chiqqach o'zi ishlaydi.",
    unsupported: "Bu brauzer qo'llamaydi",
  },
  ru: {
    title: "Дайте разрешение",
    lead: "Для полной работы сайта нужны разрешения браузера.",
    notif: "Уведомления",
    notifHint: "Сразу сообщим о событии на камере или подтверждении оплаты.",
    mic: "Микрофон",
    micHint: "Для голосовых сообщений в чате обращений.",
    allow: "Разрешить",
    later: "Позже",
    ok: "Разрешено ✓",
    denied: "Заблокировано — нажмите 🔒 в адресной строке и выберите «Разрешить»",
    insecure: "Разрешения браузера работают только на https:// (или localhost). После выхода на домен заработает само.",
    unsupported: "Браузер не поддерживает",
  },
  en: {
    title: "Allow permissions",
    lead: "The site needs browser permissions to work fully.",
    notif: "Notifications",
    notifHint: "Get an instant alert for camera events or approved payments.",
    mic: "Microphone",
    micHint: "To send voice messages in the support chat.",
    allow: "Allow",
    later: "Later",
    ok: "Allowed ✓",
    denied: "Blocked — click the 🔒 in the address bar and choose “Allow”",
    insecure: "Browser permissions only work on https:// (or localhost). It will work once the site is on its domain.",
    unsupported: "Not supported by this browser",
  },
} as const;

const HIDE_KEY = "sv_perm_later";
const SPEAKER_KEY = "sv_speaker_ok";
const PHRASES = { uz: featureDicts.uz.speaker.phrase, ru: featureDicts.ru.speaker.phrase, en: featureDicts.en.speaker.phrase };
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};

async function micState(): Promise<St> {
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const p = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return p.state as St;
  } catch {
    return "prompt";
  }
}
const notifState = (): St => (typeof Notification === "undefined" ? "unsupported" : Notification.permission === "default" ? "prompt" : (Notification.permission as St));

/**
 * Asks for notification + microphone permission once after sign-in (card in the corner),
 * and shows browser pop-ups for new notifications while the dashboard is open.
 * `withMic` = false hides the microphone row (pages without the chat).
 */
export function Permissions({ withMic = true, poll = true, withNotif = true, speaker = false }: { withMic?: boolean; poll?: boolean; withNotif?: boolean; speaker?: boolean }) {
  const { locale, f } = useI18n();
  const t = TEXT[locale] ?? TEXT.uz;
  const [show, setShow] = useState(false);
  const [secure, setSecure] = useState(true);
  const [n, setN] = useState<St>("prompt");
  const [m, setM] = useState<St>("prompt");
  // speaker warning: allowed once by the customer (remembered); sound is unlocked again by the first click on each visit
  const [sp, setSp] = useState<St>(speaker ? (store.get(SPEAKER_KEY) === "1" ? "granted" : "prompt") : "granted");
  const spRef = useRef(sp);
  spRef.current = sp;
  const since = useRef<number>(0);
  useEffect(() => {
    if (!speaker) return;
    const s = store.get(SPEAKER_KEY) === "1" ? "granted" : "prompt";
    setSp(s);
    if (s === "prompt" && Date.now() - (Number(store.get(HIDE_KEY)) || 0) > 24 * 3600_000) setShow(true);
    const once = () => store.get(SPEAKER_KEY) === "1" && unlockAudio();
    document.addEventListener("pointerdown", once, { once: true });
    return () => document.removeEventListener("pointerdown", once);
  }, [speaker]);

  const refresh = async () => {
    setN(withNotif ? notifState() : "granted");
    if (withMic) setM(await micState());
  };

  useEffect(() => {
    setSecure(window.isSecureContext);
    (async () => {
      const ns = withNotif ? notifState() : "granted";
      const ms = withMic ? await micState() : "granted";
      setN(ns);
      setM(ms);
      const need = !window.isSecureContext || ns === "prompt" || ms === "prompt";
      const later = Number(store.get(HIDE_KEY)) || 0;
      if (need && Date.now() - later > 24 * 3600_000) setShow(true);
    })();
  }, [withMic, withNotif]);

  // browser pop-ups for new notifications (every 20 s while the tab is open)
  useEffect(() => {
    if (!poll) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/notifications/latest${since.current ? `?after=${since.current}` : ""}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { now: number; items: { id: string; title: string; body: string; kind?: string }[] };
        const first = !since.current;
        since.current = j.now;
        if (first || stop) return;
        // camera alarm → loud warning from the speaker (if the customer has one and allowed it)
        if (speaker && spRef.current === "granted" && j.items.some((it) => it.kind === "EVENT")) playAlarm(PHRASES, locale);
        if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
        for (const it of j.items) {
          const pop = new Notification(it.title, { body: it.body, icon: "/icon.svg", tag: it.id });
          pop.onclick = () => { window.focus(); pop.close(); };
        }
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 15_000);
    return () => { stop = true; clearInterval(iv); };
  }, [poll, speaker, locale]);

  const allow = async () => {
    if (speaker && sp === "prompt") {
      // the click itself is the permission: browsers only play sound after the person clicked
      if (unlockAudio()) {
        store.set(SPEAKER_KEY, "1");
        setSp("granted");
      } else setSp("unsupported");
    }
    if (!secure) {
      setTimeout(() => setShow(false), 1500);
      return;
    }
    if (withNotif && typeof Notification !== "undefined" && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
    if (withMic && navigator.mediaDevices?.getUserMedia) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((tr) => tr.stop()); // only the permission — nothing is recorded
      } catch {}
    }
    await refresh();
    if ((!withNotif || notifState() !== "prompt") && (!withMic || (await micState()) !== "prompt")) setTimeout(() => setShow(false), 1800);
  };

  if (!show) return null;
  const label = (s: St) => (s === "granted" ? t.ok : s === "denied" ? t.denied : s === "unsupported" ? t.unsupported : null);
  const Row = ({ icon, name, hint, s }: { icon: React.ReactNode; name: string; hint: string; s: St }) => (
    <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-300">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold">{name}</span>
        <span className="block text-[12px] text-fg-dim">{hint}</span>
        {label(s) && <span className={`mt-1 block text-[12px] ${s === "granted" ? "text-emerald-300" : "text-amber-300"}`}>{label(s)}</span>}
      </span>
    </div>
  );

  return (
    <div role="dialog" aria-label={t.title} className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-32px))] rounded-2xl border border-white/10 bg-[#0b1020]/95 p-4 shadow-2xl backdrop-blur">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold">🔔 {t.title}</h3>
        <button type="button" aria-label="close" onClick={() => { store.set(HIDE_KEY, String(Date.now())); setShow(false); }} className="text-fg-dim hover:text-fg"><X size={16} /></button>
      </div>
      <p className="mb-3 text-[12.5px] text-fg-muted">{t.lead}</p>
      <div className="grid gap-2">
        {speaker && <Row icon={<Volume2 size={16} />} name={f.speaker.permTitle} hint={f.speaker.permHint} s={sp} />}
        {!secure ? (
          <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[12.5px] text-amber-200">{t.insecure}</p>
        ) : (
          <>
            {withNotif && <Row icon={<Bell size={16} />} name={t.notif} hint={t.notifHint} s={n} />}
            {withMic && <Row icon={<Mic size={16} />} name={t.mic} hint={t.micHint} s={m} />}
          </>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => { store.set(HIDE_KEY, String(Date.now())); setShow(false); }} className="btn btn-ghost !h-9 !px-3 text-[13px]">{t.later}</button>
        {((secure && (n === "prompt" || m === "prompt")) || (speaker && sp === "prompt")) && (
          <button type="button" onClick={allow} className="btn btn-primary !h-9 !px-4 text-[13px]">{t.allow}</button>
        )}
      </div>
    </div>
  );
}
