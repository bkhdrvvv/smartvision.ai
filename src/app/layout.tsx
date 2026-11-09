import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/client";
import { getDict } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--nf-inter", display: "swap" });
const display = Inter_Tight({ subsets: ["latin", "cyrillic"], weight: ["700", "800", "900"], variable: "--nf-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--nf-mono", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getDict();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: d.meta.title, template: "%s · SMARTVISION AI" },
    description: d.meta.description,
    icons: { icon: "/icon.svg", apple: "/icon-512.png" },
    openGraph: { title: d.meta.title, description: d.meta.description, type: "website" },
  };
}

export const viewport: Viewport = { themeColor: "#070b16", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getDict();
  return (
    <html lang={locale} className={`${inter.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
