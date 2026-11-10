import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";

const T = {
  uz: { title: "Kamera bu sahifani topa olmadi", text: "Manzil noto'g'ri yozilgan yoki sahifa o'chirilgan bo'lishi mumkin.", home: "Bosh sahifa", pricing: "Narxlar", cabinet: "Kabinet" },
  ru: { title: "Камера не нашла эту страницу", text: "Возможно, адрес набран с ошибкой или страница удалена.", home: "Главная", pricing: "Цены", cabinet: "Кабинет" },
  en: { title: "The camera couldn't find this page", text: "The address may be mistyped or the page was removed.", home: "Home", pricing: "Pricing", cabinet: "Dashboard" },
} as const;

export default async function NotFound() {
  const t = T[await getLocale()] ?? T.uz;
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-[radial-gradient(900px_500px_at_50%_35%,#14205a_0%,#05070d_65%)] px-5 text-center">
      <div>
        {/* the shutter logo, slowly turning — "searching" */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="mx-auto h-28 w-28 animate-[spin_14s_linear_infinite] rounded-[28%] shadow-[0_0_60px_-10px_rgba(34,211,238,.7)]" />
        <div className="display mt-8 bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-[96px] font-extrabold leading-none text-transparent">404</div>
        <h1 className="mt-4 text-[24px] font-bold">{t.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-fg-muted">{t.text}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">{t.home}</Link>
          <Link href="/pricing" className="btn btn-ghost">{t.pricing}</Link>
          <Link href="/dashboard" className="btn btn-ghost">{t.cabinet}</Link>
        </div>
      </div>
    </div>
  );
}
