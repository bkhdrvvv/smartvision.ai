import { Pricing } from "@/components/site/Pricing";
import { Faq } from "@/components/site/FaqCta";
import { getPlans } from "@/lib/plans";
import { getSession } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { d } = await getDict();
  return { title: d.nav.pricing };
}

export default async function PricingPage() {
  const [plans, s] = await Promise.all([getPlans(), getSession()]);
  return (
    <div className="pt-16">
      <Pricing plans={plans} authed={!!s} />
      <Faq />
    </div>
  );
}
