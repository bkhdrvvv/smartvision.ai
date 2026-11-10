import Link from "next/link";
import { Check, Rocket } from "lucide-react";
import { db } from "@/lib/db";
import { getActiveSubscription } from "@/lib/subscription";
import { getLocale } from "@/lib/i18n/server";
import { OnboardingHide } from "./OnboardingHide";

const T = {
  uz: { title: "Birinchi qadamlar", lead: "Tizim to'liq ishlashi uchun shu 5 ta qadamni bajaring.", done: "{a} / {b} bajarildi", steps: ["Emailingizni tasdiqlang", "Tarifni tanlang yoki 7 kun bepul sinab ko'ring", "Kamera qo'shing (RTSP manzili bilan)", "Kamera dasturini (Edge AI) kompyuterga o'rnating", "Telegramni ulang — ogohlantirishlar rasm bilan keladi"], go: "Bajarish", hide: "Yashirish" },
  ru: { title: "Первые шаги", lead: "Чтобы система работала полностью, выполните эти 5 шагов.", done: "Выполнено {a} / {b}", steps: ["Подтвердите email", "Выберите тариф или попробуйте 7 дней бесплатно", "Добавьте камеру (адрес RTSP)", "Установите программу камер (Edge AI) на компьютер", "Подключите Telegram — тревоги придут с фото"], go: "Сделать", hide: "Скрыть" },
  en: { title: "First steps", lead: "Do these 5 steps so the system works fully.", done: "{a} / {b} done", steps: ["Confirm your email", "Choose a plan or try 7 days free", "Add a camera (RTSP address)", "Install the camera software (Edge AI) on a computer", "Connect Telegram — alerts arrive with photos"], go: "Do it", hide: "Hide" },
} as const;

/** Checklist on the dashboard home until everything is set up (or the customer hides it). */
export async function Onboarding({ user }: { user: { id: string; emailVerifiedAt: Date | null; telegramChatId: string | null; organizationId: string } }) {
  const locale = await getLocale();
  const t = T[locale] ?? T.uz;
  const [sub, cams, device] = await Promise.all([
    getActiveSubscription(user.organizationId),
    db.camera.count({ where: { organizationId: user.organizationId } }),
    db.edgeDevice.findFirst({ where: { organizationId: user.organizationId, lastHeartbeat: { not: null } }, select: { id: true } }),
  ]);
  const steps = [
    { ok: !!user.emailVerifiedAt, href: "/dashboard/settings" },
    { ok: !!sub, href: "/dashboard/subscription" },
    { ok: cams > 0, href: "/dashboard/cameras" },
    { ok: !!device, href: "/support" },
    { ok: !!user.telegramChatId, href: "/dashboard/settings" },
  ];
  const n = steps.filter((s) => s.ok).length;
  if (n === steps.length) return null;
  return (
    <OnboardingHide label={t.hide}>
      <div className="mb-5 rounded-[20px] border border-brand-400/30 bg-[linear-gradient(135deg,rgba(59,130,246,.12),rgba(124,92,255,.08))] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/20 text-brand-300"><Rocket size={20} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold">{t.title}</div>
            <div className="text-[13px] text-fg-muted">{t.lead}</div>
          </div>
          <span className="chip chip-blue">{t.done.replace("{a}", String(n)).replace("{b}", String(steps.length))}</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${(n / steps.length) * 100}%` }} /></div>
        <ol className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {steps.map((s, i) => (
            <li key={i} className={`flex items-center gap-2.5 rounded-xl border p-3 text-[13px] ${s.ok ? "border-emerald-400/30 bg-emerald-400/5 text-fg-muted" : "border-line bg-white/[.02]"}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${s.ok ? "bg-emerald-400 text-ink-950" : "bg-white/10"}`}>{s.ok ? <Check size={14} /> : i + 1}</span>
              <span className={`min-w-0 flex-1 ${s.ok ? "line-through opacity-70" : ""}`}>{t.steps[i]}</span>
              {!s.ok && <Link href={s.href} className="shrink-0 text-[12px] font-semibold text-brand-300 hover:underline">{t.go} →</Link>}
            </li>
          ))}
        </ol>
      </div>
    </OnboardingHide>
  );
}
