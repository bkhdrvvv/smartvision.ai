import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { getSession } from "@/lib/auth";
import { CookieNotice } from "@/components/site/LegalBits";
import { PromoBar } from "@/components/site/PromoBar";
import { getPromo } from "@/lib/promo";
import { RefCapture } from "@/components/site/RefCapture";
import { SalesChat } from "@/components/site/SalesChat";
import { getSettings } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <div className="relative overflow-x-clip">
      <Header authed={s?.role ?? null} promo={(await getPromo()).text ? <PromoBar /> : undefined} />
      <main>{children}</main>
      <Footer />
      <CookieNotice />
      <RefCapture />
      <SalesChat phone={(await getSettings()).supportPhone} />
    </div>
  );
}
